import { NextRequest, NextResponse } from "next/server";
import { telegramMiniAppLink, miniAppWebUrl } from "../../../../lib/telegram-links";
import { getVerifiedSession, sendTelegramMessage, supabaseRequest } from "../../../../lib/telegram-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get("x-telegram-init-data") || "";
    const session = initData ? await getVerifiedSession(initData) : null;
    const reviewId = request.nextUrl.searchParams.get("review");
    if (reviewId) {
      const found = await supabaseRequest(`marketplace_reviews?id=eq.${encodeURIComponent(reviewId)}&select=*&limit=1`) as any[];
      const review = found?.[0];
      if (!review) return NextResponse.json({error:"Отзыв не найден."},{status:404});
      if (review.status !== "approved") return NextResponse.json({error:"Отзыв недоступен."},{status:404});
      if (!session) return NextResponse.json({error:"Откройте Mini App через Telegram."},{status:401});
      let allowed = Number(review.author_telegram_id) === session.user.id || Number(review.target_telegram_id) === session.user.id || session.user.id === 998579758;
      let shop: any = null;
      if (review.target_type === "shop" && review.target_shop_id) {
        const shops = await supabaseRequest(`marketplace_shops?id=eq.${encodeURIComponent(String(review.target_shop_id))}&select=id,name,owner_telegram_id&limit=1`) as any[];
        shop = shops?.[0] || null;
        allowed = allowed || Number(shop?.owner_telegram_id) === session.user.id;
      }
      if (!allowed) return NextResponse.json({error:"У вас нет доступа к этому отзыву."},{status:403});
      let targetUsername = "";
      if (review.target_type === "profile" && review.target_telegram_id) {
        const users = await supabaseRequest(`marketplace_users?telegram_id=eq.${review.target_telegram_id}&select=username,first_name&limit=1`) as any[];
        targetUsername = users?.[0]?.username || String(review.target_telegram_id);
      }
      return NextResponse.json({review,targetUsername,shop},{headers:{"Cache-Control":"no-store"}});
    }
    const type = request.nextUrl.searchParams.get("type") === "shop" ? "shop" : "profile";
    let target = request.nextUrl.searchParams.get("target") || String(session?.user.id || "0");
    if (type === "profile" && !/^\d+$/.test(target)) {
      const username = target.replace(/^@/, "").trim();
      const matched = await supabaseRequest(`marketplace_users?username=ilike.${encodeURIComponent(username)}&select=telegram_id&limit=1`) as any[];
      target = String(matched?.[0]?.telegram_id || "0");
    }
    if (type === "profile" && target === "998579758") return NextResponse.json({reviews:[],rating:5,canReview:false});
    const rows = type === "shop"
      ? await supabaseRequest(`marketplace_reviews?target_type=eq.shop&target_shop_id=eq.${encodeURIComponent(target)}&status=eq.approved&select=*&order=created_at.desc&limit=100`)
      : await supabaseRequest(`marketplace_reviews?target_type=eq.profile&target_telegram_id=eq.${encodeURIComponent(target)}&status=eq.approved&select=*&order=created_at.desc&limit=100`);
    const authorIds = Array.from(new Set((rows || []).map((review:any)=>String(review.author_telegram_id)).filter((id:string)=>/^\d+$/.test(id))));
    const authorRows = authorIds.length
      ? await supabaseRequest(`marketplace_users?telegram_id=in.(${authorIds.join(",")})&select=telegram_id,username,first_name&limit=500`).catch(()=>[]) as any[]
      : [];
    const authorsById = new Map((authorRows || []).map((author:any)=>[String(author.telegram_id),author]));
    const enriched = (rows || []).map((review:any) => {
      const author:any = authorsById.get(String(review.author_telegram_id)) || {};
      return { id:review.id, stars:review.stars, description:review.description, created_at:review.created_at, status:review.status, dispute_state:(Number(review.target_telegram_id)===session?.user.id||(review.target_type==="shop"&&String(session?.shop?.id)===String(review.target_shop_id)))?review.dispute_state:undefined, can_dispute:review.dispute_state==="none"&&(Number(review.target_telegram_id)===session?.user.id||(review.target_type==="shop"&&String(session?.shop?.id)===String(review.target_shop_id))), author_username: author.username || "", author_name: author.first_name || "" };
    });
    const summary=await supabaseRequest("rpc/marketplace_review_summary",{method:"POST",body:JSON.stringify({p_type:type,p_target:String(target)})});
    return NextResponse.json({reviews:enriched,...summary},{headers:{"Cache-Control":"no-store","Vary":"x-telegram-init-data"}});
  } catch (error) { const message = error instanceof Error ? error.message : "Request failed"; return NextResponse.json({error:message.includes("not configured")?"Серверная база не настроена.":"Не удалось загрузить отзывы."},{status:message.includes("not configured")?503:400}); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getVerifiedSession(String(body?.initData || ""));
    const type = body?.targetType === "shop" ? "shop" : "profile";
    const stars = Number(body?.stars);
    const description = String(body?.description || "").trim().slice(0, 2000);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5 || !description) return NextResponse.json({error:"Выберите оценку и напишите описание."},{status:400});
    const data: any = {author_telegram_id:session.user.id,target_type:type,stars,description,status:"pending",target_title:String(body?.targetTitle || "").slice(0,200)};
    if (type === "shop") data.target_shop_id = String(body?.targetShopId || ""); else {
      let targetId = Number(body?.targetTelegramId || 0);
      if (!Number.isSafeInteger(targetId) || targetId <= 0) {
        const username=String(body?.targetUsername||"").replace(/^@/,"").trim();
        if(username) { const rows=await supabaseRequest(`marketplace_users?username=ilike.${encodeURIComponent(username)}&select=telegram_id&limit=1`) as any[]; targetId=Number(rows?.[0]?.telegram_id||0); }
      }
      data.target_telegram_id=targetId;
    }
    if ((type === "shop" && !data.target_shop_id) || (type === "profile" && (!Number.isSafeInteger(data.target_telegram_id) || data.target_telegram_id <= 0))) return NextResponse.json({error:"Получатель не найден. Пользователь должен хотя бы раз открыть площадку через Telegram."},{status:400});
    if (type === "profile" && data.target_telegram_id === 998579758) return NextResponse.json({error:"Владельцу платформы нельзя оставлять отзывы."},{status:403});
    if (type === "profile" && data.target_telegram_id === session.user.id) return NextResponse.json({error:"Нельзя оставить отзыв самому себе."},{status:400});
    const result = await supabaseRequest("marketplace_reviews",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(data)});
    const review = Array.isArray(result) ? result[0] : result as any;
    return NextResponse.json({ok:true,review},{status:201});
  } catch (error) { const message = error instanceof Error ? error.message : "Request failed"; return NextResponse.json({error:message.includes("not configured")?"Серверная база не настроена.":"Не удалось отправить отзыв."},{status:message.includes("not configured")?503:400}); }
}
