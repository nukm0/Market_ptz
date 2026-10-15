import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getVerifiedSession(String(body?.initData || ""));
    const shop = session.shop;
    if (!shop?.id || Number(shop.owner_telegram_id) !== session.user.id) return NextResponse.json({error:"Только подтверждённый владелец магазина может менять оформление."},{status:403});
    const allowedThemes = ["banner-purple","banner-blue","banner-orange"];
    const themeKey = allowedThemes.includes(String(body.themeKey)) ? String(body.themeKey) : "banner-purple";
    const logoTextColor = body.logoTextColor === "#000000" ? "#000000" : "#ffffff";
    const backgroundUrl = typeof body.backgroundUrl === "string" && /^https:\/\//i.test(body.backgroundUrl) ? body.backgroundUrl : null;
    const result = await supabaseRequest(`marketplace_shops?id=eq.${encodeURIComponent(String(shop.id))}&owner_telegram_id=eq.${session.user.id}`, {method:"PATCH", headers:{Prefer:"return=representation"}, body:JSON.stringify({theme_key:themeKey,logo_text_color:logoTextColor,background_url:backgroundUrl})}) as any[];
    return NextResponse.json({ok:true,shop:result?.[0] || null},{headers:{"Cache-Control":"no-store"}});
  } catch (error) { const message = error instanceof Error ? error.message : "Request failed"; return NextResponse.json({error:message.includes("not configured")?"Серверная база не настроена.":"Не удалось сохранить оформление магазина."},{status:message.includes("not configured")?503:400}); }
}
