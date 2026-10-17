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
    await supabaseRequest("marketplace_listing_views?on_conflict=listing_id,viewer_telegram_id", { method:"POST", headers:{Prefer:"resolution=merge-duplicates,return=minimal"}, body:JSON.stringify({ listing_id:listingId, seller_username:seller || null, viewer_telegram_id:session.user.id }) });
    await supabaseRequest("rpc/marketplace_track_listing",{method:"POST",body:JSON.stringify({p_actor:session.user.id,p_listing:listingId,p_kind:"view"})}).catch(()=>null);
    let views = 0;
    try {
      const counts = await supabaseRequest(`marketplace_listing_view_counts?listing_id=eq.${encodeURIComponent(listingId)}&select=view_count&limit=1`) as any[];
      views = Number(counts?.[0]?.view_count || 0);
    } catch {
      const rows = await supabaseRequest(`marketplace_listing_views?listing_id=eq.${encodeURIComponent(listingId)}&select=id&limit=10000`) as any[];
      views = Array.isArray(rows) ? rows.length : 0;
    }
    return NextResponse.json({ ok:true, views }, { headers:{"Cache-Control":"no-store"} });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message.includes("not configured") ? "Серверная база не подключена." : "Не удалось сохранить просмотр." }, { status: 400, headers:{"Cache-Control":"no-store"} });
  }
}
