import {supabaseConfig} from "./supabase";
export type TelegramIdentity={id:number;username?:string;first_name?:string;last_name?:string;photo_url?:string};
const cache=new Map<number,{until:number;promise:Promise<TelegramIdentity>}>();
export function refreshTelegramIdentity(user:TelegramIdentity):Promise<TelegramIdentity>{
 const previous=cache.get(user.id);if(previous&&previous.until>Date.now())return previous.promise;
 if(cache.size>500)cache.clear();
 const promise=refresh(user).catch(()=>user);cache.set(user.id,{until:Date.now()+60000,promise});return promise;
}
async function refresh(user:TelegramIdentity){
 const token=process.env.TELEGRAM_BOT_TOKEN;if(!token)return user;
 const signal=AbortSignal.timeout(4500);
 const call=async(method:string,body:unknown)=>{const r=await fetch("https://api.telegram.org/bot"+token+"/"+method,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal,cache:"no-store"});const d=await r.json();if(!r.ok||!d.ok)throw Error("Telegram identity unavailable");return d.result;};
 const [chatResult,photoResult]=await Promise.allSettled([call("getChat",{chat_id:user.id}),call("getUserProfilePhotos",{user_id:user.id,limit:1})]);
 let next:TelegramIdentity={...user};
 if(chatResult.status==="fulfilled"&&Number(chatResult.value.id)===user.id){const chat=chatResult.value;next={...next,first_name:chat.first_name||undefined,last_name:chat.last_name||undefined,username:chat.username||undefined};}
 if(photoResult.status!=="fulfilled")return next;
 const variants=photoResult.value.photos?.[0];
 if(!variants?.length){if(photoResult.value.total_count===0)next.photo_url=undefined;return next;}
 const photo=variants[variants.length-1],unique=String(photo.file_unique_id||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,180);
 if(!unique||String(user.photo_url||"").endsWith("/"+unique+".jpg"))return next;
 try{
  const file=await call("getFile",{file_id:photo.file_id});if(!file.file_path||Number(file.file_size)>5*1024*1024)return next;
  const image=await fetch("https://api.telegram.org/file/bot"+token+"/"+file.file_path,{signal,cache:"no-store"});if(!image.ok)return next;
  const bytes=await image.arrayBuffer();if(bytes.byteLength>5*1024*1024)return next;
  const {url,key}=supabaseConfig(),path="telegram-avatars/"+user.id+"/"+unique+".jpg";
  const uploaded=await fetch(url+"/storage/v1/object/marketplace-media/"+path,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"image/jpeg","x-upsert":"true"},body:bytes,signal});
  if(uploaded.ok)next.photo_url=url+"/storage/v1/object/public/marketplace-media/"+path;
 }catch{/* Keep the last valid avatar if Telegram or Storage is temporarily unavailable. */}
 return next;
}
