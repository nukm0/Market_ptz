import {NextRequest,NextResponse} from "next/server";
import {supabaseRequest} from "../../../../lib/supabase";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){try{
 const q=(request.nextUrl.searchParams.get("q")||"").trim().replace(/^@/,"");
 if(!/^[A-Za-z0-9_]{2,32}$/.test(q))return NextResponse.json({error:"Введите @username или Telegram ID."},{status:400});
 const filter=/^\d+$/.test(q)?"telegram_id=eq."+q:"username=ilike.*"+encodeURIComponent(q.replace(/_/g,"\\_"))+"*";
 const rows=await supabaseRequest("marketplace_users?"+filter+"&select=telegram_id,username,first_name,last_name,photo_url,verified&limit=20");
 return NextResponse.json({users:rows||[]},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Не удалось найти аккаунт. Повторите попытку."},{status:400});}}
