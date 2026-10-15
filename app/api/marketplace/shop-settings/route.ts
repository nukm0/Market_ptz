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
    const allowedThemes = ["banner-purple","banner-blue","banner-pink","banner-black"];
    const themeKey = allowedThemes.includes(String(body.themeKey)) ? String(body.themeKey) : "banner-purple";
    const logoTextColor = themeKey !== "banner-black" && body.logoTextColor === "#000000" ? "#000000" : "#ffffff";
    const optionalHttps = (value: unknown) => {
      if (!value) return null;
      const text = String(value).trim();
      if (text.length > 2000 || !/^https:\/\//i.test(text)) throw new Error("Изображения должны иметь HTTPS-ссылку.");
      return text;
    };
    const backgroundUrl = optionalHttps(body.backgroundUrl);
    const coverUrl = optionalHttps(body.coverUrl);
    const description = String(body.description || "").trim().slice(0, 2000);
    const result = await supabaseRequest(`marketplace_shops?id=eq.${encodeURIComponent(String(shop.id))}&owner_telegram_id=eq.${session.user.id}`, {method:"PATCH", headers:{Prefer:"return=representation"}, body:JSON.stringify({theme_key:themeKey,listing_theme_key:themeKey,logo_text_color:logoTextColor,background_url:backgroundUrl,cover_url:coverUrl,description})}) as any[];
    return NextResponse.json({ok:true,shop:result?.[0] || null},{headers:{"Cache-Control":"no-store"}});
  } catch (error) { const message = error instanceof Error ? error.message : "Request failed"; return NextResponse.json({error:message.includes("HTTPS")?message:message.includes("not configured")?"Серверная база не настроена.":"Не удалось сохранить оформление магазина."},{status:message.includes("not configured")?503:400}); }
}
