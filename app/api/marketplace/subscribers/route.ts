import {NextRequest,NextResponse} from "next/server";
import {getVerifiedSession,supabaseRequest} from "../../../../lib/telegram-auth";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){try{
 const session=await getVerifiedSession(request.headers.get("x-telegram-init-data")||"");
 if(!session.verified&&!session.isOwner)return NextResponse.json({error:"Статистика подписчиков доступна после верификации."},{status:403});
 const rows=await supabaseRequest(`marketplace_profile_subscriptions?target_telegram_id=eq.${session.user.id}&select=subscriber_telegram_id,created_at&order=created_at.desc`) as any[];
 const ids=rows.map(r=>r.subscriber_telegram_id);
 const users=ids.length?await supabaseRequest(`marketplace_users?telegram_id=in.(${ids.join(",")})&select=telegram_id,username,first_name,last_name,photo_url`) as any[]:[];
 return NextResponse.json({total:rows.length,last7Days:rows.filter(r=>Date.parse(r.created_at)>Date.now()-7*86400000).length,subscribers:rows.map(r=>({...r,user:users.find(u=>Number(u.telegram_id)===Number(r.subscriber_telegram_id))}))},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Не удалось загрузить подписчиков."},{status:400});}}
