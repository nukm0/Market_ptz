import {supabaseConfig,supabaseRequest} from "./supabase";

// Only listing uploads on our own storage host may be removed.
export function listingPhotoPath(value:string,storageUrl:string):string|null {
 try {
  const target=new URL(value),origin=new URL(storageUrl);
  const prefix="/storage/v1/object/public/marketplace-media/";
  if(target.origin!==origin.origin||target.search||target.hash||!target.pathname.startsWith(prefix))return null;
  const path=decodeURIComponent(target.pathname.slice(prefix.length));
  if(!/^(listings|bot-listings)\/[A-Za-z0-9_./-]+$/.test(path)||path.split("/").some(part=>!part||part==="."||part===".."))return null;
  return path;
 }catch{return null;}
}

// The database trigger queues photos in the same transaction as deletion.
// Failed storage requests leave the queue intact for the scheduled retry.
export async function cleanupDeletedListingPhotos() {
 const {url,key}=supabaseConfig();
 const rows=await supabaseRequest("marketplace_listing_photo_cleanup?select=id,photo_url&order=created_at.asc&limit=30") as Array<{id:string;photo_url:string}>;
 let deleted=0;
 await Promise.all((rows||[]).map(async row=>{
  try{
   const path=listingPhotoPath(row.photo_url,url);
   if(path){
    const referenced=await supabaseRequest("marketplace_listings?select=listing_id&photo_urls=cs."+encodeURIComponent(JSON.stringify([row.photo_url]))+"&limit=1") as unknown[];
    if(!referenced.length){
     const response=await fetch(url+"/storage/v1/object/marketplace-media",{
      method:"DELETE",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({prefixes:[path]}),cache:"no-store",signal:AbortSignal.timeout(8000)
     });
     if(!response.ok&&response.status!==404)throw new Error("Storage deletion failed");
     deleted++;
    }
   }
   await supabaseRequest("marketplace_listing_photo_cleanup?id=eq."+encodeURIComponent(row.id),{method:"DELETE",headers:{Prefer:"return=minimal"}});
  }catch{console.error("Не удалось очистить фото удалённого объявления; запланирован повтор.");}
 }));
 return {processed:rows?.length||0,deleted};
}
