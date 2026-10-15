import { NextRequest, NextResponse } from "next/server";
import { APP_URL, BOT_USERNAME, GROUP_URL, miniAppWebUrl } from "../../../../lib/telegram-links";
import { sendTelegramMessage, supabaseRequest } from "../../../../lib/telegram-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const OWNER_ID = 998579758;
const botToken = () => process.env.TELEGRAM_BOT_TOKEN || "";
async function callTelegram(method:string, payload:Record<string,unknown>) {
  const token=botToken(); if(!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});
  const data=await response.json(); if(!response.ok || !data?.ok) throw new Error(data?.description||"Telegram API request failed"); return data.result;
}
const keyboard = {inline_keyboard:[
  [{text:"Открыть Marketplace",web_app:{url:APP_URL}}],
  [{text:"Магазины",callback_data:"shops"},{text:"Мои подписки",callback_data:"subscriptions"}],
  [{text:"Мой профиль",web_app:{url:miniAppWebUrl("page","profile")}},{text:"Опубликовать",web_app:{url:miniAppWebUrl("page","publish")}}],
  [{text:"Рефералы",callback_data:"ref"},{text:"Статистика",callback_data:"stats"}],
  [{text:"Команда",callback_data:"moderators"},{text:"Помощь",web_app:{url:miniAppWebUrl("page","faq")}}],
  [{text:"Группа маркетплейса",url:GROUP_URL},{text:"Жалоба на модерацию",callback_data:"complaint"}],
]};
function formatBotText(text:string) {
  const escaped=text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const newline=escaped.indexOf("\n");
  return newline<0 ? `<b>${escaped}</b>` : `<b>${escaped.slice(0,newline)}</b>${escaped.slice(newline)}`;
}
async function send(chatId:number,text:string,reply_markup:any=keyboard) {
  const kind=text.includes("магазин")||text.includes("Магазин")?"shops":text.includes("статист")?"stats":text.includes("ссылк")?"ref":text.includes("жалоб")?"support":"menu";
  try {const result=await callTelegram("sendPhoto",{chat_id:chatId,photo:`${APP_URL}/api/telegram/card?kind=${kind}`,caption:formatBotText(text.slice(0,1000)),parse_mode:"HTML",reply_markup});if(text.length>1000)await callTelegram("sendMessage",{chat_id:chatId,text:formatBotText(text.slice(1000,5000)),parse_mode:"HTML",reply_markup});return result;}
  catch {return callTelegram("sendMessage",{chat_id:chatId,text:formatBotText(text.slice(0,4000)),parse_mode:"HTML",disable_web_page_preview:true,reply_markup});}
}
export async function GET() { return NextResponse.json({ok:true,service:"Marketplace Telegram bot webhook"}); }
export async function POST(request:NextRequest) {
  const expected=process.env.TELEGRAM_WEBHOOK_SECRET;
  if(expected && request.headers.get("x-telegram-bot-api-secret-token")!==expected) return NextResponse.json({error:"forbidden"},{status:403});
  try {
    const update=await request.json();
    const callback=update?.callback_query;
    if(callback?.id) await callTelegram("answerCallbackQuery",{callback_query_id:callback.id}).catch(()=>null);
    const message=update?.message || callback?.message;
    if(!(callback?.from?.id || message?.from?.id) || !message?.chat?.id) return NextResponse.json({ok:true});
    const user=callback?.from || message.from; const chatId=Number(message.chat.id); const userId=Number(user.id);
    const rawText=callback?.data ? "/"+String(callback.data) : String(message.text||"").trim(); const text=rawText.toLowerCase();
    const startTarget=rawText.match(/^\/start(?:@\w+)?\s+(ad|shop|review|profile|page)_([A-Za-z0-9_-]+)$/i);
    const startMatch=rawText.match(/^\/start(?:@\w+)?(?:\s+([0-9]{1,20}))?/i);
    if(startMatch) {
      // Older webhook installations subscribed only to messages, excluding inline buttons.
      // Keep the existing endpoint and secret while adding callback delivery.
      try {
        const webhook=await callTelegram("getWebhookInfo",{});
        if(webhook?.url && Array.isArray(webhook.allowed_updates) && webhook.allowed_updates.length>0 && !webhook.allowed_updates.includes("callback_query")) {
          await callTelegram("setWebhook",{
            url:webhook.url,
            allowed_updates:Array.from(new Set([...webhook.allowed_updates,"message","callback_query"])),
            ...(expected?{secret_token:expected}:{}),
            ...(webhook.max_connections?{max_connections:webhook.max_connections}:{})
          });
        }
      } catch { console.error("Telegram inline button subscription repair failed"); }
      const ref=Number(startMatch[1]||0);
      const existed=await supabaseRequest(`marketplace_users?telegram_id=eq.${userId}&select=telegram_id,referred_by,bot_started_at&limit=1`).catch(()=>[]) as any[];
      const firstBotStart=!existed?.[0]?.bot_started_at;
      const body:any={telegram_id:userId,username:user.username||null,first_name:user.first_name||null,last_name:user.last_name||null,bot_started_at:existed?.[0]?.bot_started_at||new Date().toISOString(),bot_pending_action:null,updated_at:new Date().toISOString()};
      if(firstBotStart && !existed?.[0]?.referred_by && Number.isSafeInteger(ref) && ref>0 && ref!==userId) {
        const referrer=await supabaseRequest(`marketplace_users?telegram_id=eq.${ref}&select=telegram_id&limit=1`).catch(()=>[]) as any[];
        if(referrer?.length) { body.referred_by=ref; body.referral_attributed_at=new Date().toISOString(); }
      }
      await supabaseRequest("marketplace_users?on_conflict=telegram_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(body)});
      const botName=(process.env.TELEGRAM_BOT_USERNAME||BOT_USERNAME).replace(/^@/,"");
      const referral=botName?`https://t.me/${botName}?start=${userId}`:"Ссылка появится после настройки TELEGRAM_BOT_USERNAME.";
      if(startTarget){await send(chatId,"Открыть выбранный раздел внутри Telegram:",{inline_keyboard:[[{text:"Открыть Mini App",web_app:{url:miniAppWebUrl(startTarget[1].toLowerCase(),startTarget[2])}}],[{text:"Главное меню",callback_data:"menu"}]]});return NextResponse.json({ok:true});}
      await callTelegram("sendMessage",{chat_id:chatId,text:"Меню Marketplace обновлено",reply_markup:{remove_keyboard:true}});
      await send(chatId,`Marketplace · Главное меню\n\nПокупай, продавай и находи своё.\n\n▫️ Объявления и магазины\n▫️ Подписки и уведомления\n▫️ Отзывы и поддержка\n\nТвоя ссылка для приглашений:\n${referral}\n\nВыбери раздел кнопками ниже ↓`,keyboard);
      return NextResponse.json({ok:true});
    }
    if(["🔗 моя реферальная ссылка","/ref","реферальная ссылка"].includes(text)) {
      const botName=(process.env.TELEGRAM_BOT_USERNAME||BOT_USERNAME).replace(/^@/,"");
      await send(chatId,botName?`Твоя ссылка для приглашений:\nhttps://t.me/${botName}?start=${userId}\n\nВ зачёт попадут только новые пользователи, которые откроют бота и нажмут «Старт».`:`Настройте TELEGRAM_BOT_USERNAME в Vercel, чтобы сформировать персональную ссылку.`); return NextResponse.json({ok:true});
    }
    if(["🏪 магазины","/shops","магазины"].includes(text)) {
      const shops=await supabaseRequest("marketplace_shops?hidden=eq.false&select=id,name,description,owner_telegram_id&order=display_order.asc,created_at.desc&limit=80").catch(()=>[]) as any[];
      const appUrl=(process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL||APP_URL).replace(/\/$/,"");
      if(!shops.length) { await send(chatId,"Пока нет опубликованных магазинов.",keyboard); return NextResponse.json({ok:true}); }
      if(appUrl) {
        const rows=shops.map((shop:any)=>[{text:`🏪 ${String(shop.name).slice(0,50)}`,web_app:{url:miniAppWebUrl("shop",String(shop.id))}}]);
        await send(chatId,"Магазины Marketplace — выбери нужный, чтобы открыть его витрину:",{inline_keyboard:rows});
      } else await send(chatId,shops.map((s:any,i:number)=>`${i+1}. ${s.name}${s.description?` — ${s.description}`:""}`).join("\n")+"\n\nСсылка на Mini App пока не настроена.",keyboard);
      return NextResponse.json({ok:true});
    }
    if(["📚 мои подписки","/subscriptions","подписки"].includes(text)) {
      const [profileSubs, shopSubs] = await Promise.all([
        supabaseRequest(`marketplace_profile_subscriptions?subscriber_telegram_id=eq.${userId}&select=target_telegram_id`).catch(()=>[]) as Promise<any[]>,
        supabaseRequest(`marketplace_shop_subscriptions?telegram_id=eq.${userId}&select=shop_id`).catch(()=>[]) as Promise<any[]>
      ]);
      const profileLines = await Promise.all((profileSubs||[]).map(async (row:any)=>{
        const targetRows=await supabaseRequest(`marketplace_users?telegram_id=eq.${row.target_telegram_id}&select=username,first_name&limit=1`).catch(()=>[]) as any[];
        const target=targetRows?.[0]||{}; return `• ${target.username?"@"+target.username:[target.first_name,""].filter(Boolean).join("")||"Профиль"} (ID ${row.target_telegram_id})`;
      }));
      const shopLines = await Promise.all((shopSubs||[]).map(async (row:any)=>{
        const targetRows=await supabaseRequest(`marketplace_shops?id=eq.${encodeURIComponent(String(row.shop_id))}&select=name&limit=1`).catch(()=>[]) as any[];
        return targetRows?.[0]?.name ? `• 🏪 ${targetRows[0].name}` : "";
      }));
      const all=[...profileLines,...shopLines.filter(Boolean)];
      await send(chatId,all.length?`Твои подписки:
${all.join("\n")}

Новые публикации по этим подпискам придут в этот чат, если бот запущен.`:"Пока нет подписок. Открой Marketplace, перейди в профиль или магазин и нажми «Подписаться».",keyboard);
      return NextResponse.json({ok:true});
    }
    if(["👥 кто модератор?","/moderators","модераторы"].includes(text)) {
      const roles=await supabaseRequest("marketplace_staff_roles?select=telegram_id,role&order=role.asc&limit=100").catch(()=>[]) as any[];
      const users=await Promise.all((roles||[]).map(async (r:any)=>{const rows=await supabaseRequest(`marketplace_users?telegram_id=eq.${r.telegram_id}&select=username,first_name,last_name&limit=1`).catch(()=>[]) as any[];const u=rows?.[0]||{};return `• ${u.username?"@"+u.username:[u.first_name,u.last_name].filter(Boolean).join(" ")||"Пользователь"} · ID ${r.telegram_id} · ${r.role}`;}));
      await send(chatId,`Команда площадки:\n• @nukm0 · ID ${OWNER_ID} · Владелец\n${users.length?users.join("\n"):"Сотрудники пока не назначены."}`); return NextResponse.json({ok:true});
    }
    if(["📊 моя статистика","/stats","статистика"].includes(text)) {
      const me=await supabaseRequest(`marketplace_users?telegram_id=eq.${userId}&select=bot_started_at,referred_by&limit=1`).catch(()=>[]) as any[];
      const refs=await supabaseRequest(`marketplace_users?referred_by=eq.${userId}&bot_started_at=not.is.null&select=telegram_id`).catch(()=>[]) as any[];
      await send(chatId,`Твоя статистика Marketplace\nTelegram ID: ${userId}\nПервый запуск бота: ${me?.[0]?.bot_started_at?new Date(me[0].bot_started_at).toLocaleDateString("ru-RU"):"сегодня"}\nПриглашено через бота: ${refs.length}\n${me?.[0]?.referred_by?`Кто пригласил: ID ${me[0].referred_by}`:""}`); return NextResponse.json({ok:true});
    }
    if(["🚩 жалоба на модерацию","/complaint","жалоба на модерацию"].includes(text)) {
      await supabaseRequest(`marketplace_users?telegram_id=eq.${userId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({bot_pending_action:"moderation_complaint"})}).catch(()=>{});
      await send(chatId,"Опиши жалобу на действия модератора одним следующим сообщением. Укажи username/ID сотрудника, дату и что произошло. Сообщение будет передано владельцу @nukm0.");
      return NextResponse.json({ok:true});
    }
    if(rawText && !rawText.startsWith("/") && !["🔗 моя реферальная ссылка","🏪 магазины","👥 кто модератор?","📊 моя статистика","🚩 жалоба на модерацию","🌐 открыть marketplace","📚 мои подписки"].includes(text)) {
      const pending=await supabaseRequest(`marketplace_users?telegram_id=eq.${userId}&select=bot_pending_action&limit=1`).catch(()=>[]) as any[];
      if(pending?.[0]?.bot_pending_action==="moderation_complaint") {
        await supabaseRequest("marketplace_moderation_complaints",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({telegram_id:userId,username:user.username||null,message:rawText,status:"new"})});
        await supabaseRequest(`marketplace_users?telegram_id=eq.${userId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({bot_pending_action:null})}).catch(()=>{});
        await send(chatId,"Обращение зарегистрировано. Спасибо. Владелец рассмотрит его отдельно от обычных жалоб на объявления.");
        await sendTelegramMessage(OWNER_ID,`Новая жалоба на модерацию от ${user.username?"@"+user.username:"пользователя"} (ID ${userId}):\n${rawText}\n\nОтветить пользователю можно через Telegram.`);
        return NextResponse.json({ok:true});
      }
    }
    if(text==="🌐 открыть marketplace" || text==="/app") {
      const appUrl=(process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL||APP_URL).replace(/\/$/,"");
      await send(chatId,"Открыть Marketplace внутри Telegram — нажми кнопку ниже.",keyboard); return NextResponse.json({ok:true});
    }
    await send(chatId,"Marketplace · Главное меню\n\nОбъявления, магазины и твой профиль — всё под рукой.\n\nВыбери раздел кнопками ниже ↓",keyboard);
    return NextResponse.json({ok:true});
  } catch (error) {
    const message=error instanceof Error?error.message:"Webhook error";
    return NextResponse.json({error:message.includes("not configured")?"Server bot configuration missing":"Webhook handler failed"},{status:message.includes("not configured")?503:200});
  }
}
