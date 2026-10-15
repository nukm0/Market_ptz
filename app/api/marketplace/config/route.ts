import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    let isStaff = false;
    const initData = request.headers.get("x-telegram-init-data") || "";
    if (initData) {
      try {
        const session = await getVerifiedSession(initData);
        isStaff = ["Владелец", "Заместитель владельца", "Администратор", "Модератор", "Стажёр"].includes(session.role);
      } catch { isStaff = false; }
    }
    const bannerQuery = isStaff
      ? "marketplace_banners?select=id,title,description,image_url,target_url,show_home,show_shops,hidden,created_at&order=created_at.desc"
      : "marketplace_banners?hidden=eq.false&select=id,title,description,image_url,target_url,show_home,show_shops,hidden,created_at&order=created_at.desc";
    const shopQuery = isStaff
      ? "marketplace_shops?select=id,name,description,logo_url,owner_telegram_id,created_at,hidden,display_order,theme_key,logo_text_color,background_url&order=display_order.asc,created_at.desc"
      : "marketplace_shops?hidden=eq.false&select=id,name,description,logo_url,owner_telegram_id,created_at,hidden,display_order,theme_key,logo_text_color,background_url&order=display_order.asc,created_at.desc";
    const [banners, shops, faq, moderation, countsView] = await Promise.all([
      supabaseRequest(bannerQuery) as Promise<any[]>,
      supabaseRequest(shopQuery) as Promise<any[]>,
      supabaseRequest("marketplace_faq_entries?select=id,section,heading,parent_heading,question,answer,created_at&order=created_at.asc&limit=1000") as Promise<any[]>,
      supabaseRequest("marketplace_listing_moderation?select=object_type,object_id,public_hidden,admin_queue_hidden&limit=5000") as Promise<any[]>,
      supabaseRequest("marketplace_shop_subscription_counts?select=shop_id,subscriber_count").catch(()=>null) as Promise<any[]|null>,
    ]);
    // Older installations may not have run the optimized aggregate-view migration yet.
    // Fall back to a single subscriptions query so the shop directory still loads.
    const subscriptionRows = countsView === null
      ? await supabaseRequest("marketplace_shop_subscriptions?select=shop_id,telegram_id&limit=10000").catch(()=>[]) as any[]
      : [];
    const rawCounts = countsView ?? Array.from((subscriptionRows || []).reduce((map:Map<string,number>, row:any) => {
      const key=String(row.shop_id); map.set(key,(map.get(key)||0)+1); return map;
    }, new Map<string,number>()).entries()).map(([shop_id,subscriber_count])=>({shop_id,subscriber_count}));
    const ownerIds = Array.from(new Set((shops || []).map((s:any)=>Number(s.owner_telegram_id)).filter((id:number)=>Number.isSafeInteger(id)&&id>0)));
    const ownerRows = ownerIds.length
      ? await supabaseRequest(`marketplace_users?telegram_id=in.(${ownerIds.join(",")})&select=telegram_id,username,first_name&limit=${Math.min(ownerIds.length,1000)}`).catch(()=>[]) as any[]
      : [];
    const owners = new Map((ownerRows || []).map((u:any)=>[String(u.telegram_id),u]));
    const counts = new Map((rawCounts || []).map((s:any)=>[String(s.shop_id),Number(s.subscriber_count)||0]));
    return NextResponse.json({
      banners: (banners || []).map((b:any) => ({ id:b.id, title:b.title, sub:b.description, kicker:"MARKETPLACE · ОБЪЯВЛЕНИЕ", color:"banner-purple", url:b.target_url||"", image:b.image_url||"", home:!!b.show_home, shops:!!b.show_shops, hidden:!!b.hidden, createdAt:b.created_at })),
      shops: (shops || []).map((s:any) => { const user:any=owners.get(String(s.owner_telegram_id))||{}; const username=String(user.username||"").replace(/^@/,""); return { id:s.id, name:s.name, ownerTelegramId:Number(s.owner_telegram_id), ownerUsername:username, owner:username?`@${username}`:`ID: ${s.owner_telegram_id}`, description:s.description||"", logo:s.logo_url||"", logo_url:s.logo_url||"", theme_key:s.theme_key||"banner-purple", logo_text_color:s.logo_text_color||"#ffffff", background_url:s.background_url||"", createdAt:s.created_at, hidden:!!s.hidden, displayOrder:Number(s.display_order??9999), subscriberCount:counts.get(String(s.id))||0 }; }),
      faq: (faq || []).map((f:any) => ({ id:f.id, section:f.section, heading:f.heading||"", parent:f.parent_heading||"", question:f.question, answer:f.answer, createdAt:f.created_at })),
      hiddenListingIds: (moderation || []).filter((m:any)=>m.public_hidden).map((m:any)=>String(m.object_id)),
      adminQueueHiddenIds: isStaff ? (moderation || []).filter((m:any)=>m.admin_queue_hidden).map((m:any)=>String(m.object_id)) : [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ banners: [], shops: [], faq: [], hiddenListingIds: [], adminQueueHiddenIds: [], persistenceConfigured: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
