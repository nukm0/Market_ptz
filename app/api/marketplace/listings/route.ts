import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request.headers.get("x-telegram-init-data") || "", {allowBanned:true});
    const isStaff = ["Владелец","Заместитель владельца","Администратор","Модератор","Стажёр"].includes(session.role);
    const [rawRows, hiddenShops, moderation] = await Promise.all([
      supabaseRequest(`marketplace_listings?${isStaff?"":"hidden=eq.false&"}select=*&order=created_at.desc&limit=500`) as Promise<any[]>,
      supabaseRequest("marketplace_shops?hidden=eq.true&select=id") as Promise<any[]>,
      isStaff ? supabaseRequest("marketplace_listing_moderation?object_type=eq.listing&select=object_id,reviewed_by,reviewed_username,reviewed_name,reviewed_at,public_hidden&limit=5000") as Promise<any[]> : Promise.resolve([]),
    ]);
    const hiddenShopIds = new Set((hiddenShops||[]).map((s:any)=>String(s.id)));
    const rows = (rawRows||[]).filter((row:any)=>(row.publication_status!=="withdrawn"||Number(row.seller_telegram_id)===session.user.id||isStaff)&&(isStaff || String(row.shop_id)===String(session.shop?.id) || !hiddenShopIds.has(String(row.shop_id))));
    const reviewById = new Map((moderation||[]).map((m:any)=>[String(m.object_id),m]));
    const ids=(rows||[]).map((r:any)=>String(r.listing_id)).filter((id:string)=>/^\d{1,20}$/.test(id));
    let viewCounts = new Map<string,number>();
    if(ids.length){
      try {
        const quoted=ids.map(id=>`\"${id}\"`).join(",");
        try {
          const counts=await supabaseRequest(`marketplace_listing_view_counts?listing_id=in.(${encodeURIComponent(quoted)})&select=listing_id,view_count&limit=1000`) as any[];
          for(const row of counts||[]) viewCounts.set(String(row.listing_id),Number(row.view_count)||0);
        } catch {
          const views=await supabaseRequest(`marketplace_listing_views?listing_id=in.(${encodeURIComponent(quoted)})&select=listing_id&limit=10000`) as any[];
          for(const row of views||[]){const id=String(row.listing_id);viewCounts.set(id,(viewCounts.get(id)||0)+1)}
        }
      } catch {/* keep persisted legacy counter if analytics table hasn't been migrated yet */}
    }
    return NextResponse.json({listings:(rows||[]).map((r:any)=>({id:Number(r.listing_id),createdAt:r.created_at,publicationStatus:r.publication_status||"active",title:r.title,category:r.category,sub:r.subcategory,price:Number(r.price)||0,views:viewCounts.get(String(r.listing_id)) ?? (Number(r.views) || 0),seller:Number(r.seller_telegram_id)===session.user.id?"you":(r.seller_username||String(r.seller_telegram_id)),sellerTelegramId:Number(r.seller_telegram_id),emoji:"📦",tone:"lavender",description:r.description||"",photos:Array.isArray(r.photo_urls)?r.photo_urls.length:0,photoUrls:r.photo_urls||[],listingType:r.listing_type||"Продажа",listingGroup:r.listing_group||"частное",shopId:r.shop_id||undefined,...(isStaff?{reviewedBy:reviewById.get(String(r.listing_id))?.reviewed_by,reviewedUsername:reviewById.get(String(r.listing_id))?.reviewed_username,reviewedName:reviewById.get(String(r.listing_id))?.reviewed_name,reviewedAt:reviewById.get(String(r.listing_id))?.reviewed_at,moderationHidden:!!r.hidden||!!reviewById.get(String(r.listing_id))?.public_hidden}:{})}))},{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    const message=error instanceof Error?error.message:"Request failed";
    return NextResponse.json({error:message.includes("not configured")?"Серверная база не подключена.":"Не удалось загрузить объявления."},{status:message.includes("not configured")?503:401});
  }
}
