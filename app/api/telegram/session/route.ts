import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const initData = typeof body?.initData === "string" ? body.initData : "";
    const session = await getVerifiedSession(initData, { allowBanned: true });
    // Referral attribution is intentionally handled only by the bot webhook on /start,
    // never by opening a browser/Mini App URL. Only users who started the bot count.
    let referralCount = 0;
    let totalRegistered = 0;
    let referralRanking: any[] = [];
    try {
      const referrals = await supabaseRequest(`marketplace_users?referred_by=eq.${session.user.id}&bot_started_at=not.is.null&select=telegram_id`) as any[];
      referralCount = Array.isArray(referrals) ? referrals.length : 0;
      const users = await supabaseRequest("marketplace_users?miniapp_started_at=not.is.null&select=telegram_id&limit=10000") as any[];
      totalRegistered = Array.isArray(users) ? users.length : 0;
      if (["Владелец", "Заместитель владельца", "Администратор"].includes(session.role)) {
        const botUsers = await supabaseRequest("marketplace_users?bot_started_at=not.is.null&select=telegram_id,username,first_name,referred_by&limit=10000") as any[];
        const counts: Record<string, {telegramId:number;username:string;name:string;count:number}> = {};
        for (const row of botUsers || []) {
          const id = String(row.telegram_id);
          if (!counts[id]) counts[id] = { telegramId:Number(row.telegram_id), username:row.username || "", name:[row.first_name].filter(Boolean).join(" "), count:0 };
          if (row.referred_by) { const ref=String(row.referred_by); if (!counts[ref]) counts[ref]={telegramId:Number(ref),username:"",name:"",count:0}; counts[ref].count++; }
        }
        referralRanking = Object.values(counts).filter((r:any)=>r.count>0).sort((a:any,b:any)=>b.count-a.count).slice(0,500);
      }
    } catch { /* referral columns are deployed via updated schema */ }
    return NextResponse.json({ ...session, referralCount, totalRegistered, referralRanking }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const missingConfig = message.includes("not configured") || message.includes("must be configured");
    return NextResponse.json({ error: missingConfig ? "Серверная авторизация не настроена." : "Не удалось подтвердить сессию Telegram." }, { status: missingConfig ? 503 : 401, headers: { "Cache-Control": "no-store" } });
  }
}
