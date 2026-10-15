import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getVerifiedSession(typeof body?.initData === "string" ? body.initData : "");
    const listingId = String(body?.listingId ?? "").trim().slice(0,120);
    const seller = String(body?.seller ?? "").trim().slice(0,120);
    if (!listingId) return NextResponse.json({ error: "Не указан объект просмотра." }, { status: 400 });
    await supabaseRequest("marketplace_listing_views", { method:"POST", headers:{Prefer:"resolution=merge-duplicates,return=minimal"}, body:JSON.stringify({ listing_id:listingId, seller_username:seller || null, viewer_telegram_id:session.user.id }) });
    const views = await supabaseRequest(`marketplace_listing_views?listing_id=eq.${encodeURIComponent(listingId)}&select=id`) as any[];
    return NextResponse.json({ ok:true, views:Array.isArray(views)?views.length:0 }, { headers:{"Cache-Control":"no-store"} });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message.includes("not configured") ? "Серверная база не подключена." : "Не удалось сохранить просмотр." }, { status: 400, headers:{"Cache-Control":"no-store"} });
  }
}
