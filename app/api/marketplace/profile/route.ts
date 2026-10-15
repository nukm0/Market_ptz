import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getVerifiedSession(String(body?.initData || ""));
    const description = String(body?.description || "").trim().slice(0, 1000);
    const result = await supabaseRequest(`marketplace_users?telegram_id=eq.${session.user.id}`, {method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({profile_description:description,updated_at:new Date().toISOString()})}) as any[];
    return NextResponse.json({ok:true,description:result?.[0]?.profile_description ?? description});
  } catch (error) { const message = error instanceof Error ? error.message : "Request failed"; return NextResponse.json({error:message.includes("not configured")?"Серверная база не настроена.":"Не удалось сохранить описание."},{status:message.includes("not configured")?503:400}); }
}
