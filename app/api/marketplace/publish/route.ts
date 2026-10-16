import { NextRequest, NextResponse } from "next/server";
import { telegramMiniAppLink } from "../../../../lib/telegram-links";
import { getVerifiedSession, sendTelegramPost, supabaseRequest } from "../../../../lib/telegram-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const body=await request.json();
    const session=await getVerifiedSession(String(body?.initData||""));
    const title=String(body?.title||"").trim().slice(0,180);
    const category=String(body?.category||"").slice(0,80);
    const subcategory=String(body?.subcategory||"").slice(0,80);
    const description=String(body?.description||"").trim().slice(0,4000);
    const price=Math.max(0,Number(body?.price)||0);
    const listingId=String(body?.listingId||"");
    const listingType=["Покупка","Продажа","Обмен"].includes(body?.listingType)?body.listingType:"Продажа";
    const listingGroup=body?.listingGroup==="магазина"?"магазина":"частное";
    const photoUrls=Array.isArray(body?.photoUrls)?body.photoUrls.filter((x:any)=>typeof x==="string"&&/^https:\/\//i.test(x)).slice(0,3):[];
    if(!/^\d{10,20}$/.test(listingId)) return NextResponse.json({error:"Не удалось подготовить объявление. Повторите попытку."},{status:400});
    if(!category)return NextResponse.json({error:"Выберите категорию."},{status:400});
    if(!title)return NextResponse.json({error:"Напишите название."},{status:400});
    if(!description)return NextResponse.json({error:"Напишите описание."},{status:400});
    if(!photoUrls.length)return NextResponse.json({error:"Добавьте хотя бы одну фотографию."},{status:400});
    const me=await supabaseRequest(`marketplace_users?telegram_id=eq.${session.user.id}&select=username&limit=1`) as any[];
    const username=String(me?.[0]?.username||session.user.username||"");
    let shopId:string|null=null;
    if(listingGroup==="магазина") {
      if(!session.shop?.id||Number(session.shop.owner_telegram_id)!==session.user.id) return NextResponse.json({error:"Для публикации в магазине нужна роль подтверждённого владельца."},{status:403});
      shopId=String(session.shop.id);
    }
    const row={listing_id:listingId,seller_telegram_id:session.user.id,seller_username:username,shop_id:shopId,title,category,subcategory,price,description,photo_urls:photoUrls,listing_type:listingType,listing_group:listingGroup,hidden:false,created_at:new Date().toISOString()};
    await supabaseRequest("marketplace_listings?on_conflict=listing_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(row)});
    if(shopId && session.shop?.hidden)return NextResponse.json({ok:true,notified:0},{headers:{"Cache-Control":"no-store"}});
    const targets:any[]=[];
    if(shopId) {
      const subscribers=await supabaseRequest(`marketplace_shop_subscriptions?shop_id=eq.${encodeURIComponent(shopId)}&select=telegram_id`) as any[];
      for(const s of subscribers||[]) if(Number(s.telegram_id)!==session.user.id) targets.push(Number(s.telegram_id));
    } else {
      const subscribers=await supabaseRequest(`marketplace_profile_subscriptions?target_telegram_id=eq.${session.user.id}&select=subscriber_telegram_id`) as any[];
      for(const s of subscribers||[]) if(Number(s.subscriber_telegram_id)!==session.user.id) targets.push(Number(s.subscriber_telegram_id));
    }
    const appUrl=(process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL||"").replace(/\/$/,"");
    const deepLink=telegramMiniAppLink("ad",listingId);
    const message=`Новая публикация${listingGroup==="магазина"?" в магазине":" от пользователя"}${username?` @${username}`:""}: «${title}».${price?` Цена: ${price.toLocaleString("ru-RU")} ₽`:""}${deepLink?`\n${deepLink}`:""}`;
    await Promise.all(targets.map(async(id:number)=>{
      await supabaseRequest("marketplace_notifications",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({telegram_id:id,title:"Новая публикация по подписке",message,read:false,action_url:deepLink||null})}).catch(()=>null);
      await sendTelegramPost(id,message,listingId).catch(()=>false);
    }));
    return NextResponse.json({ok:true,notified:targets.length},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    const message=error instanceof Error?error.message:"Request failed";
    const banned=message.includes("Account is banned");
    return NextResponse.json({error:banned?"Аккаунт заблокирован.":message.includes("not configured")?"Серверная база не подключена.":"Не удалось опубликовать объявление на сервере."},{status:banned?403:message.includes("not configured")?503:400});
  }
}
