export const BOT_USERNAME = "baraxolka_ptzbot";
export const GROUP_URL = "https://t.me/marketplace_Support_info";
export const APP_URL = "https://market-ptz.vercel.app";
export function telegramMiniAppLink(kind = "page", id = "home") {
  const bot = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || BOT_USERNAME).replace(/^@/, "");
  const app = process.env.NEXT_PUBLIC_TELEGRAM_APP_NAME || "";
  const param = `${kind}_${id}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 512);
  return app ? `https://t.me/${bot}/${app}?startapp=${param}` : `https://t.me/${bot}?start=${param.slice(0,64)}`;
}
export function miniAppWebUrl(kind = "page", id = "home") {
  const url = new URL(APP_URL);
  url.searchParams.set(kind, id);
  return url.toString();
}
export function telegramNotificationLink(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "t.me" || url.protocol === "tg:") return value;
    if (url.origin !== APP_URL && url.origin !== (process.env.NEXT_PUBLIC_APP_URL || APP_URL)) return value;
    for (const kind of ["ad", "shop", "review", "profile", "page"]) {
      const id = url.searchParams.get(kind);
      if (id) return telegramMiniAppLink(kind, id);
    }
    return telegramMiniAppLink();
  } catch { return telegramMiniAppLink(); }
}
