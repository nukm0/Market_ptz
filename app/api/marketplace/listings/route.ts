import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, supabaseRequest } from "../../../../lib/telegram-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request.headers.get("x-telegram-init-data") || "", {allowBanned:true});
    const rows = await supabaseRequest("marketplace_listings?hidden=eq.false&select=*&order=created_at.desc&limit=500") as any[];
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
    return NextResponse.json({listings:(rows||[]).map((r:any)=>({id:Number(r.listing_id),title:r.title,category:r.category,sub:r.subcategory,price:Number(r.price)||0,views:viewCounts.get(String(r.listing_id)) ?? (Number(r.views) || 0),seller:Number(r.seller_telegram_id)===session.user.id?"you":(r.seller_username||String(r.seller_telegram_id)),sellerTelegramId:Number(r.seller_telegram_id),emoji:"📦",tone:"lavender",description:r.description||"",photos:Array.isArray(r.photo_urls)?r.photo_urls.length:0,photoUrls:r.photo_urls||[],listingType:r.listing_type||"Продажа",listingGroup:r.listing_group||"частное",shopId:r.shop_id||undefined}))},{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    const message=error instanceof Error?error.message:"Request failed";
    return NextResponse.json({error:message.includes("not configured")?"Серверная база не подключена.":"Не удалось загрузить объявления."},{status:message.includes("not configured")?503:401});
  }
}
