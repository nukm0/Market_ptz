import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request.headers.get("x-telegram-init-data") || "", { allowBanned: true });
    const rows = await supabaseRequest(`marketplace_notifications?telegram_id=eq.${session.user.id}&select=id,title,message,read,created_at,action_url&order=created_at.desc&limit=100`) as any[];
    return NextResponse.json({ notifications: (rows || []).map((r:any)=>({id:r.id,title:r.title,text:r.message,read:!!r.read,createdAt:r.created_at,actionUrl:r.action_url||""})) }, {headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({error:message.includes("not configured")?"Серверная база не подключена.":"Не удалось загрузить уведомления."},{status:message.includes("not configured")?503:401});
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getVerifiedSession(String(body?.initData || ""), { allowBanned: true });
    const action = String(body?.action || "mark_read");
    if (action === "mark_all_read") {
      await supabaseRequest(`marketplace_notifications?telegram_id=eq.${session.user.id}&read=eq.false`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ read: true, read_at: new Date().toISOString() })
      });
      return NextResponse.json({ ok: true, marked: "all" }, { headers: { "Cache-Control": "no-store" } });
    }
    const id = String(body?.id || "");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Некорректный идентификатор уведомления." }, { status: 400 });
    await supabaseRequest(`marketplace_notifications?id=eq.${encodeURIComponent(id)}&telegram_id=eq.${session.user.id}&read=eq.false`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ read: true, read_at: new Date().toISOString() })
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message.includes("not configured") ? "Серверная база не подключена." : "Не удалось обновить уведомление." }, { status: message.includes("not configured") ? 503 : 400 });
  }
}
