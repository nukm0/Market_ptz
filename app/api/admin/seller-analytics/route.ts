import {NextRequest,NextResponse} from "next/server";
import {getVerifiedSession,supabaseRequest} from "../../../../lib/telegram-auth";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){try{
 const s=await getVerifiedSession(request.headers.get("x-telegram-init-data")||"");if(s.user.id!==998579758&&s.role!=="Заместитель владельца")return NextResponse.json({error:"Статистика пользователей доступна только владельцу и заместителю."},{status:403});
 const target=request.nextUrl.searchParams.get("target"),query=(request.nextUrl.searchParams.get("q")||"").trim().replace(/^@/,"");
 if(!target){if(!/^[A-Za-z0-9_]{2,32}$/.test(query))return NextResponse.json({error:"Введите Telegram ID или не менее двух символов username."},{status:400});const filter=/^\d+$/.test(query)?`telegram_id=eq.${query}`:`username=ilike.*${encodeURIComponent(query.replace(/_/g,"\\_"))}*`;const users=await supabaseRequest(`marketplace_users?${filter}&select=telegram_id,username,first_name,last_name,photo_url,verified&limit=30`);return NextResponse.json({users},{headers:{"Cache-Control":"no-store"}});}
 const days=Number(request.nextUrl.searchParams.get("days")||30);if(!/^\d{5,20}$/.test(target)||![7,30,90].includes(days))return NextResponse.json({error:"Выберите пользователя и период 7, 30 или 90 дней."},{status:400});
 const users=await supabaseRequest(`marketplace_users?telegram_id=eq.${target}&select=telegram_id,username,first_name,last_name,photo_url,verified&limit=1`);if(!users?.[0])return NextResponse.json({error:"Пользователь не найден."},{status:404});
 const stats=await supabaseRequest("rpc/marketplace_seller_analytics",{method:"POST",body:JSON.stringify({p_actor:s.user.id,p_target:Number(target),p_days:days})});return NextResponse.json({user:users[0],...stats},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Не удалось загрузить статистику пользователя."},{status:400});}}
