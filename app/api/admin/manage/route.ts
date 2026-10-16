import { NextRequest, NextResponse } from "next/server";
import { getVerifiedSession, sendTelegramMessage, supabaseConfig, supabaseRequest } from "../../../../lib/telegram-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const OWNER_ID = 998579758;
const STAFF_ROLES = ["Заместитель владельца", "Администратор", "Модератор", "Стажёр"];

function mayManage(role: string) {
  return ["Владелец", "Заместитель владельца", "Администратор"].includes(role);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getVerifiedSession(typeof body?.initData === "string" ? body.initData : "");
    const action = String(body?.action ?? "");
    const payload = body?.payload ?? {};
    const actorId = session.user.id;
    const owner = actorId === OWNER_ID;
    const leadership = owner || session.role === "Заместитель владельца";
    const admin = mayManage(session.role);
    const moderator = admin || session.role === "Модератор";
    const staff = moderator || session.role === "Стажёр";
    let result: unknown = null;

    if (action === "analytics") {
      if (!staff) return NextResponse.json({error:"Статистика доступна только администрации."},{status:403});
      const days=Number(payload.days);
      if (![7,30,90].includes(days)) return NextResponse.json({error:"Выберите период 7, 30 или 90 дней."},{status:400});
      result=await supabaseRequest("rpc/marketplace_analytics",{method:"POST",body:JSON.stringify({p_days:days})});
      return NextResponse.json({ok:true,result},{headers:{"Cache-Control":"no-store"}});
    } else if (action === "delete_own_listing") {
      const listingId = String(payload.listingId ?? "").trim();
      if (!/^\d{1,20}$/.test(listingId)) return NextResponse.json({error:"Некорректный ID объявления."},{status:400});
      const ownRows = await supabaseRequest(`marketplace_listings?listing_id=eq.${encodeURIComponent(listingId)}&select=listing_id,seller_telegram_id,listing_group,title&limit=1`) as any[];
      const own = ownRows?.[0];
      if (!own) return NextResponse.json({error:"Объявление не найдено в серверной базе."},{status:404});
      if (Number(own.seller_telegram_id)!==actorId || String(own.listing_group)==="магазина") return NextResponse.json({error:"Можно удалить только собственное частное объявление. Объявления магазина управляются в кабинете магазина."},{status:403});
      await Promise.all([
        supabaseRequest(`marketplace_listing_views?listing_id=eq.${encodeURIComponent(listingId)}`,{method:"DELETE",headers:{Prefer:"return=minimal"}}).catch(()=>null),
        supabaseRequest(`marketplace_listing_moderation?object_type=eq.listing&object_id=eq.${encodeURIComponent(listingId)}`,{method:"DELETE",headers:{Prefer:"return=minimal"}}).catch(()=>null),
      ]);
      result = await supabaseRequest(`marketplace_listings?listing_id=eq.${encodeURIComponent(listingId)}&seller_telegram_id=eq.${actorId}`,{method:"DELETE",headers:{Prefer:"return=representation"}});
    } else if (action === "delete_own_shop_listing") {
      const listingId = String(payload.listingId ?? "").trim();
      const ownShopId = String(session.shop?.id || "");
      if (!/^\d{1,20}$/.test(listingId)) return NextResponse.json({ error: "Некорректный ID объявления." }, { status: 400 });
      if (!ownShopId || Number(session.shop?.owner_telegram_id) !== actorId) return NextResponse.json({ error: "Нужна подтверждённая роль владельца магазина." }, { status: 403 });
      const rows = await supabaseRequest(`marketplace_listings?listing_id=eq.${encodeURIComponent(listingId)}&select=listing_id,shop_id,listing_group,title&limit=1`) as any[];
      const listing = rows?.[0];
      if (!listing) return NextResponse.json({ error: "Объявление не найдено." }, { status: 404 });
      if (String(listing.shop_id || "") !== ownShopId || String(listing.listing_group) !== "магазина") return NextResponse.json({ error: "Можно удалить только объявление своего магазина." }, { status: 403 });
      await Promise.all([
        supabaseRequest(`marketplace_listing_views?listing_id=eq.${encodeURIComponent(listingId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => null),
        supabaseRequest(`marketplace_listing_moderation?object_type=eq.listing&object_id=eq.${encodeURIComponent(listingId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => null),
        supabaseRequest(`marketplace_reports?object_type=eq.listing&object_id=eq.${encodeURIComponent(listingId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => null),
      ]);
      result = await supabaseRequest(`marketplace_listings?listing_id=eq.${encodeURIComponent(listingId)}&shop_id=eq.${encodeURIComponent(ownShopId)}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
      if (!Array.isArray(result) || result.length === 0) return NextResponse.json({ error: "Объявление уже удалено или не найдено." }, { status: 404 });
    } else if (action === "assign_role" || action === "remove_role") {
      if (!owner) return NextResponse.json({ error: "Назначать и снимать роли может только владелец платформы." }, { status: 403 });
      const targetId = Number(payload.telegramId);
      const role = String(payload.role ?? "Участник");
      if (!Number.isSafeInteger(targetId) || targetId <= 0 || targetId === OWNER_ID) return NextResponse.json({ error: "Недопустимый Telegram ID." }, { status: 400 });
      if (action === "remove_role" || role === "Участник") {
        await supabaseRequest(`marketplace_staff_roles?telegram_id=eq.${targetId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
        result = { telegramId: targetId, role: "Участник" };
      } else {
        if (!STAFF_ROLES.includes(role)) return NextResponse.json({ error: "Недопустимая роль." }, { status: 400 });
        await supabaseRequest("marketplace_staff_roles?on_conflict=telegram_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ telegram_id: targetId, role, assigned_by: actorId, updated_at: new Date().toISOString() }) });
        result = { telegramId: targetId, role };
      }
    } else if (action === "create_shop") {
      if (!admin) return NextResponse.json({ error: "Недостаточно прав для создания магазина." }, { status: 403 });
      const name = String(payload.name ?? "").trim();
      let ownerTelegramId = Number(payload.ownerTelegramId);
      if (!Number.isSafeInteger(ownerTelegramId) || ownerTelegramId <= 0) {
        const username = String(payload.ownerUsername ?? "").trim().replace(/^@/, "").toLowerCase();
        if (!username) return NextResponse.json({ error: "Укажите Telegram ID владельца. Username можно использовать, если пользователь уже открывал приложение." }, { status: 400 });
        const matching = await supabaseRequest(`marketplace_users?username=ilike.${encodeURIComponent(username)}&select=telegram_id&limit=1`) as any[];
        ownerTelegramId = Number(matching?.[0]?.telegram_id);
      }
      if (!name || !Number.isSafeInteger(ownerTelegramId) || ownerTelegramId <= 0) return NextResponse.json({ error: "Владелец не найден. Попросите его один раз открыть Mini App или укажите Telegram ID." }, { status: 400 });
      if (ownerTelegramId === OWNER_ID && !owner) return NextResponse.json({ error: "Назначить магазин аккаунту владельца может только сам владелец." }, { status: 403 });
      const existing = await supabaseRequest(`marketplace_shops?owner_telegram_id=eq.${ownerTelegramId}&select=id&limit=1`) as any[];
      if (existing?.length) return NextResponse.json({ error: "У этого пользователя уже есть магазин." }, { status: 409 });
      result = await supabaseRequest("marketplace_shops", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name, description: String(payload.description ?? "").trim(), logo_url: payload.logoUrl ?? null, owner_telegram_id: ownerTelegramId, created_by: actorId }) });
    } else if (action === "edit_shop") {
      if (!owner) return NextResponse.json({ error: "Изменять логотип, название и владельца магазина может только владелец платформы." }, { status: 403 });
      const shopId = String(payload.id || "");
      const name = String(payload.name || "").trim().slice(0,100);
      const description = String(payload.description || "").trim().slice(0,2000);
      const logoUrl = payload.logoUrl ? String(payload.logoUrl) : null;
      const nextOwner = Number(payload.ownerTelegramId);
      if (!shopId || !name || !Number.isSafeInteger(nextOwner) || nextOwner <= 0) return NextResponse.json({error:"Укажите магазин, название и корректный Telegram ID владельца."},{status:400});
      if (nextOwner === OWNER_ID && !owner) return NextResponse.json({error:"Назначить владельца платформы владельцем магазина может только владелец платформы."},{status:403});
      const occupied = await supabaseRequest(`marketplace_shops?owner_telegram_id=eq.${nextOwner}&id=neq.${encodeURIComponent(shopId)}&select=id&limit=1`) as any[];
      if (occupied?.length) return NextResponse.json({error:"У этого пользователя уже есть другой магазин."},{status:409});
      const existingShop = await supabaseRequest(`marketplace_shops?id=eq.${encodeURIComponent(shopId)}&select=id,owner_telegram_id,name&limit=1`) as any[];
      if (!existingShop?.length) return NextResponse.json({error:"Магазин не найден."},{status:404});
      if (logoUrl && !/^https:\/\//i.test(logoUrl)) return NextResponse.json({error:"Логотип должен быть HTTPS-ссылкой."},{status:400});
      result = await supabaseRequest("rpc/marketplace_transfer_shop", {method:"POST",body:JSON.stringify({p_shop_id:shopId,p_name:name,p_description:description,p_logo_url:logoUrl,p_owner_id:nextOwner,p_actor_id:actorId})});
    } else if (action === "list_reviews") {
      if (!staff) return NextResponse.json({error:"Недостаточно прав для просмотра отзывов."},{status:403});
      const reviews = await supabaseRequest("marketplace_reviews?select=*&order=created_at.desc&limit=500") as any[];
      const userIds = Array.from(new Set((reviews || []).flatMap((r:any)=>[r.author_telegram_id,r.target_telegram_id]).filter((id:any)=>id!==null&&id!==undefined&&Number(id)>0).map((id:any)=>String(Number(id)))));
      const shopIds = Array.from(new Set((reviews || []).map((r:any)=>r.target_shop_id).filter(Boolean).map(String)));
      const [users, shops] = await Promise.all([
        userIds.length ? supabaseRequest(`marketplace_users?telegram_id=in.(${userIds.join(",")})&select=telegram_id,username,first_name&limit=1000`).catch(()=>[]) as Promise<any[]> : Promise.resolve([]),
        shopIds.length ? supabaseRequest(`marketplace_shops?id=in.(${shopIds.join(",")})&select=id,name,owner_telegram_id&limit=1000`).catch(()=>[]) as Promise<any[]> : Promise.resolve([]),
      ]);
      const usersById = new Map((users || []).map((u:any)=>[String(u.telegram_id),u]));
      const shopsById = new Map((shops || []).map((shop:any)=>[String(shop.id),shop]));
      result = (reviews || []).filter((review:any)=>!(review.target_type==="profile"&&Number(review.target_telegram_id)===OWNER_ID)).map((review:any) => {
        const author:any = usersById.get(String(review.author_telegram_id)) || {};
        const target:any = usersById.get(String(review.target_telegram_id)) || {};
        const shop:any = shopsById.get(String(review.target_shop_id)) || {};
        return {
          id:review.id,
          author:author.username ? `@${String(author.username).replace(/^@/, "")}` : `ID ${review.author_telegram_id}`,
          authorId:Number(review.author_telegram_id),
          seller:review.target_type==="shop" ? (shop.name||review.target_title||"Магазин") : (target.username ? `@${String(target.username).replace(/^@/, "")}` : `ID ${review.target_telegram_id}`),
          targetType:review.target_type,
          targetId:review.target_type==="shop" ? review.target_shop_id : review.target_telegram_id,
          targetOwnerId:review.target_type==="shop" ? Number(shop.owner_telegram_id||0) : Number(review.target_telegram_id||0),
          targetTitle:review.target_title||"",
          stars:Number(review.stars), text:review.description, status:review.status,
          dispute:review.dispute_text||"", createdAt:review.created_at,
          moderatorComment:review.moderator_comment||""
        };
      });
    } else if (action === "review_decision") {
      if (!moderator) return NextResponse.json({error:"Недостаточно прав для модерации отзывов."},{status:403});
      const reviewId = String(payload.id || "");
      const decision = String(payload.decision || "");
      const statuses:Record<string,string> = {approve:"approved",reject:"rejected",hide:"hidden"};
      if (!reviewId || !statuses[decision]) return NextResponse.json({error:"Недопустимое решение по отзыву."},{status:400});
      const targetReviews = await supabaseRequest(`marketplace_reviews?id=eq.${encodeURIComponent(reviewId)}&select=target_type,target_telegram_id&limit=1`) as any[];
      if (targetReviews?.[0]?.target_type === "profile" && Number(targetReviews[0].target_telegram_id) === OWNER_ID) return NextResponse.json({error:"Отзывы владельцу платформы недоступны."},{status:400});
      result = await supabaseRequest(`marketplace_reviews?id=eq.${encodeURIComponent(reviewId)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status:statuses[decision],moderator_comment:String(payload.comment||"").slice(0,1000),reviewed_by:actorId,reviewed_at:new Date().toISOString()})});
      const review = Array.isArray(result) ? result[0] : null;
      if (review?.author_telegram_id) {
        const title = decision === "approve" ? "Отзыв одобрен" : decision === "reject" ? "Отзыв отклонён" : "Отзыв скрыт";
        const msg = decision === "approve" ? `Ваш отзыв (${review.stars}★) опубликован на Marketplace.` : decision === "reject" ? `Ваш отзыв (${review.stars}★) отклонён модерацией.${payload.comment?` Причина: ${String(payload.comment).slice(0,500)}`:""}` : `Ваш отзыв (${review.stars}★) скрыт модерацией.`;
        await supabaseRequest("marketplace_notifications",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({telegram_id:review.author_telegram_id,title,message:msg,read:false})}).catch(()=>{});
        await sendTelegramMessage(Number(review.author_telegram_id),msg).catch(()=>false);
      }
    } else if (action === "broadcast") {
      if (!owner) return NextResponse.json({error:"Массовые уведомления может отправлять только владелец платформы."},{status:403});
      const title = String(payload.title || "Объявление администрации").trim().slice(0,120);
      const message = String(payload.message || "").trim().slice(0,3500);
      const link = String(payload.url || "").trim();
      const imageUrl=String(payload.imageUrl||"").trim();
      if(imageUrl){
        const storage=supabaseConfig().url;
        if(!imageUrl.startsWith(`${storage}/storage/v1/object/public/marketplace-media/`)) return NextResponse.json({error:"Загрузите фото через выбор файла."},{status:400});
      }
      if (!message) return NextResponse.json({error:"Введите текст уведомления."},{status:400});
      if (link) { try { const parsed=new URL(link); if (!['https:','http:'].includes(parsed.protocol)) throw new Error(); } catch { return NextResponse.json({error:"Ссылка должна быть полным URL http:// или https://."},{status:400}); } }
      const users = await supabaseRequest("marketplace_users?select=telegram_id,bot_started_at&limit=10000") as any[];
      const validUsers = (users||[]).filter((u:any)=>Number.isSafeInteger(Number(u.telegram_id)) && Number(u.telegram_id)>0);
      const bodyText = `${message}${link?`\n\n${link}`:""}`;
      for (let i=0;i<validUsers.length;i+=200) {
        const batch=validUsers.slice(i,i+200);
        await Promise.all(batch.map((u:any)=>supabaseRequest("marketplace_notifications",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({telegram_id:Number(u.telegram_id),title,message:bodyText,read:false,action_url:link||null,image_url:imageUrl||null})}).catch(()=>null)));
      }
      const botUsers=validUsers.filter((u:any)=>u.bot_started_at);
      let sent=0;
      for(let i=0;i<botUsers.length;i+=20) {
        const outcomes=await Promise.all(botUsers.slice(i,i+20).map((u:any)=>sendTelegramMessage(Number(u.telegram_id),`📣 ${title}\n\n${message}`,link?[[{text:"Открыть в Telegram",url:link}]]:undefined,imageUrl||undefined).catch(()=>false)));
        sent+=outcomes.filter(Boolean).length;
      }
      result={registered:validUsers.length,botStarted:botUsers.length,botSent:sent};
    } else if (action === "toggle_banner" || action === "delete_banner") {
      if (!admin) return NextResponse.json({ error: "Недостаточно прав для управления баннерами." }, { status: 403 });
      const bannerId = String(payload.id ?? "");
      if (!bannerId) return NextResponse.json({ error: "Не указан баннер." }, { status: 400 });
      result = action === "delete_banner"
        ? await supabaseRequest(`marketplace_banners?id=eq.${encodeURIComponent(bannerId)}`, { method: "DELETE", headers: { Prefer: "return=representation" } })
        : await supabaseRequest(`marketplace_banners?id=eq.${encodeURIComponent(bannerId)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ hidden: !!payload.hidden }) });
    } else if (action === "toggle_shop" || action === "delete_shop") {
      if (!admin) return NextResponse.json({ error: "Недостаточно прав для управления магазинами." }, { status: 403 });
      const shopId = String(payload.id ?? "");
      if (!shopId) return NextResponse.json({ error: "Не указан магазин." }, { status: 400 });
      if (action === "delete_shop") {
        const shops = await supabaseRequest(`marketplace_shops?id=eq.${encodeURIComponent(shopId)}&select=id,name&limit=1`) as any[];
        const shop = shops?.[0];
        if (!shop) return NextResponse.json({ error: "Магазин не найден." }, { status: 404 });
        result = await supabaseRequest("rpc/marketplace_delete_shop", {method:"POST",body:JSON.stringify({p_shop_id:shopId,p_actor_id:actorId})});
      } else {
        result = await supabaseRequest(`marketplace_shops?id=eq.${encodeURIComponent(shopId)}`, { method:"PATCH", headers:{Prefer:"return=representation"}, body:JSON.stringify({hidden:!!payload.hidden}) });
      }
    } else if (action === "save_faq") {
      if (!admin) return NextResponse.json({ error: "Недостаточно прав для управления FAQ." }, { status: 403 });
      const entry = payload.entry ?? {};
      const question = String(entry.question ?? "").trim();
      const answer = String(entry.answer ?? "").trim();
      if (!question || !answer) return NextResponse.json({ error: "Заполните вопрос и ответ." }, { status: 400 });
      const faqBody = { section: String(entry.section ?? "Как пользоваться"), heading: String(entry.heading ?? "").trim(), parent_heading: String(entry.parent ?? "").trim(), question, answer, visible_roles: Array.isArray(entry.visibleRoles) && entry.visibleRoles.length ? entry.visibleRoles.filter((role:string)=>["all","Участник","Магазин","Стажёр","Модератор","Администратор","Заместитель владельца","Владелец"].includes(role)) : ["all"], created_by: actorId };
      result = entry.id
        ? await supabaseRequest(`marketplace_faq_entries?id=eq.${encodeURIComponent(String(entry.id))}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(faqBody) })
        : await supabaseRequest("marketplace_faq_entries", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(faqBody) });
    } else if (action === "delete_faq") {
      if (!admin) return NextResponse.json({ error: "Недостаточно прав для управления FAQ." }, { status: 403 });
      result = await supabaseRequest(`marketplace_faq_entries?id=eq.${encodeURIComponent(String(payload.id ?? ""))}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
    } else if (action === "create_banner") {
      if (!admin) return NextResponse.json({ error: "Недостаточно прав для управления баннерами." }, { status: 403 });
      const title = String(payload.title ?? "").trim();
      const targetUrl = String(payload.url ?? "").trim();
      if (!title) return NextResponse.json({ error: "Введите заголовок баннера." }, { status: 400 });
      if (targetUrl) {
        try { const url = new URL(targetUrl); if (!(["https:", "http:"].includes(url.protocol))) throw new Error(); }
        catch { return NextResponse.json({ error: "Ссылка должна быть полным адресом http:// или https://." }, { status: 400 }); }
      }
      result = await supabaseRequest("marketplace_banners", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ title, description: String(payload.description ?? ""), image_url: payload.imageUrl ?? null, target_url: targetUrl || null, show_home: !!payload.showHome, show_shops: !!payload.showShops, hidden: false, created_by: actorId }) });
    } else if (action === "verify_user") {
      if (!owner) return NextResponse.json({ error: "Верификацию может выдавать только владелец платформы." }, { status: 403 });
      const targetId = Number(payload.telegramId);
      const fullName = String(payload.fullName ?? "").trim();
      const phone = String(payload.phone ?? "").trim();
      const nickname = String(payload.nickname ?? "").trim();
      if (!Number.isSafeInteger(targetId) || targetId <= 0 || !fullName || !phone) return NextResponse.json({ error: "Укажите Telegram ID, ФИО и телефон." }, { status: 400 });
      result = await supabaseRequest(`marketplace_users?telegram_id=eq.${targetId}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ verified: true, verified_by: actorId, verified_at: new Date().toISOString(), verified_full_name: fullName, verified_phone: phone, verified_nickname: nickname || null }) });
      if (!Array.isArray(result) || result.length === 0) return NextResponse.json({ error: "Пользователь ещё не открывал Mini App. Попросите его войти один раз, затем повторите." }, { status: 404 });
    } else if (action === "delete_listing") {
      if (!admin) return NextResponse.json({ error: "Недостаточно прав для удаления объявлений." }, { status: 403 });
      const listingId = String(payload.listingId ?? "").trim();
      if (!/^\d{10,20}$/.test(listingId)) return NextResponse.json({ error: "Некорректный ID объявления." }, { status: 400 });
      const rows = await supabaseRequest(`marketplace_listings?listing_id=eq.${encodeURIComponent(listingId)}&select=listing_id,title`, { method: "DELETE", headers: { Prefer: "return=representation" } }) as any[];
      await Promise.all([
        supabaseRequest(`marketplace_listing_views?listing_id=eq.${encodeURIComponent(listingId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(()=>null),
        supabaseRequest(`marketplace_listing_moderation?object_type=eq.listing&object_id=eq.${encodeURIComponent(listingId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(()=>null),
      ]);
      if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "Объявление уже удалено или не найдено в серверной базе." }, { status: 404 });
      result = { listingId, title: rows[0].title || "" };
    } else if (action === "hide_from_admin_queue" || action === "mark_listing_reviewed") {
      if (!moderator) return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
      const objectId = String(payload.objectId || payload.listingId || "");
      if (!/^\d{1,20}$/.test(objectId)) return NextResponse.json({error:"Некорректный ID объявления."},{status:400});
      const existing = await supabaseRequest(`marketplace_listing_moderation?object_type=eq.listing&object_id=eq.${encodeURIComponent(objectId)}&select=public_hidden&limit=1`) as any[];
      result = await supabaseRequest("marketplace_listing_moderation?on_conflict=object_type,object_id", {method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({object_type:"listing",object_id:objectId,public_hidden:!!existing?.[0]?.public_hidden,admin_queue_hidden:false,reviewed_by:actorId,reviewed_username:session.user.username||null,reviewed_name:[session.user.first_name,session.user.last_name].filter(Boolean).join(" "),reviewed_at:new Date().toISOString(),updated_by:actorId,updated_at:new Date().toISOString()})});
    } else if (action === "submit_report") {
      const reason = String(payload.reason ?? "").trim();
      const details = String(payload.details ?? "").trim();
      if (!reason || !details) return NextResponse.json({ error: "Укажите причину жалобы и подробности." }, { status: 400 });
      let objectOwnerTelegramId = Number(payload.ownerTelegramId) > 0 ? Number(payload.ownerTelegramId) : null;
      const ownerUsername = String(payload.ownerUsername ?? "").replace(/^@/, "").slice(0, 100);
      if (!objectOwnerTelegramId && ownerUsername) {
        const ownerRows = await supabaseRequest(`marketplace_users?username=ilike.${encodeURIComponent(ownerUsername)}&select=telegram_id&limit=1`).catch(()=>[]) as any[];
        if (ownerRows?.[0]?.telegram_id) objectOwnerTelegramId = Number(ownerRows[0].telegram_id);
      }
      const rows = await supabaseRequest("marketplace_reports", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ reporter_telegram_id: actorId, object_type: String(payload.objectType ?? "listing"), object_id: payload.objectId ? String(payload.objectId) : null, object_title: String(payload.objectTitle ?? "").slice(0, 300), object_owner_username: ownerUsername || null, object_owner_telegram_id: objectOwnerTelegramId, reason, details, materials: Array.isArray(payload.materials) ? payload.materials : [], status: reason.toLowerCase().includes("мошеннич") ? "hidden_pending" : "new" }) }) as any[];
      result = rows?.[0] ?? null;
      if (reason.toLowerCase().includes("мошеннич") && payload.objectId) {
        const objectType = String(payload.objectType ?? "listing").slice(0, 40);
        const objectId = String(payload.objectId).slice(0, 100);
        const existing = await supabaseRequest(`marketplace_listing_moderation?object_type=eq.${encodeURIComponent(objectType)}&object_id=eq.${encodeURIComponent(objectId)}&select=admin_queue_hidden&limit=1`) as any[];
        await supabaseRequest("marketplace_listing_moderation?on_conflict=object_type,object_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ object_type: objectType, object_id: objectId, public_hidden: true, admin_queue_hidden: !!existing?.[0]?.admin_queue_hidden, reason: "Жалоба на мошенничество ожидает проверки", updated_by: actorId, updated_at: new Date().toISOString() }) });
      }
    } else if (action === "claim_report") {
      if (!moderator) return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
      const reportId = String(payload.reportId ?? "");
      const rows = await supabaseRequest(`marketplace_reports?id=eq.${encodeURIComponent(reportId)}&reviewer_telegram_id=is.null&status=in.(new,hidden_pending)&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "in_progress", reviewer_telegram_id: actorId, reviewer_username: session.user.username ?? null }) }) as any[];
      if (!rows?.length) return NextResponse.json({ error: "Жалобу уже взял другой сотрудник либо она закрыта." }, { status: 409 });
      result = rows[0];
    } else if (action === "report_recommendation") {
      if (!moderator) return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
      result = await supabaseRequest(`marketplace_reports?id=eq.${encodeURIComponent(String(payload.reportId ?? ""))}&reviewer_telegram_id=eq.${actorId}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ review_comment: String(payload.comment ?? ""), recommended_action: String(payload.recommendedAction ?? "none"), recommended_duration_minutes: Number(payload.durationMinutes) || null, status: "awaiting_owner" }) });
      if (!Array.isArray(result) || !result.length) return NextResponse.json({error:"Жалоба не закреплена за вами или уже передана."},{status:409});
    } else if (action === "reopen_report") {
      if (!leadership) return NextResponse.json({error:"Недостаточно прав."},{status:403});
      const previous = await supabaseRequest(`marketplace_reports?id=eq.${encodeURIComponent(String(payload.reportId||""))}&select=status,owner_telegram_id&limit=1`) as any[];
      if(!owner&&previous?.[0]?.status==="resolved"&&Number(previous[0].owner_telegram_id)===OWNER_ID)return NextResponse.json({error:"Заместитель не может отменить решение владельца."},{status:403});
      result = await supabaseRequest(`marketplace_reports?id=eq.${encodeURIComponent(String(payload.reportId||""))}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status:"new",reviewer_telegram_id:null,reviewer_username:null,owner_comment:String(payload.comment||""),resolved_at:null})});
    } else if (action === "owner_decision") {
      if (!leadership) return NextResponse.json({ error: "Окончательное решение принимает владелец или заместитель." }, { status: 403 });
      const decision = String(payload.decision ?? "no_action");
      const reportId = String(payload.reportId ?? "");
      if (!owner) {
        const existingReport = await supabaseRequest(`marketplace_reports?id=eq.${encodeURIComponent(reportId)}&select=status,owner_telegram_id&limit=1`) as any[];
        if (existingReport?.[0]?.status === "resolved" && Number(existingReport?.[0]?.owner_telegram_id) === OWNER_ID) {
          return NextResponse.json({ error: "Заместитель не может отменить окончательное решение владельца." }, { status: 403 });
        }
      }
      const targetId = Number(payload.targetTelegramId);
      if (decision === "hide_listing") {
        const objectType = String(payload.objectType ?? "listing").slice(0, 40);
        const objectId = String(payload.objectId ?? "").slice(0, 100);
        if (objectId) {
          const existing = await supabaseRequest(`marketplace_listing_moderation?object_type=eq.${encodeURIComponent(objectType)}&object_id=eq.${encodeURIComponent(objectId)}&select=admin_queue_hidden&limit=1`) as any[];
          await supabaseRequest("marketplace_listing_moderation?on_conflict=object_type,object_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ object_type: objectType, object_id: objectId, public_hidden: true, admin_queue_hidden: !!existing?.[0]?.admin_queue_hidden, reason: String(payload.comment ?? "Скрыто после проверки жалобы"), updated_by: actorId, updated_at: new Date().toISOString() }) });
        }
      }
      if (["temporary_ban", "permanent_ban"].includes(decision)) {
        if (!Number.isSafeInteger(targetId) || targetId <= 0 || targetId === OWNER_ID) return NextResponse.json({ error: "Для блокировки нужен Telegram ID владельца объекта жалобы." }, { status: 400 });
        const minutes = Number(payload.durationMinutes) || 0;
        const permanent = decision === "permanent_ban";
        if (!permanent && minutes <= 0) return NextResponse.json({ error: "Укажите длительность блокировки." }, { status: 400 });
        const banReason = String(payload.comment ?? "Нарушение правил");
        await supabaseRequest("marketplace_bans", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ telegram_id: targetId, reason: banReason, permanent, expires_at: permanent ? null : new Date(Date.now() + minutes * 60_000).toISOString(), active: true, created_by: actorId }) });
        const banDurationText = permanent ? "навсегда" : `до ${new Date(Date.now() + minutes * 60_000).toLocaleString("ru-RU")}`;
        const banMessage = `Ваш аккаунт Marketplace заблокирован ${banDurationText}. Причина: ${banReason}. Для обжалования напишите @nukm0 и укажите свой Telegram ID ${targetId}.`;
        await supabaseRequest("marketplace_notifications", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ telegram_id: targetId, title: "Аккаунт заблокирован", message: banMessage, read: false }) });
        await sendTelegramMessage(targetId, banMessage);
      }
      if (decision === "warning" && Number.isSafeInteger(targetId) && targetId > 0) {
        const warningMessage = String(payload.comment ?? "По результатам проверки вынесено предупреждение.");
        await supabaseRequest("marketplace_notifications", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ telegram_id: targetId, title: "Предупреждение по результатам проверки", message: warningMessage, read: false }) });
        await sendTelegramMessage(targetId, `Marketplace: предупреждение по результатам проверки. ${warningMessage}`);
      }
      result = await supabaseRequest(`marketplace_reports?id=eq.${encodeURIComponent(String(payload.reportId ?? ""))}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "resolved", owner_decision: decision, owner_comment: String(payload.comment ?? ""), owner_telegram_id: actorId, ...(Number.isSafeInteger(targetId) && targetId > 0 ? { object_owner_telegram_id: targetId } : {}), resolved_at: new Date().toISOString() }) });
      const finalizedReport = Array.isArray(result) ? result[0] : null;
      if (finalizedReport?.reporter_telegram_id) {
        const reportText = ["dismiss","no_action"].includes(decision) ? "Ваша жалоба была рассмотрена. Нарушение не подтвердилось по доступным материалам. Спасибо за содействие!" : "Ваша жалоба была рассмотрена, спасибо за содействие! Нарушитель был наказан!";
        await supabaseRequest("marketplace_notifications",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({telegram_id:Number(finalizedReport.reporter_telegram_id),title:"Жалоба рассмотрена",message:reportText,read:false})}).catch(()=>{});
        await sendTelegramMessage(Number(finalizedReport.reporter_telegram_id),reportText).catch(()=>false);
      }
    } else if (action === "search_users") {
      if (!admin) return NextResponse.json({ error: "Недостаточно прав для поиска пользователей." }, { status: 403 });
      const query = String(payload.query ?? "").trim().replace(/^@/, "");
      if (query.length < 2) return NextResponse.json({ error: "Введите не менее двух символов." }, { status: 400 });
      const digitsOnly = /^\d+$/.test(query);
      const encoded = encodeURIComponent(query.replace(/[(),]/g, ""));
      const filter = digitsOnly ? `telegram_id=eq.${encoded}` : `or=(username.ilike.*${encoded}*,first_name.ilike.*${encoded}*,last_name.ilike.*${encoded}*,verified_nickname.ilike.*${encoded}*)`;
      const users = await supabaseRequest(`marketplace_users?${filter}&select=telegram_id,username,first_name,last_name,photo_url,verified,verified_nickname,created_at,updated_at&order=created_at.desc&limit=30`) as any[];
      const rows = await Promise.all((users || []).map(async (user:any) => {
        const [bans, reports, views] = await Promise.all([
          supabaseRequest(`marketplace_bans?telegram_id=eq.${user.telegram_id}&active=eq.true&select=id,reason,permanent,expires_at,created_at&order=created_at.desc&limit=1`).catch(()=>[]) as Promise<any[]>,
          supabaseRequest(`marketplace_reports?object_owner_telegram_id=eq.${user.telegram_id}&select=id`).catch(()=>[]) as Promise<any[]>,
          supabaseRequest(`marketplace_listing_views?viewer_telegram_id=eq.${user.telegram_id}&select=id`).catch(()=>[]) as Promise<any[]>
        ]);
        const active = Array.isArray(bans) ? bans.find((b:any)=>b.permanent || !b.expires_at || new Date(b.expires_at).getTime()>Date.now()) : null;
        return {...user,active_ban:active||null,report_count:Array.isArray(reports)?reports.length:0,listing_views:Array.isArray(views)?views.length:0,listing_count:0};
      }));
      result = rows;
    } else if (action === "set_shop_order") {
      if (!admin) return NextResponse.json({ error: "Недостаточно прав для изменения размещения магазинов." }, { status: 403 });
      const orders = Array.isArray(payload.orders) ? payload.orders.slice(0, 200) : [];
      const valid = orders.filter((item:any)=>item && typeof item.id === "string" && /^[0-9a-f-]{36}$/i.test(item.id));
      await Promise.all(valid.map((item:any,index:number)=>supabaseRequest(`marketplace_shops?id=eq.${encodeURIComponent(item.id)}`, { method:"PATCH", headers:{Prefer:"return=minimal"}, body:JSON.stringify({display_order:index}) })));
      result = { saved: valid.length };
    } else if (action === "clear_bans") {
      if (!leadership) return NextResponse.json({ error: "Снимать блокировки может владелец или заместитель." }, { status: 403 });
      const targetId = Number(payload.telegramId);
      if (!Number.isSafeInteger(targetId) || targetId <= 0 || targetId === OWNER_ID) return NextResponse.json({ error: "Недопустимый Telegram ID." }, { status: 400 });
      result = await supabaseRequest(`marketplace_bans?telegram_id=eq.${targetId}&active=eq.true`, { method:"PATCH", headers:{Prefer:"return=representation"}, body:JSON.stringify({active:false}) });
      await supabaseRequest("marketplace_notifications", { method:"POST", headers:{Prefer:"return=minimal"}, body:JSON.stringify({telegram_id:targetId,title:"Ограничения сняты",message:"Активные ограничения вашего аккаунта Marketplace сняты администрацией.",read:false}) });
      await sendTelegramMessage(targetId,"Marketplace: ограничения вашего аккаунта сняты администрацией.").catch(()=>{});
    } else if (action === "set_ban") {
      if (!leadership) return NextResponse.json({ error: "Блокировку может назначить владелец или заместитель." }, { status: 403 });
      const targetId = Number(payload.telegramId);
      if (!Number.isSafeInteger(targetId) || targetId <= 0 || targetId === OWNER_ID) return NextResponse.json({ error: "Недопустимый Telegram ID." }, { status: 400 });
      const permanent = !!payload.permanent;
      const durationMinutes = Number(payload.durationMinutes) || 0;
      if (!permanent && durationMinutes <= 0) return NextResponse.json({ error: "Укажите длительность блокировки." }, { status: 400 });
      const expiresAt = permanent ? null : new Date(Date.now() + durationMinutes * 60_000).toISOString();
      const banReason = String(payload.reason ?? "Нарушение правил");
      result = await supabaseRequest("marketplace_bans", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ telegram_id: targetId, reason: banReason, permanent, expires_at: expiresAt, active: true, created_by: actorId }) });
      const durationText = permanent ? "навсегда" : `до ${new Date(expiresAt!).toLocaleString("ru-RU")}`;
      const banMessage = `Ваш аккаунт Marketplace заблокирован ${durationText}. Причина: ${banReason}. Для обжалования напишите @nukm0 и укажите свой Telegram ID ${targetId}.`;
      await supabaseRequest("marketplace_notifications", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ telegram_id: targetId, title: "Аккаунт заблокирован", message: banMessage, read: false }) });
      await sendTelegramMessage(targetId, banMessage);
    } else {
      return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });
    }

    await supabaseRequest("marketplace_admin_audit", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ actor_telegram_id: actorId, actor_username: session.user.username ?? null, actor_name: [session.user.first_name, session.user.last_name].filter(Boolean).join(" "), action, target: JSON.stringify(payload).slice(0, 2000), created_at: new Date().toISOString() }) });
    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const missingConfig = message.includes("not configured") || message.includes("must be configured");
    console.error("Admin action failed", message.replace(/https?:\/\/[^\s]+/g,"[url]"));
    const banned = message.includes("Account is banned");
    return NextResponse.json({ error: missingConfig ? "Серверная база не подключена." : banned ? "Аккаунт заблокирован." : "Не удалось выполнить действие." }, { status: missingConfig ? 503 : banned ? 403 : 400, headers: { "Cache-Control": "no-store" } });
  }
}
