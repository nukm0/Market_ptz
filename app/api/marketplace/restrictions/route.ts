import {NextRequest,NextResponse} from "next/server";
import {getVerifiedSession,supabaseRequest} from "../../../../lib/telegram-auth";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){try{const s=await getVerifiedSession(request.headers.get("x-telegram-init-data")||"",{allowBanned:true});const rows=await supabaseRequest(`marketplace_reports?object_owner_telegram_id=eq.${s.user.id}&status=eq.resolved&owner_decision=in.(warning,hide_listing,temporary_ban,permanent_ban)&select=id,owner_comment,owner_decision,resolved_at,object_title&order=resolved_at.desc&limit=50`);return NextResponse.json({restrictions:rows},{headers:{"Cache-Control":"no-store"}});}catch{return NextResponse.json({error:"Не удалось загрузить ограничения."},{status:400});}}
