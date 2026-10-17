import {supabaseRequest,supabaseConfig,sendTelegramPost} from "./telegram-auth";
import {APP_URL,miniAppWebUrl} from "./telegram-links";
const categories=["Vape","Техника","Одежда","Дом и сад","Мебель","Авто","Спорт","Детское","Красота","Услуги","Другое"];
const types=["Продажа","Покупка","Обмен"],subs=["Подики","Расходники","Услуги"];
async function deliver(chatId:number,d:any,call:any){
 if(d.duplicate)return;if(d.missing){await call("sendMessage",{chat_id:chatId,text:"Черновик уже завершён. Для нового объявления нажмите «Опубликовать».",reply_markup:{inline_keyboard:[[{text:"Новое объявление",callback_data:"pub_start"}]]}});return;}
 if(d.error||d.cancelled){await call("sendMessage",{chat_id:chatId,text:d.error||"Публикация отменена. Черновик удалён.",reply_markup:{inline_keyboard:[[{text:"Главное меню",callback_data:"menu"}]]}});return;}
 const data=d.data||{},prefix=`pub:${d.id}:`;let text="",rows:any[]=[];
 if(d.stage==="title")text="Новое объявление · шаг 1\n\nНапишите название товара (до 180 символов). Для отмены — кнопка ниже.";
 if(d.stage==="description")text="Шаг 2 · Описание\n\nРасскажите о товаре, состоянии и условиях сделки. До 4000 символов.";
 if(d.stage==="category"){text="Шаг 3 · Категория\n\nВыберите категорию:";rows=categories.map((label,i)=>[{text:label,callback_data:prefix+"cat:"+i}]);}
 if(d.stage==="subcategory"){text="Раздел Vape\n\nПодики — под-системы.\nРасходники — жидкости, одноразки, картриджи, испарители и другие расходники для обслуживания.\nУслуги — ремонт.";rows=subs.map((label,i)=>[{text:label,callback_data:prefix+"sub:"+i}]);}
 if(d.stage==="price")text="Шаг 4 · Цена\n\nВведите цену в рублях числом. Для договорной цены отправьте 0.";
 if(d.stage==="type"){text="Шаг 5 · Тип объявления";rows=types.map((label,i)=>[{text:label,callback_data:prefix+"type:"+i}]);}
 if(d.stage==="photos"){text=`Шаг 6 · Фотографии\n\nПришлите от 1 до 3 фотографий — по одной или альбомом. После загрузки нажмите «Фото загружены».\n\nСейчас сохранено: ${data.photos?.length||0} из 3.`;rows=[[{text:"Фото загружены",callback_data:prefix+"photos_done"}]];}
 if(d.stage==="target"){text="Где разместить объявление?";rows=[[{text:"Частное объявление",callback_data:prefix+"private"}],[{text:"В моём магазине",callback_data:prefix+"shop"}]];}
 if(d.stage==="review"){text=`Проверьте объявление\n\n${data.title}\n${data.category} · ${data.subcategory||"Прочее"} · ${data.type}\nЦена: ${Number(data.price)?Number(data.price).toLocaleString("ru-RU")+" ₽":"Договорная"}\nФото: ${data.photos?.length||0}/3\nРазмещение: ${data.shopId?"магазин":"частное объявление"}\n\n${String(data.description||"").slice(0,2200)}\n\nНажмите «Опубликовать», если всё верно.`;rows=[[{text:"Опубликовать",callback_data:prefix+"confirm:"+d.revision}],[{text:"Начать заново",callback_data:"pub_start"}]];}
 rows.push([{text:"Отменить публикацию",callback_data:prefix+"cancel"}]);
 await call("sendMessage",{chat_id:chatId,text:(d.warning?d.warning+"\n\n":"")+text,reply_markup:{inline_keyboard:rows}});
}
async function storePhoto(fileId:string,path:string,call:any){
 const file=await call("getFile",{file_id:fileId});if(!file.file_path||Number(file.file_size)>5*1024*1024)throw new Error("Фото слишком большое. Пришлите фото размером до 5 МБ.");
 const token=process.env.TELEGRAM_BOT_TOKEN;const response=await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`,{cache:"no-store"});if(!response.ok)throw new Error("Не удалось загрузить фото из Telegram. Попробуйте снова.");
 const bytes=await response.arrayBuffer();if(bytes.byteLength>5*1024*1024)throw new Error("Фото должно быть не больше 5 МБ.");
 const {url,key}=supabaseConfig();const upload=await fetch(`${url}/storage/v1/object/marketplace-media/${path}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"image/jpeg","x-upsert":"true"},body:bytes});
 if(!upload.ok)throw new Error("Не удалось сохранить фото. Повторите публикацию через кнопку подтверждения.");return `${url}/storage/v1/object/public/marketplace-media/${path}`;
}
export async function notifyPublishedListing(listing:any){
 const id=String(listing.listing_id),seller=Number(listing.seller_telegram_id);if(listing.shop_id){const shops=await supabaseRequest(`marketplace_shops?id=eq.${listing.shop_id}&select=hidden&limit=1`);if(shops?.[0]?.hidden)return;}
 const rows=await supabaseRequest(listing.shop_id?`marketplace_shop_subscriptions?shop_id=eq.${listing.shop_id}&select=telegram_id`:`marketplace_profile_subscriptions?target_telegram_id=eq.${seller}&select=subscriber_telegram_id`);
 const ids=Array.from(new Set<number>((rows||[]).map((r:any)=>Number(r.telegram_id||r.subscriber_telegram_id)))).filter(n=>n!==seller&&n>0) as number[];
 await Promise.all(ids.map(async target=>{const message=`Новая публикация: ${listing.title}. ${Number(listing.price)?Number(listing.price).toLocaleString("ru-RU")+" ₽":"Договорная цена"}`;await supabaseRequest("marketplace_notifications",{method:"POST",body:JSON.stringify({telegram_id:target,title:"Новая публикация по подписке",message,action_url:miniAppWebUrl("ad",id),read:false})}).catch(()=>null);await sendTelegramPost(target,message,id).catch(()=>false);}));
}
export async function handleBotPublishing({update,user,message,callback,call,begin=false}:any){
 const uid=Number(user.id),chatId=Number(message.chat.id),text=String(message.text||"").trim(),action=String(callback?.data||"");
 const cb=action.match(/^pub:([a-f0-9-]{36}):([a-z_]+)(?::(\d+))?$/);const starts=begin||action==="pub_start"||text==="/publish";
 const drafts=(!starts&&!cb)?await supabaseRequest(`marketplace_bot_drafts?telegram_id=eq.${uid}&select=id,stage&limit=1`):[];
 if(!starts&&!cb&&!drafts?.length)return false;
 if(callback&&!starts&&!cb){await supabaseRequest(`marketplace_bot_drafts?telegram_id=eq.${uid}`,{method:"DELETE"});return false;}
 if(message.chat.type&&message.chat.type!=="private"){await call("sendMessage",{chat_id:chatId,text:"Создавайте объявление в личном чате с ботом."});return true;}
 if(text.startsWith("/")&&!starts&&text!=="/cancel"){await supabaseRequest(`marketplace_bot_drafts?telegram_id=eq.${uid}`,{method:"DELETE"});return false;}
 try{
 if(cb?.[2]==="confirm"){
 const rows=await supabaseRequest(`marketplace_bot_drafts?telegram_id=eq.${uid}&id=eq.${cb[1]}&select=*&limit=1`);const d=rows?.[0];if(!d||d.stage!=="review"||d.revision!==Number(cb[3])){await deliver(chatId,{error:"Черновик уже опубликован или изменился. Используйте последнее сообщение бота."},call);return true;}
 const photos=[];for(let i=0;i<d.data.photos.length;i++)photos.push(await storePhoto(d.data.photos[i],`bot-listings/${uid}/${d.id}/${d.revision}-${i}.jpg`,call));
 const row=await supabaseRequest("rpc/marketplace_bot_publish",{method:"POST",body:JSON.stringify({p_user:uid,p_draft:d.id,p_revision:d.revision,p_photos:photos})});
 await call("sendMessage",{chat_id:chatId,text:"Объявление опубликовано и сохранено в вашем личном кабинете."+(row.shop_id?" Оно также появилось в магазине.":""),reply_markup:{inline_keyboard:[[{text:"Открыть объявление",web_app:{url:miniAppWebUrl("ad",String(row.listing_id))}}],[{text:"Мой личный кабинет",web_app:{url:miniAppWebUrl("page","profile")}}],[{text:"Главное меню",callback_data:"menu"}]]}});
 await notifyPublishedListing(row).catch(()=>null);return true;
 }
 let next=starts?"begin":cb?.[2]||((text==="/cancel")?"cancel":message.photo?.length?"photo":"answer"),value:any=text;
 if(next==="photo")value=message.photo[message.photo.length-1].file_id;
 if(["cat","sub","type"].includes(next)){value=(next==="cat"?categories:next==="sub"?subs:types)[Number(cb?.[3])]||"";next="answer";}
 if(starts)await supabaseRequest("marketplace_users?on_conflict=telegram_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({telegram_id:uid,username:user.username||null,first_name:user.first_name||null,last_name:user.last_name||null})});
 const d=await supabaseRequest("rpc/marketplace_bot_step",{method:"POST",body:JSON.stringify({p_user:uid,p_update:Number(update.update_id),p_action:next,p_value:value,p_draft:cb?.[1]||null})});await deliver(chatId,d,call);return true;
 }catch(error){const message=error instanceof Error?error.message:"";await call("sendMessage",{chat_id:chatId,text:/^Фото|^Не удалось/.test(message)?message:"Не удалось выполнить шаг публикации. Повторите действие или начните заново командой /publish."});return true;}
}
