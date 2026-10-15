import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request.headers.get("x-telegram-init-data") || "", { allowBanned: true });
    const target = String(request.nextUrl.searchParams.get("target") || session.user.id).trim().replace(/^@/, "");
    let rows: any[];
    if (/^\d{5,20}$/.test(target)) {
      rows = await supabaseRequest(`marketplace_users?telegram_id=eq.${encodeURIComponent(target)}&select=telegram_id,username,first_name,photo_url,profile_description,profile_cover_url,profile_background_url,profile_text_color,profile_theme_key&limit=1`) as any[];
    } else {
      rows = await supabaseRequest(`marketplace_users?username=ilike.${encodeURIComponent(target)}&select=telegram_id,username,first_name,photo_url,profile_description,profile_cover_url,profile_background_url,profile_text_color,profile_theme_key&limit=1`) as any[];
    }
    const profile = rows?.[0];
    if (!profile) return NextResponse.json({ error: "Профиль не найден." }, { status: 404 });
    const id = Number(profile.telegram_id);
    const [subscriberRows, viewRows] = await Promise.all([
      supabaseRequest(`marketplace_profile_subscription_counts?target_telegram_id=eq.${id}&select=subscriber_count&limit=1`).catch(async () => {
        const rows = await supabaseRequest(`marketplace_profile_subscriptions?target_telegram_id=eq.${id}&select=subscriber_telegram_id&limit=10000`).catch(() => []) as any[];
        return [{ subscriber_count: rows.length }];
      }) as Promise<any[]>,
      supabaseRequest(`marketplace_profile_view_counts?profile_telegram_id=eq.${id}&select=view_count&limit=1`).catch(async () => {
        const rows = await supabaseRequest(`marketplace_profile_views?profile_telegram_id=eq.${id}&select=id&limit=10000`).catch(() => []) as any[];
        return [{ view_count: rows.length }];
      }) as Promise<any[]>,
    ]);
    const subscriberCount = Number(subscriberRows?.[0]?.subscriber_count || 0);
    const viewCount = Number(viewRows?.[0]?.view_count || 0);
    return NextResponse.json({ profile: {
      telegramId: id, username: profile.username || "", firstName: profile.first_name || "", photoUrl: profile.photo_url || "",
      description: profile.profile_description || "", coverUrl: profile.profile_cover_url || "", backgroundUrl: profile.profile_background_url || "",
      textColor: profile.profile_text_color || "#ffffff", themeKey: profile.profile_theme_key || "banner-purple",
      subscriberCount, views: viewCount,
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const missing = message.includes("not configured") || message.includes("must be configured");
    return NextResponse.json({ error: missing ? "Серверная база не настроена." : "Не удалось загрузить профиль." }, { status: missing ? 503 : 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getVerifiedSession(String(body?.initData || ""));
    const description = String(body?.description || "").trim().slice(0, 1000);
    const safeUrl = (value: unknown) => {
      if (!value) return null;
      const url = String(value).trim();
      if (url.length > 2000 || !/^https:\/\//i.test(url)) throw new Error("Изображения должны иметь HTTPS-ссылку.");
      return url;
    };
    const themeKey = ["banner-purple", "banner-blue", "banner-pink"].includes(String(body?.themeKey)) ? String(body.themeKey) : "banner-purple";
    const textColor = body?.textColor === "#000000" ? "#000000" : "#ffffff";
    const patch = {
      profile_description: description,
      profile_cover_url: safeUrl(body?.coverUrl),
      profile_background_url: safeUrl(body?.backgroundUrl),
      profile_text_color: textColor,
      profile_theme_key: themeKey,
      updated_at: new Date().toISOString(),
    };
    const result = await supabaseRequest(`marketplace_users?telegram_id=eq.${session.user.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) }) as any[];
    return NextResponse.json({ ok: true, description: result?.[0]?.profile_description ?? description, profileSettings: { coverUrl: result?.[0]?.profile_cover_url ?? patch.profile_cover_url ?? "", backgroundUrl: result?.[0]?.profile_background_url ?? patch.profile_background_url ?? "", textColor: result?.[0]?.profile_text_color ?? textColor, themeKey: result?.[0]?.profile_theme_key ?? themeKey } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const missing = message.includes("not configured") || message.includes("must be configured");
    return NextResponse.json({ error: message.includes("HTTPS") ? message : missing ? "Серверная база не настроена." : "Не удалось сохранить настройки профиля." }, { status: message.includes("HTTPS") ? 400 : missing ? 503 : 400 });
  }
}
