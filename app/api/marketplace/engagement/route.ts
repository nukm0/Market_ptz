import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Counts unique Telegram-authenticated visitors for a profile or shop.
 * A single visitor is counted once for the same target. Writes stay server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getVerifiedSession(String(body?.initData || ""), { allowBanned: true });
    const type = String(body?.type || "");

    if (type === "shop") {
      const shopId = String(body?.targetId || "");
      if (!/^[0-9a-f-]{36}$/i.test(shopId)) {
        return NextResponse.json({ error: "Некорректный ID магазина." }, { status: 400 });
      }
      const shopRows = await supabaseRequest(`marketplace_shops?id=eq.${encodeURIComponent(shopId)}&hidden=eq.false&select=id&limit=1`) as any[];
      if (!shopRows?.length) return NextResponse.json({ error: "Магазин не найден." }, { status: 404 });
      await supabaseRequest("marketplace_shop_views?on_conflict=shop_id,viewer_telegram_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ shop_id: shopId, viewer_telegram_id: session.user.id })
      });
      let views = 0;
      try {
        const counts = await supabaseRequest(`marketplace_shop_view_counts?shop_id=eq.${encodeURIComponent(shopId)}&select=view_count&limit=1`) as any[];
        views = Number(counts?.[0]?.view_count || 0);
      } catch {
        const rows = await supabaseRequest(`marketplace_shop_views?shop_id=eq.${encodeURIComponent(shopId)}&select=id&limit=10000`) as any[];
        views = Array.isArray(rows) ? rows.length : 0;
      }
      return NextResponse.json({ ok: true, type, views }, { headers: { "Cache-Control": "no-store" } });
    }

    if (type === "profile") {
      const target = String(body?.targetUsername ?? body?.targetTelegramId ?? "").trim().replace(/^@/, "");
      let targetId = /^\d{5,20}$/.test(target) ? Number(target) : 0;
      if (!targetId && /^[A-Za-z0-9_]{5,32}$/.test(target)) {
        const matched = await supabaseRequest(`marketplace_users?username=ilike.${encodeURIComponent(target)}&select=telegram_id&limit=1`) as any[];
        targetId = Number(matched?.[0]?.telegram_id || 0);
      }
      if (!Number.isSafeInteger(targetId) || targetId <= 0) {
        return NextResponse.json({ error: "Профиль не найден." }, { status: 404 });
      }
      await supabaseRequest("marketplace_profile_views?on_conflict=profile_telegram_id,viewer_telegram_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ profile_telegram_id: targetId, viewer_telegram_id: session.user.id })
      });
      let views = 0;
      try {
        const counts = await supabaseRequest(`marketplace_profile_view_counts?profile_telegram_id=eq.${targetId}&select=view_count&limit=1`) as any[];
        views = Number(counts?.[0]?.view_count || 0);
      } catch {
        const rows = await supabaseRequest(`marketplace_profile_views?profile_telegram_id=eq.${targetId}&select=id&limit=10000`) as any[];
        views = Array.isArray(rows) ? rows.length : 0;
      }
      return NextResponse.json({ ok: true, type, views }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ error: "Неизвестный тип просмотра." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const notConfigured = message.includes("not configured");
    return NextResponse.json({ error: notConfigured ? "Серверная база не подключена." : "Не удалось сохранить просмотр." }, { status: notConfigured ? 503 : 400 });
  }
}
