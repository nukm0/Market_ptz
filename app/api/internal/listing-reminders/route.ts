import {cleanupDeletedListingPhotos} from "../../../../lib/listing-photo-cleanup";
import {NextRequest,NextResponse} from "next/server";
import {supabaseRequest,sendTelegramMessage} from "../../../../lib/telegram-auth";
import {APP_URL,miniAppWebUrl} from "../../../../lib/telegram-links";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
export async function POST(request:NextRequest){try{
 const secret=request.headers.get("x-reminder-key")||"";if(!secret)return NextResponse.json({error:"Нет доступа."},{status:403});const allowed=await supabaseRequest("rpc/marketplace_reminder_auth",{method:"POST",body:JSON.stringify({p_secret:secret})});if(allowed!==true)return NextResponse.json({error:"Нет доступа."},{status:403});
 await cleanupDeletedListingPhotos().catch(()=>console.error("Очистка фото будет повторена по расписанию."));
 const rows=await supabaseRequest("rpc/marketplace_claim_reminders",{method:"POST",body:"{}"});let sent=0;
 for(const row of rows||[]){const id=String(row.listing_id),message=`Проверим актуальность объявления\n\n${row.title} · ${Number(row.price)?Number(row.price).toLocaleString("ru-RU")+" ₽":"Договорная цена"}\n\nС последнего подтверждения прошло 7 дней. Товар ещё продаётся? Без ответа объявление не удаляется.`;const token=process.env.TELEGRAM_BOT_TOKEN;const reply_markup={inline_keyboard:[[{text:"Да, ещё продаётся",callback_data:`rem:keep:${id}`}],[{text:"Снять с продажи",callback_data:`rem:stop:${id}`}],[{text:"Открыть объявление",web_app:{url:miniAppWebUrl("ad",id)}}]]};
 let delivered=false;for(const method of ["sendPhoto","sendMessage"]){try{const result=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:Number(row.seller_telegram_id),...(method==="sendPhoto"?{photo:`${APP_URL}/api/telegram/card?ad=${id}&kind=reminder`,caption:message.slice(0,1000)}:{text:message}),reply_markup}),cache:"no-store"});const body=await result.json();if(result.ok&&body.ok){delivered=true;break;}}catch{}}
 if(delivered){await supabaseRequest(`marketplace_listings?listing_id=eq.${id}&last_confirmed_at=eq.${encodeURIComponent(row.last_confirmed_at)}&publication_status=eq.active`,{method:"PATCH",body:JSON.stringify({reminder_sent_at:new Date().toISOString()})});sent++;}
 }
 return NextResponse.json({ok:true,sent});
 }catch{return NextResponse.json({error:"Не удалось отправить напоминания."},{status:500});}}
