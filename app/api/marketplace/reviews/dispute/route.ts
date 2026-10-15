import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, sendTelegramMessage, supabaseRequest } from "../../../../../lib/telegram-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const OWNER_ID = 998579758;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getVerifiedSession(String(body?.initData || ""));
    const reviewId = String(body?.reviewId || "");
    const reason = String(body?.reason || "").trim().slice(0, 2000);
    if (!reviewId || !reason) return NextResponse.json({ error: "Укажите отзыв и причину оспаривания." }, { status: 400 });
    const rows = await supabaseRequest(`marketplace_reviews?id=eq.${encodeURIComponent(reviewId)}&select=*&limit=1`) as any[];
    const review = rows?.[0];
    if (!review) return NextResponse.json({ error: "Отзыв не найден." }, { status: 404 });
    if (!["approved", "disputed"].includes(String(review.status))) return NextResponse.json({ error: "Оспорить можно только опубликованный отзыв." }, { status: 409 });
    let isRecipient = Number(review.target_telegram_id) === session.user.id;
    if (review.target_type === "shop" && review.target_shop_id) {
      const shops = await supabaseRequest(`marketplace_shops?id=eq.${encodeURIComponent(String(review.target_shop_id))}&select=owner_telegram_id&limit=1`) as any[];
      isRecipient = Number(shops?.[0]?.owner_telegram_id) === session.user.id;
    }
    if (!isRecipient && session.user.id !== OWNER_ID) return NextResponse.json({ error: "Оспорить этот отзыв может только получатель оценки." }, { status: 403 });
    const updated = await supabaseRequest(`marketplace_reviews?id=eq.${encodeURIComponent(reviewId)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "disputed", dispute_text: reason }) }) as any[];
    const message = `Получено оспаривание отзыва (${review.stars}★) от ID ${session.user.id}.
Причина: ${reason}`;
    await supabaseRequest("marketplace_notifications", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ telegram_id: OWNER_ID, title: "Оспаривание отзыва", message, read: false }) }).catch(() => null);
    await sendTelegramMessage(OWNER_ID, message).catch(() => false);
    return NextResponse.json({ ok: true, review: Array.isArray(updated) ? updated[0] : null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const missingConfig = message.includes("not configured") || message.includes("must be configured");
    return NextResponse.json({ error: missingConfig ? "Серверная база не настроена." : "Не удалось отправить оспаривание." }, { status: missingConfig ? 503 : 400 });
  }
}
