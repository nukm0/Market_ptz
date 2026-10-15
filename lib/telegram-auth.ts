import { supabaseConfig, supabaseRequest } from "./supabase";
export { supabaseConfig, supabaseRequest } from "./supabase";
import { createHmac, timingSafeEqual } from "node:crypto";
import { APP_URL, miniAppWebUrl } from "./telegram-links";

export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

export function verifyTelegramInitData(initData: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  if (!initData || initData.length > 16_384) throw new Error("Invalid initData");

  const params = new URLSearchParams(initData);
  const suppliedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!suppliedHash || !Number.isFinite(authDate)) throw new Error("Missing Telegram signature");
  if (Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86_400) throw new Error("Telegram session expired");

  params.delete("hash");
  const checkString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(checkString).digest("hex");
  const expected = Buffer.from(calculatedHash, "hex");
  const received = Buffer.from(suppliedHash, "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error("Invalid Telegram signature");
  }

  const rawUser = params.get("user");
  if (!rawUser) throw new Error("Telegram user is missing");
  const user = JSON.parse(rawUser) as TelegramUser;
  if (!Number.isSafeInteger(user.id) || user.id <= 0) throw new Error("Invalid Telegram user ID");
  return user;
}

export async function sendTelegramMessage(telegramId: number, message: string, inlineKeyboard?: Array<Array<{text:string;url:string}>>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !Number.isSafeInteger(telegramId) || telegramId <= 0) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramId, text: message, disable_web_page_preview: true, ...(inlineKeyboard?.length ? { reply_markup: { inline_keyboard: inlineKeyboard.map(row=>row.map(button=>{try{const url=new URL(button.url);return url.origin===APP_URL?{text:button.text,web_app:{url:button.url}}:button;}catch{return button;}})) } } : {}) }),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendTelegramPost(telegramId:number, message:string, listingId:string) {
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token)return false;
  const response=await fetch(`https://api.telegram.org/bot${token}/sendPhoto`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:telegramId,photo:`${APP_URL}/api/telegram/card?ad=${encodeURIComponent(listingId)}`,caption:message.slice(0,1000),reply_markup:{inline_keyboard:[[{text:"Открыть объявление в Telegram",web_app:{url:miniAppWebUrl("ad",listingId)}}]]}}),cache:"no-store"});
  if(response.ok)return true;
  return sendTelegramMessage(telegramId,message,[[{text:"Открыть объявление в Telegram",url:miniAppWebUrl("ad",listingId)}]]);
}

export async function getVerifiedSession(initData: string, options: { allowBanned?: boolean } = {}) {
  const user = verifyTelegramInitData(initData);
  const id = String(user.id);
  let role = id === "998579758" ? "Владелец" : "Участник";
  let shop: any = null;
  let ban: any = null;

  const existingUserRows = await supabaseRequest(`marketplace_users?telegram_id=eq.${id}&select=miniapp_started_at&limit=1`) as any[];
  const miniappStartedAt = existingUserRows?.[0]?.miniapp_started_at || new Date().toISOString();
  await supabaseRequest("marketplace_users?on_conflict=telegram_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      telegram_id: user.id,
      username: user.username ?? null,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      photo_url: user.photo_url ?? null,
      miniapp_started_at: miniappStartedAt,
      updated_at: new Date().toISOString(),
    }),
  });

  // After the user upsert, these lookups are independent. Run them concurrently
  // to avoid adding a round-trip for every table on each authenticated API call.
  const loadCount = async (viewQuery: string, fallbackQuery: string) => {
    try {
      const rows = await supabaseRequest(viewQuery) as any[];
      return Number(rows?.[0]?.subscriber_count ?? rows?.[0]?.view_count ?? 0) || 0;
    } catch {
      const rows = await supabaseRequest(fallbackQuery).catch(() => []) as any[];
      return Array.isArray(rows) ? rows.length : 0;
    }
  };
  const [roles, shops, bans, profileRows, profileSubscriberCount, deletedShopSubscriptions, notifications, shopSubscriptionRows] = await Promise.all([
    user.id === 998579758
      ? Promise.resolve([] as Array<{ role: string }>)
      : supabaseRequest(`marketplace_staff_roles?telegram_id=eq.${id}&select=role&limit=1`) as Promise<Array<{ role: string }>>,
    supabaseRequest(`marketplace_shops?owner_telegram_id=eq.${id}&select=id,name,description,logo_url,cover_url,created_at,owner_telegram_id,hidden,theme_key,listing_theme_key,logo_text_color,background_url&limit=1`) as Promise<any[]>,
    supabaseRequest(`marketplace_bans?telegram_id=eq.${id}&active=eq.true&select=reason,permanent,expires_at,created_at&order=created_at.desc&limit=5`) as Promise<any[]>,
    supabaseRequest(`marketplace_users?telegram_id=eq.${id}&select=verified,verified_full_name,verified_nickname,profile_description,profile_cover_url,profile_background_url,profile_text_color,profile_theme_key&limit=1`) as Promise<any[]>,
    loadCount(`marketplace_profile_subscription_counts?target_telegram_id=eq.${id}&select=subscriber_count&limit=1`, `marketplace_profile_subscriptions?target_telegram_id=eq.${id}&select=subscriber_telegram_id&limit=10000`),
    supabaseRequest(`marketplace_deleted_shop_subscriptions?telegram_id=eq.${id}&select=shop_id,shop_name,deleted_at&order=deleted_at.desc&limit=1000`).catch(() => []) as Promise<any[]>,
    supabaseRequest(`marketplace_notifications?telegram_id=eq.${id}&read=eq.false&select=id,title,message,created_at&order=created_at.desc&limit=50`).catch(() => []) as Promise<any[]>,
    supabaseRequest(`marketplace_shop_subscriptions?telegram_id=eq.${id}&select=shop_id`).catch(() => []) as Promise<any[]>,
  ]);
  if (user.id !== 998579758 && roles?.[0]?.role) role = roles[0].role;
  shop = shops?.[0] ?? null;
  if (user.id !== 998579758 && role === "Участник" && shop) role = "Магазин";

  const now = Date.now();
  ban = bans?.find((item) => item.permanent || (item.expires_at && new Date(item.expires_at).getTime() > now)) ?? null;
  if (ban && !options.allowBanned && user.id !== 998579758) throw new Error("Account is banned");
  if (shop?.id) {
    shop.subscriber_count = await loadCount(
      `marketplace_shop_subscription_counts?shop_id=eq.${encodeURIComponent(String(shop.id))}&select=subscriber_count&limit=1`,
      `marketplace_shop_subscriptions?shop_id=eq.${encodeURIComponent(String(shop.id))}&select=telegram_id&limit=10000`
    );
  }

  return {
    user, role, isOwner: user.id === 998579758, shop, ban,
    verified: !!profileRows?.[0]?.verified,
    profileDescription: profileRows?.[0]?.profile_description || "",
    profileSettings: {
      coverUrl: profileRows?.[0]?.profile_cover_url || "",
      backgroundUrl: profileRows?.[0]?.profile_background_url || "",
      textColor: profileRows?.[0]?.profile_text_color || "#ffffff",
      themeKey: profileRows?.[0]?.profile_theme_key || "banner-purple",
    },
    profileSubscriberCount: profileSubscriberCount || 0,
    deletedShopSubscriptions: deletedShopSubscriptions || [],
    notifications: notifications || [],
    shopSubscriptions: (shopSubscriptionRows || []).map((row:any)=>String(row.shop_id))
  };
}
