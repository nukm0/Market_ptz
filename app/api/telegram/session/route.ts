import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const initData = typeof body?.initData === "string" ? body.initData : "";
    const session = await getVerifiedSession(initData, { allowBanned: true });
    const counts=await supabaseRequest("rpc/marketplace_session_counts",{method:"POST",body:JSON.stringify({p_user:session.user.id,p_staff:["Владелец","Заместитель владельца","Администратор"].includes(session.role)})}) as any;
    const subscriptions=await supabaseRequest(`marketplace_profile_subscriptions?subscriber_telegram_id=eq.${session.user.id}&select=target_telegram_id`) as any[];
    const ids=Array.from(new Set(subscriptions.map(r=>String(r.target_telegram_id))));
    const profiles=ids.length?await supabaseRequest(`marketplace_users?telegram_id=in.(${ids.join(",")})&select=telegram_id,username,first_name,last_name,photo_url,verified`) as any[]:[];
    return NextResponse.json({ ...session, profileSubscriptions:profiles,...counts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const missingConfig = message.includes("not configured") || message.includes("must be configured");
    return NextResponse.json({ error: missingConfig ? "Серверная авторизация не настроена." : "Не удалось подтвердить сессию Telegram." }, { status: missingConfig ? 503 : 401, headers: { "Cache-Control": "no-store" } });
  }
}
