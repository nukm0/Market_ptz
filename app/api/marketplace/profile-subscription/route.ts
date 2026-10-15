import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest) {
  try {
    const body=await request.json();
    const session=await getVerifiedSession(String(body?.initData||""));
    let target=Number(body?.targetTelegramId);
    const active=!!body?.active;
    if(!Number.isSafeInteger(target)||target<=0) {
      const username=String(body?.targetUsername||"").replace(/^@/,"").trim();
      if(username) { const found=await supabaseRequest(`marketplace_users?username=ilike.${encodeURIComponent(username)}&select=telegram_id&limit=1`) as any[]; target=Number(found?.[0]?.telegram_id||0); }
    }
    if(!Number.isSafeInteger(target)||target<=0||target===session.user.id) return NextResponse.json({error:"Профиль для подписки указан неверно."},{status:400});
    const exists=await supabaseRequest(`marketplace_users?telegram_id=eq.${target}&select=telegram_id&limit=1`) as any[];
    if(!exists?.length) return NextResponse.json({error:"Пользователь ещё не открывал площадку через Telegram."},{status:404});
    if(active) await supabaseRequest("marketplace_profile_subscriptions?on_conflict=target_telegram_id,subscriber_telegram_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({target_telegram_id:target,subscriber_telegram_id:session.user.id})});
    else await supabaseRequest(`marketplace_profile_subscriptions?target_telegram_id=eq.${target}&subscriber_telegram_id=eq.${session.user.id}`,{method:"DELETE",headers:{Prefer:"return=minimal"}});
    return NextResponse.json({ok:true,active});
  } catch(error) { const message=error instanceof Error?error.message:"Request failed"; return NextResponse.json({error:message.includes("not configured")?"Серверная база не подключена.":"Не удалось изменить подписку."},{status:message.includes("not configured")?503:400}); }
}
