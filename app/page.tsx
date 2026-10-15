"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search, Bell, UserRound, ShieldCheck, Store, CircleHelp, Plus,
  Heart, Eye, MessageCircle, Flag, ChevronLeft, ChevronRight,
  SlidersHorizontal, MoreHorizontal, LayoutDashboard, X, ArrowUpRight,
  Package, ChartNoAxesCombined, Users, Megaphone, CheckCircle2, Trash2,
  Pencil, RotateCcw, Ban, Settings2, Send, Sparkles, EyeOff
} from "lucide-react";

declare global { interface Window { Telegram?: { WebApp?: { initData?: string; initDataUnsafe?: { user?: { id:number; username?:string; first_name?:string; last_name?:string; photo_url?:string } }; ready?:()=>void; expand?:()=>void } } } }
type Ad = {
  id: number; title: string; category: string; sub: string; price: number;
  views: number; seller: string; emoji: string; tone: string; description: string;
  sold?: boolean; photos: number; photoUrls?: string[];
  listingType?: "Покупка" | "Продажа";
  listingGroup?: "частное" | "магазина";
  sellerTelegramId?: number; shopId?: string; moderationHidden?: boolean; adminQueueHidden?: boolean;
};
const initialAds: Ad[] = [];
const categories = ["Все", "Vape", "Техника", "Одежда", "Услуги"];
const subcategories: Record<string, string[]> = {
  Vape: ["Подики", "Услуги", "Расходники"],
  Техника: ["Б/у", "Новое"],
  Одежда: ["Б/у", "Новое"],
  Услуги: ["Предоставление услуги", "Поиск услуги"],
};
const money = (n: number) => n === 0 ? "Договорная" : n.toLocaleString("ru-RU") + " ₽";
function openTelegramContact(target: string | number | undefined, message: string) {
  const value = String(target ?? "").trim().replace(/^@/, "");
  if (!value || value === "you") return false;
  if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value)) {
    window.open(`https://t.me/${value}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    return true;
  }
  if (/^\d{5,20}$/.test(value)) {
    window.open(`tg://user?id=${value}`, "_blank", "noopener,noreferrer");
    return true;
  }
  return false;
}
function isAdForShop(ad: any, shop: any) {
  if (String(ad?.listingGroup || "частное") !== "магазина") return false;
  const targetShopId = String(shop?.id || "");
  const listingShopId = String(ad?.shopId || "");
  if (targetShopId && listingShopId && targetShopId === listingShopId) return true;
  // Older/local listings may contain a stale shop ID. A shop owner is unique,
  // so a verified owner match is a safe compatibility fallback.
  const ownerId = String(shop?.ownerTelegramId ?? shop?.owner_telegram_id ?? "");
  if (ownerId && String(ad?.sellerTelegramId ?? "") === ownerId) return true;
  const ownerName = String(shop?.ownerUsername || shop?.owner || "").replace(/^@|^ID:\s*/g, "").toLowerCase();
  return !!ownerName && String(ad?.seller || "").replace(/^@/, "").toLowerCase() === ownerName;
}

export default function Home() {
  const [tab, setTab] = useState("Главная");
  const [telegramUser, setTelegramUser] = useState<{id:number;username?:string;first_name?:string;last_name?:string;photo_url?:string}|null>(null);
  const [ads, setAds] = useState<Ad[]>(initialAds);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Все");
  const [sub, setSub] = useState("Все");
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [listingType, setListingType] = useState("Все");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selected, setSelected] = useState<Ad | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [banner, setBanner] = useState(0);
  const [notice, setNotice] = useState("");
  const [adminPage, setAdminPage] = useState("Обзор");
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [bannerDraft, setBannerDraft] = useState({title:"", sub:"", kicker:"MARKETPLACE · НОВОСТИ", color:"banner-purple", url:"", image:"", home:true, shops:false});
  const [customBanners, setCustomBanners] = useState<any[]>([]);
  const [shopDraft, setShopDraft] = useState({name:"", owner:"", description:"", logo:""});
  const [managedShops, setManagedShops] = useState<{id?:string;name:string;owner:string;ownerTelegramId?:number;description?:string;logo?:string;logo_url?:string;theme_key?:string;createdAt?:string;views?:number;subscriberCount?:number;hidden?:boolean}[]>([]);
  const [adminShopSelected, setAdminShopSelected] = useState<{id?:string;name:string;owner:string;ownerTelegramId?:number;description?:string;logo?:string;logo_url?:string;theme_key?:string;createdAt?:string;views?:number;subscriberCount?:number;hidden?:boolean}|null>(null);
  const [staffBadges, setStaffBadges] = useState<Record<string,string>>({});
  const [adminSearch, setAdminSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<any[]>([]);
  const [selectedAdminUser, setSelectedAdminUser] = useState<any>(null);
  const [userBanReason, setUserBanReason] = useState("Нарушение правил Marketplace");
  const [userBanPermanent, setUserBanPermanent] = useState(false);
  const [userBanMinutes, setUserBanMinutes] = useState("1440");
  const [shopOrderDraft, setShopOrderDraft] = useState<string[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [totalRegistered, setTotalRegistered] = useState(0);
  const [referralRanking, setReferralRanking] = useState<any[]>([]);
  const [showReferralRanking, setShowReferralRanking] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDescriptionDraft, setProfileDescriptionDraft] = useState("");
  const [siteTheme, setSiteTheme] = useState<"dark"|"light">("dark");
  const [shopThemeDraft, setShopThemeDraft] = useState({themeKey:"banner-purple",logoTextColor:"#ffffff",backgroundUrl:"",coverUrl:"",description:""});
  const [showShopSettings, setShowShopSettings] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [profileSettings, setProfileSettings] = useState({coverUrl:"",backgroundUrl:"",textColor:"#ffffff",themeKey:"banner-purple"});
  const [profileSettingsDraft, setProfileSettingsDraft] = useState({coverUrl:"",backgroundUrl:"",textColor:"#ffffff",themeKey:"banner-purple"});
  const [localPlatformBackground, setLocalPlatformBackground] = useState("");
  const [localPlatformBackgroundDraft, setLocalPlatformBackgroundDraft] = useState("");
  const [publicProfileSettings, setPublicProfileSettings] = useState<any>(null);
  const [profileSubscriberCount, setProfileSubscriberCount] = useState(0);
  const [deletedShopSubscriptions, setDeletedShopSubscriptions] = useState<any[]>([]);
  const [adminReviewRows, setAdminReviewRows] = useState<any[]>([]);
  const [adminListingTab, setAdminListingTab] = useState<"new"|"viewed">("new");
  const [adminViewedListingIds, setAdminViewedListingIds] = useState<number[]>([]);
  const [adminReviewSearch, setAdminReviewSearch] = useState("");
  const [adminReviewStars, setAdminReviewStars] = useState("all");
  const [adminReviewDirection, setAdminReviewDirection] = useState("all");
  const [broadcastDraft, setBroadcastDraft] = useState({title:"Объявление администрации",message:"",url:""});
  const [staffDraft, setStaffDraft] = useState({id:"", username:"", role:"Модератор"});
  const [verificationDraft, setVerificationDraft] = useState({fullName:"", phone:"", id:"", username:"", nickname:""});
  const [serverAuthenticated, setServerAuthenticated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [serverRole, setServerRole] = useState("Участник");
  const [currentUserShop, setCurrentUserShop] = useState<any>(null);
  const [banInfo, setBanInfo] = useState<any>(null);
  const [serverVerifiedUser, setServerVerifiedUser] = useState(false);
  const [faqCustomEntries, setFaqCustomEntries] = useState<any[]>([]);
  const [faqDraft, setFaqDraft] = useState({section:"Как пользоваться",heading:"",parent:"",question:"",answer:""});
  const [reportDuration, setReportDuration] = useState({days:"0",hours:"0",minutes:"30"});
  const [reportTargetIds, setReportTargetIds] = useState<Record<string,string>>({});
  const [verifiedUsers, setVerifiedUsers] = useState<Record<string,{fullName:string;phone:string;id:string;username:string;nickname:string}>>({});
  const [adminDecisionComment, setAdminDecisionComment] = useState("");
  const [adminRestriction, setAdminRestriction] = useState("Предупреждение");
  const [adminAudit, setAdminAudit] = useState<{id:number;actor:string;action:string;target:string;time:string}[]>([]);
  const [staffRoles, setStaffRoles] = useState<Record<string,string>>({});
  const [reportTarget, setReportTarget] = useState<Ad | null>(null);
  const [reportReason, setReportReason] = useState("Подозрение на мошенничество");
  const [reportText, setReportText] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("Одежда");
  const [newSub, setNewSub] = useState("Б/у");
  const [newDescription, setNewDescription] = useState("");
  const [newPhotos, setNewPhotos] = useState<string[]>([]);
  const [newListingType, setNewListingType] = useState<"Покупка" | "Продажа">("Продажа");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [shopName, setShopName] = useState("");
  const [sellerProfileUsername, setSellerProfileUsername] = useState("cloudboy");
  const [reports, setReports] = useState<{id:number|string; serverId?:string; createdAt?:string; title:string; seller:string; reason:string; details:string; status:string; decisionComment:string; photos?:string[]; adId?:number; objectId?:string; telegramId?:number; reporter?:string; reporterId?:number; reviewer?:string; ownerComment?:string; objectType?:string; ownerTelegramId?:number; recommendedAction?:string}[]>([]);
  const [reviews, setReviews] = useState<{id?:string;seller:string; author?:string; stars:number; text:string; status?:string; dispute?:string}[]>([]);
  const [reviewDisputeIndex,setReviewDisputeIndex] = useState<number|null>(null);
  const [reviewDisputeText,setReviewDisputeText] = useState("");
  const [sideOpen,setSideOpen] = useState(false);
  const [subFeedProfile,setSubFeedProfile] = useState<string|null>(null);
  const [demoRole, setDemoRole] = useState("Участник");
  const [moderationComment, setModerationComment] = useState("");
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [persistReady, setPersistReady] = useState(false);
  const [viewHistory, setViewHistory] = useState<number[]>([]);
  const [deletedAds, setDeletedAds] = useState<Ad[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [notifications, setNotifications] = useState<{id:number|string; text:string; profile:string; url?:string; read?:boolean; title?:string; createdAt?:string}[]>([]);
  const [profileViewCount, setProfileViewCount] = useState(0);
  const [shopViewCount, setShopViewCount] = useState(0);
  const [listingGroup, setListingGroup] = useState<"частное" | "магазина" | "оба">("частное");
  const [shopReviews, setShopReviews] = useState<{id?:string;shop:string;author:string;stars:number;text:string;status:string;dispute?:string}[]>([]);
  const [shopReviewStars,setShopReviewStars] = useState(5);
  const [shopReviewText,setShopReviewText] = useState("");
  const [showShopReviews,setShowShopReviews] = useState(true);
  const [shopReviewDisputeText,setShopReviewDisputeText] = useState("");
  const [shopReviewDisputeIndex,setShopReviewDisputeIndex] = useState<number|null>(null);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [profileDescription, setProfileDescription] = useState("");
  const [showReviews, setShowReviews] = useState(false);
  const [accountReportReason, setAccountReportReason] = useState("Подозрение на мошенничество");
  const [accountReportText, setAccountReportText] = useState("");
  const [accountReportObjectType, setAccountReportObjectType] = useState<"profile"|"shop">("profile");
  const [accountReportObjectId, setAccountReportObjectId] = useState("");
  const [accountReportTitle, setAccountReportTitle] = useState("");
  const [showAccountReport, setShowAccountReport] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = siteTheme;
    document.documentElement.style.colorScheme = siteTheme === "light" ? "light" : "dark";
  }, [siteTheme]);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready?.(); webApp?.expand?.();
    const profileTarget = new URLSearchParams(window.location.search).get("profile");
    if (profileTarget) { setSellerProfileUsername(profileTarget.replace(/^@/, "")); setTab("Профиль продавца"); }
    try { const storedTheme=localStorage.getItem("marketplace-theme-v1"); if(storedTheme==="light"||storedTheme==="dark") setSiteTheme(storedTheme); const storedBackground=localStorage.getItem("marketplace-personal-background-v1"); if(storedBackground) setLocalPlatformBackground(storedBackground); } catch {}
    if (webApp?.initDataUnsafe?.user) { setTelegramUser(webApp.initDataUnsafe.user); setDemoRole("Участник"); }
    try {
      const saved = localStorage.getItem("marketplace-state-v5") || localStorage.getItem("marketplace-state-v4");
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.favorites)) setFavorites(data.favorites.filter((id:any)=>Number(id)!==2));
        if (Array.isArray(data.viewHistory)) setViewHistory(data.viewHistory);
        if (Array.isArray(data.deletedAds)) setDeletedAds(data.deletedAds);
        if (Array.isArray(data.adminViewedListingIds)) setAdminViewedListingIds(data.adminViewedListingIds.map((id:any)=>Number(id)).filter((id:number)=>Number.isFinite(id)));
        if (Array.isArray(data.subscriptions)) setSubscriptions(data.subscriptions);
        if (Array.isArray(data.notifications)) setNotifications(data.notifications);
        if (Array.isArray(data.adminAudit)) setAdminAudit(data.adminAudit);
        if (data.staffBadges && typeof data.staffBadges === "object") setStaffBadges(data.staffBadges);
        if (typeof data.profileDescription === "string") { setProfileDescription(data.profileDescription); setProfileDescriptionDraft(data.profileDescription); }
      }
    } catch { /* corrupted demo state is ignored */ }
    setPersistReady(true);
  }, []);
  useEffect(() => {
    setPublicProfileSettings(null);
    setProfileViewCount(0);
    if (tab !== "Профиль продавца") return;
    const controller = new AbortController();
    fetch(`/api/marketplace/profile?target=${encodeURIComponent(sellerProfileUsername)}`, {
      cache: "no-store", signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Не удалось загрузить профиль.");
      return data;
    }).then(data => {
      if (controller.signal.aborted) return;
      setPublicProfileSettings(data.profile);
      setProfileViewCount(Number(data.profile?.views || 0));
    }).catch(error => {
      if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Не удалось загрузить профиль.");
    });
    return () => controller.abort();
  }, [tab, sellerProfileUsername]);

  useEffect(() => {
    if(!serverAuthenticated || !window.Telegram?.WebApp?.initData) return;
    const initData=window.Telegram.WebApp.initData;
    if(tab==="Профиль продавца") {
      fetch(`/api/marketplace/reviews?type=profile&target=${encodeURIComponent(sellerProfileUsername)}`,{headers:{"x-telegram-init-data":initData},cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(Array.isArray(data?.reviews))setReviews(data.reviews.map((r:any)=>({seller:sellerProfileUsername,id:String(r.id),author:(r.author_username||String(r.author_telegram_id)),stars:Number(r.stars),text:r.description,status:({approved:"Одобрен",pending:"На модерации",disputed:"Спор на проверке"} as any)[r.status]||r.status,dispute:r.dispute_text||""})));}).catch(()=>undefined);
      fetch("/api/marketplace/engagement",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,type:"profile",targetUsername:sellerProfileUsername}),cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(data&&Number.isFinite(Number(data.views)))setProfileViewCount(Number(data.views));}).catch(()=>undefined);
    }
    if(tab==="Витрина магазина" || tab==="ЛК магазин") {
      const shop=tab==="ЛК магазин" ? currentUserShop : (managedShops.find((x:any)=>x.name===shopName)||currentUserShop);
      if(shop?.id) {
        const reviewShopName = String(shop.name || shopName || "Магазин");
        fetch(`/api/marketplace/reviews?type=shop&target=${encodeURIComponent(String(shop.id))}`,{headers:{"x-telegram-init-data":initData},cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(Array.isArray(data?.reviews))setShopReviews(data.reviews.map((r:any)=>({shop:reviewShopName,id:String(r.id),author:(r.author_username||String(r.author_telegram_id)),stars:Number(r.stars),text:r.description,status:({approved:"Одобрен",pending:"На модерации",disputed:"Спор на проверке"} as any)[r.status]||r.status,dispute:r.dispute_text||""})));}).catch(()=>undefined);
        fetch("/api/marketplace/engagement",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,type:"shop",targetId:String(shop.id)}),cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(data&&Number.isFinite(Number(data.views)))setShopViewCount(Number(data.views));}).catch(()=>undefined);
      }
    }
  },[tab,shopName,sellerProfileUsername,serverAuthenticated,currentUserShop,managedShops]);

  useEffect(() => {
    if (!persistReady) return;
    localStorage.setItem("marketplace-state-v5", JSON.stringify({ads,favorites,reports,reviews,shopReviews,viewHistory,deletedAds,adminViewedListingIds,subscriptions,profileDescription,notifications,adminAudit,customBanners,managedShops,staffBadges,verifiedUsers,faqCustomEntries}));
    localStorage.setItem("marketplace-theme-v1", siteTheme);
    localStorage.setItem("marketplace-personal-background-v1", localPlatformBackground);
  }, [ads,favorites,reports,reviews,shopReviews,viewHistory,subscriptions,profileDescription,notifications,adminAudit,staffRoles,customBanners,managedShops,staffBadges,verifiedUsers,faqCustomEntries,adminViewedListingIds,persistReady,siteTheme,localPlatformBackground]);


  useEffect(() => {
    let cancelled = false;
    const webApp = window.Telegram?.WebApp;
    const initData = webApp?.initData;
    if (!initData) { setSessionReady(true); return; }
    fetch("/api/telegram/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, referralId: new URLSearchParams(window.location.search).get("ref") }), cache: "no-store" })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data?.error || "Session check failed"); return data; })
      .then(data => {
        if (cancelled) return;
        if (data.user) setTelegramUser(data.user);
        setReferralCount(Number(data.referralCount||0));
        setTotalRegistered(Number(data.totalRegistered||0));
        if (Array.isArray(data.referralRanking)) setReferralRanking(data.referralRanking);
        if (typeof data.profileDescription === "string") { setProfileDescription(data.profileDescription); setProfileDescriptionDraft(data.profileDescription); }
        if (data.shop) setShopThemeDraft({themeKey:data.shop.theme_key||"banner-purple",logoTextColor:data.shop.logo_text_color||"#ffffff",backgroundUrl:data.shop.background_url||"",coverUrl:data.shop.cover_url||"",description:data.shop.description||""});
        if (data.profileSettings) { const settings={coverUrl:data.profileSettings.coverUrl||"",backgroundUrl:data.profileSettings.backgroundUrl||"",textColor:data.profileSettings.textColor||"#ffffff",themeKey:data.profileSettings.themeKey||"banner-purple"};setProfileSettings(settings);setProfileSettingsDraft(settings); }
        setProfileSubscriberCount(Number(data.profileSubscriberCount||0));
        if (Array.isArray(data.deletedShopSubscriptions)) setDeletedShopSubscriptions(data.deletedShopSubscriptions);
        setServerRole(typeof data.role === "string" ? data.role : "Участник");
        setDemoRole(typeof data.role === "string" ? data.role : "Участник");
        setBanInfo(data.ban || null);
        setServerVerifiedUser(!!data.verified);
        if (Array.isArray(data.notifications)) setNotifications(data.notifications.map((n:any)=>({id:n.id,text:String(n.message??n.text??""),profile:"support",title:n.title,read:!!n.read,createdAt:n.createdAt,url:n.action_url||n.actionUrl||""})));
        setCurrentUserShop(data.shop || null);
        if (Array.isArray(data.shopSubscriptions)) {
          const archived = new Set((data.deletedShopSubscriptions||[]).map((x:any)=>String(x.shop_id)));
          setSubscriptions(old => [...old.filter(key=>!key.startsWith("shop-id:") || (!archived.has(key.slice(8)) && data.shopSubscriptions.includes(key.slice(8)))), ...data.shopSubscriptions.map((id:string)=>`shop-id:${id}`)]);
        }
        setServerAuthenticated(true);
        const reviewDeepLink = new URLSearchParams(window.location.search).get("review");
        if (reviewDeepLink) {
          fetch(`/api/marketplace/reviews?review=${encodeURIComponent(reviewDeepLink)}`, { headers: { "x-telegram-init-data": initData }, cache: "no-store" }).then(r=>r.ok?r.json():null).then(item=>{
            if(cancelled||!item?.review)return;
            if(item.review.target_type === "shop" && item.shop?.name){setShopName(item.shop.name);setTab("Витрина магазина");setShowShopReviews(true);}
            else if(item.targetUsername){setSellerProfileUsername(item.targetUsername);setTab("Профиль продавца");}
            flash("Открыт отзыв из уведомления. Если вы его получатель, ниже доступно оспаривание.");
          }).catch(()=>undefined);
        }
        fetch("/api/marketplace/notifications", { headers: { "x-telegram-init-data": initData }, cache: "no-store" }).then(r=>r.ok?r.json():null).then(result=>{if(!cancelled&&Array.isArray(result?.notifications))setNotifications(result.notifications.map((n:any)=>({id:n.id,text:String(n.text??n.message??""),profile:"Marketplace",title:n.title,read:!!n.read,createdAt:n.createdAt,url:n.actionUrl||n.url||""})));}).catch(()=>undefined);
        fetch("/api/marketplace/listings", { headers: { "x-telegram-init-data": initData }, cache: "no-store" }).then(r=>r.ok?r.json():null).then(result=>{
          if(cancelled||!Array.isArray(result?.listings)) return;
          const serverListings:Ad[]=result.listings;
          setAds(old=>{const byId=new Map<number,Ad>(old.map((a:any)=>[Number(a.id),a]));for(const remote of serverListings){const prior=byId.get(Number(remote.id));byId.set(Number(remote.id),prior?{...prior,...remote,views:Number(remote.views)||prior.views,seller:remote.seller}:remote);}return Array.from(byId.values()).sort((a,b)=>b.id-a.id);});
          const requestedAd=new URLSearchParams(window.location.search).get("ad");
          if(requestedAd){const target=serverListings.find((a:any)=>String(a.id)===requestedAd);if(target){setSelected(target);setTab("Главная");}}
        }).catch(()=>undefined);
        fetch("/api/marketplace/config", { headers: { "x-telegram-init-data": initData }, cache: "no-store" }).then(response=>response.json()).then(config=>{
          if (cancelled || config?.persistenceConfigured === false) return;
          if (Array.isArray(config.banners)) setCustomBanners(config.banners);
          if (Array.isArray(config.shops)) {
            setManagedShops(config.shops);
            const requestedShop = new URLSearchParams(window.location.search).get("shop");
            if (requestedShop) {
              const linkedShop = config.shops.find((shop:any) => String(shop.id) === requestedShop);
              if (linkedShop) { setShopName(linkedShop.name); setTab("Витрина магазина"); }
            }
          }
          if (Array.isArray(config.faq)) setFaqCustomEntries(config.faq);
          const publicHidden = new Set((config.hiddenListingIds||[]).map(String));
          const adminQueueHidden = new Set((config.adminQueueHiddenIds||[]).map(String));
          setAds(old=>old.map((ad:any)=>({...ad,moderationHidden:publicHidden.has(String(ad.id))?true:ad.moderationHidden,adminQueueHidden:adminQueueHidden.has(String(ad.id))?true:ad.adminQueueHidden})));
        }).catch(()=>undefined);
        if (["Владелец","Заместитель владельца"].includes(data.role)) {
          fetch("/api/admin/roles", { headers: { "x-telegram-init-data": initData }, cache: "no-store" })
            .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result?.error || "Could not load roles"); return result; })
            .then(result => { if (!cancelled && Array.isArray(result.staffRoles)) { const mapped:Record<string,string>={}; result.staffRoles.forEach((r:any)=>{mapped[`id:${r.telegramId}`]=r.role;if(r.username)mapped[`@${r.username}`]=r.role;});setStaffRoles(mapped); } })
            .catch(()=>undefined);
        }
        if (["Владелец","Заместитель владельца","Администратор","Модератор","Стажёр"].includes(data.role)) {
          fetch("/api/admin/audit", { headers: { "x-telegram-init-data": initData }, cache: "no-store" })
            .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result?.error || "Could not load audit log"); return result; })
            .then(result => { if (!cancelled && Array.isArray(result.entries)) setAdminAudit(result.entries); })
            .catch(() => undefined);
          fetch("/api/admin/reports", { headers: { "x-telegram-init-data": initData }, cache: "no-store" })
            .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result?.error || "Could not load reports"); return result; })
            .then(result => { if (!cancelled && Array.isArray(result.reports)) setReports(result.reports); })
            .catch(() => undefined);
        }
        setSessionReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        // Fail closed: Telegram's unsigned initDataUnsafe data never grants staff access.
        setServerRole("Участник"); setDemoRole("Участник"); setServerAuthenticated(false); setSessionReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  const isOwnerAccount = serverAuthenticated && serverRole === "Владелец";
  const isLeadership = serverAuthenticated && (serverRole === "Владелец" || serverRole === "Заместитель владельца");
  const hasAdminAccess = serverAuthenticated && ["Владелец","Заместитель владельца","Администратор","Модератор","Стажёр"].includes(serverRole);
  const hasShopAccess = serverAuthenticated && !!currentUserShop;

  useEffect(() => {
    if (tab !== "Админ-панель" || adminPage !== "Отзывы" || !hasAdminAccess) return;
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;
    let cancelled = false;
    fetch("/api/admin/manage", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({initData,action:"list_reviews",payload:{}}), cache:"no-store" })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data?.error || "Не удалось загрузить отзывы"); return data; })
      .then(data => { if (!cancelled && Array.isArray(data?.result)) setAdminReviewRows(data.result); })
      .catch(() => { if (!cancelled) setNotice("Не удалось автоматически загрузить отзывы. Проверь подключение Supabase."); });
    return () => { cancelled = true; };
  }, [tab, adminPage, hasAdminAccess]);

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;
  async function markNotificationRead(id: number | string) {
    setNotifications(old => old.map(item => String(item.id) === String(id) ? {...item, read:true} : item));
    if (!/^[0-9a-f-]{36}$/i.test(String(id))) return;
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;
    try { await fetch("/api/marketplace/notifications", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({initData, action:"mark_read", id:String(id)}), cache:"no-store" }); } catch {}
  }
  async function markAllNotificationsRead() {
    setNotifications(old => old.map(item => ({...item, read:true})));
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return;
    try { await fetch("/api/marketplace/notifications", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({initData, action:"mark_all_read"}), cache:"no-store" }); } catch {}
  }
  function openNotification(item: {id:number|string;url?:string}) {
    void markNotificationRead(item.id);
    setShowNotifications(false);
    if (item.url) window.location.href = item.url;
    else setTab("Уведомления");
  }

  function audit(action: string, target: string) { const who = telegramUser ? `${telegramUser.first_name||"Пользователь"}${telegramUser.last_name?" "+telegramUser.last_name:""} · ${telegramUser.username?"@"+telegramUser.username:"без username"} · ID ${telegramUser.id}` : "Неизвестный аккаунт"; setAdminAudit(old => [{id:Date.now(),actor:who,action,target,time:new Date().toLocaleString("ru-RU")},...old]); }
  async function secureAdminRequest(action: string, payload: Record<string, unknown>) {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData || !serverAuthenticated) { flash("Действие не выполнено: необходимо подтвердить сессию Telegram на сервере."); return false; }
    try {
      const response = await fetch("/api/admin/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, action, payload }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Сервер отклонил действие");
      return data;
    } catch (error) { flash(error instanceof Error ? error.message : "Не удалось выполнить серверное действие."); return false; }
  }
  function durationMinutes() { return Math.max(0, Number(reportDuration.days||0)*1440+Number(reportDuration.hours||0)*60+Number(reportDuration.minutes||0)); }
  async function secureUpload(dataUrl: string, folder: string) {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData || !serverAuthenticated) { flash("Для постоянной загрузки изображения нужно открыть приложение через Telegram и подключить сервер."); return null; }
    try {
      const response = await fetch("/api/admin/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, dataUrl, folder }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Не удалось загрузить файл.");
      return String(data.url);
    } catch (error) { flash(error instanceof Error ? error.message : "Не удалось загрузить файл."); return null; }
  }
  function storeSubscriptionKey(shop: any) {
    return shop?.id && /^[0-9a-f-]{36}$/i.test(String(shop.id)) ? `shop-id:${shop.id}` : `shop:${String(shop?.name||"")}`;
  }
  function isStoreSubscribed(shop: any) { return subscriptions.includes(storeSubscriptionKey(shop)); }
  async function toggleStoreSubscription(shop: any) {
    if (!shop?.name) return;
    if (currentUserShop?.id && String(currentUserShop.id) === String(shop.id)) { flash("Вы владелец этого магазина и уже управляете им через свой кабинет."); return; }
    const key = storeSubscriptionKey(shop);
    const active = !subscriptions.includes(key);
    const remote = !!shop.id && /^[0-9a-f-]{36}$/i.test(String(shop.id));
    let subscriberCount = Number(shop.subscriberCount ?? shop.subscriber_count ?? 0);
    if (remote) {
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData || !serverAuthenticated) { flash("Откройте приложение через Telegram, чтобы сохранять подписки на сервере."); return; }
      try {
        const response = await fetch("/api/marketplace/shop-subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, shopId: shop.id, active }), cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Не удалось изменить подписку.");
        subscriberCount = Number(data.subscriberCount || 0);
      } catch (error) { flash(error instanceof Error ? error.message : "Не удалось изменить подписку."); return; }
      setManagedShops(old => old.map((item:any)=>String(item.id)===String(shop.id)?{...item,subscriberCount}:item));
    }
    setSubscriptions(old => active ? (old.includes(key)?old:[...old,key]) : old.filter(item=>item!==key));
    if (active) setNotifications(old=>[{id:Date.now(),text:`Вы подписались на магазин «${shop.name}».`,profile:shop.name},...old]);
    flash(active?`Вы подписались на магазин «${shop.name}».`:`Вы отписались от магазина «${shop.name}».`);
  }
  function reportForAd(adId?: number) { return reports.find(report => report.adId === adId); }
  async function claimReport(report: any) {
    if (!hasAdminAccess || !["Модератор","Администратор","Владелец","Заместитель владельца"].includes(serverRole)) { flash("У вашей роли нет полномочий брать жалобы в работу."); return; }
    if (report.reviewer && !String(report.reviewer).includes(String(telegramUser?.id||""))) { flash(`Жалоба уже в работе: ${report.reviewer}`); return; }
    if (report.serverId) { const saved = await secureAdminRequest("claim_report", { reportId: report.serverId }); if (!saved) return; }
    const reviewer = `${telegramUser?.first_name||"Сотрудник"}${telegramUser?.last_name?" "+telegramUser.last_name:""}${telegramUser?.username?" · @"+telegramUser.username:""} · ID ${telegramUser?.id||"—"}`;
    setReports(old => old.map(item => String(item.id)===String(report.id) ? {...item,status:"Взята в работу",reviewer} : item));
    audit("Жалоба взята в работу", report.title); flash("Жалоба закреплена за вами.");
  }
  async function recommendReport(report: any) {
    if (!adminDecisionComment.trim()) { flash("Добавьте комментарий проверки."); return; }
    if (report.serverId) { const saved = await secureAdminRequest("report_recommendation", { reportId: report.serverId, comment: adminDecisionComment.trim(), recommendedAction: adminRestriction, durationMinutes: durationMinutes() }); if (!saved) return; }
    const note = `Заключение ${telegramUser?.username ? "@"+telegramUser.username : "ID "+(telegramUser?.id||"—")}: ${adminDecisionComment.trim()} | Рекомендация: ${adminRestriction}${adminRestriction==="Временная блокировка"?` (${durationMinutes()} мин.)`:""}`;
    setReports(old => old.map(item => String(item.id)===String(report.id) ? {...item,status:"Ожидает решения владельца",reviewer:item.reviewer||`ID ${telegramUser?.id||"—"}`,decisionComment:[item.decisionComment,note].filter(Boolean).join(" · "),recommendedAction:adminRestriction} : item));
    audit("Подготовлено заключение модератора",report.title); setAdminDecisionComment(""); flash("Заключение сохранено и передано владельцу.");
  }
  async function decideReport(report: any, decision: "apply"|"dismiss"|"recheck") {
    if (!isLeadership) { flash("Окончательное решение доступно владельцу и заместителю."); return; }
    if (!adminDecisionComment.trim() && decision !== "recheck") { flash("Добавьте комментарий окончательного решения."); return; }
    const targetId = Number(reportTargetIds[String(report.id)] || report.ownerTelegramId || 0);
    const finalAction = decision === "dismiss" ? "Без ограничения" : decision === "recheck" ? "Дополнительная проверка" : adminRestriction;
    const apiDecision = finalAction === "Предупреждение" ? "warning" : finalAction === "Скрыть объявление" ? "hide_listing" : finalAction === "Временная блокировка" ? "temporary_ban" : finalAction === "Постоянная блокировка" ? "permanent_ban" : "no_action";
    if (decision === "apply" && ["Временная блокировка","Постоянная блокировка"].includes(finalAction) && (!Number.isSafeInteger(targetId) || targetId <= 0)) { flash("Для блокировки укажите проверенный Telegram ID владельца объекта жалобы."); return; }
    if (report.serverId && decision !== "recheck") {
      const saved = await secureAdminRequest("owner_decision", { reportId: report.serverId, decision: apiDecision, objectType: report.objectType === "Объявление" ? "listing" : String(report.objectType||"listing").toLowerCase(), objectId: String(report.adId ?? report.objectId ?? ""), targetTelegramId: targetId || null, durationMinutes: durationMinutes(), comment: adminDecisionComment.trim() });
      if (!saved) return;
    }
    if (decision === "recheck") {
      setReports(old => old.map(item => String(item.id)===String(report.id)?{...item,status:"Дополнительная проверка",ownerComment:adminDecisionComment.trim()}:item));
      audit("Запрошена дополнительная проверка",report.title); flash("Дело возвращено на дополнительную проверку."); return;
    }
    if (finalAction === "Скрыть объявление" && report.adId) setAds(old=>old.map(ad=>ad.id===report.adId?{...ad,moderationHidden:true} as any:ad));
    const outcome = decision === "dismiss" ? "Решено: без наказания" : finalAction === "Предупреждение" ? "Решено: предупреждение" : ["Временная блокировка","Постоянная блокировка"].includes(finalAction) ? "Решено: бан назначен" : finalAction === "Скрыть объявление" ? "Решено: объявление скрыто" : "Решено";
    setReports(old => old.map(item => String(item.id)===String(report.id) ? {...item,status:outcome,ownerComment:`Решение владельца: ${adminDecisionComment.trim()} · Мера: ${finalAction}`} : item));
    if (finalAction === "Предупреждение" && targetId) setNotifications(old=>[{id:Date.now(),text:`Предупреждение по жалобе «${report.reason}»: ${adminDecisionComment.trim()}`,profile:report.seller},...old]);
    audit(decision === "dismiss" ? "Жалоба закрыта без наказания" : "Принято окончательное решение по жалобе",report.title+" · "+finalAction); setAdminDecisionComment(""); flash("Решение владельца сохранено.");
  }

  const filtered = useMemo(() => {
    const min = priceFrom.trim() === "" ? null : Number(priceFrom);
    const max = priceTo.trim() === "" ? null : Number(priceTo);
    const result = ads.filter(a => {
      const type = a.listingType || "Продажа";
      const matchesSubs = selectedSubs.length === 0 || selectedSubs.includes(a.sub);
      return !a.sold
        && !(a as any).moderationHidden
        && a.listingGroup !== "магазина"
        && (category === "Все" || a.category === category)
        && (selectedSubs.length > 0 ? matchesSubs : (sub === "Все" || a.sub === sub))
        && (listingType === "Все" || type === listingType)
        && (min === null || a.price >= min)
        && (max === null || a.price <= max)
        && (a.title + " " + a.description + " " + a.seller + " " + a.category + " " + a.sub).toLowerCase().includes(search.toLowerCase());
    });
    if (sortBy === "priceAsc") result.sort((a,b) => a.price - b.price);
    else if (sortBy === "priceDesc") result.sort((a,b) => b.price - a.price);
    else result.sort((a,b) => b.id - a.id);
    return result;
  }, [ads, category, sub, selectedSubs, listingType, priceFrom, priceTo, search, sortBy]);

  function resetFilters() {
    setSearch("");
    setCategory("Все");
    setSub("Все");
    setSelectedSubs([]);
    setListingType("Все");
    setPriceFrom("");
    setPriceTo("");
    setSortBy("newest");
  }

  function toggleSubcategory(value: string) {
    setSub("Все");
    setSelectedSubs(old => old.includes(value) ? old.filter(item => item !== value) : [...old, value]);
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }
  function changeCategory(c: string) {
    setCategory(c); setSub("Все"); setSelectedSubs([]);
  }
  function toggleFavorite(id: number) {
    setFavorites(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  }
  async function editShopPrompt(shop:any) {
    if(!isAdminAccessForShopEditor()) { flash("Недостаточно прав для редактирования магазина."); return; }
    const name=window.prompt("Название магазина",String(shop.name||"")); if(name===null)return;
    const description=window.prompt("Описание магазина",String(shop.description||"")); if(description===null)return;
    const ownerId=window.prompt("Telegram ID нового владельца",String(shop.ownerTelegramId||"")); if(ownerId===null)return;
    const logoUrl=window.prompt("URL логотипа (https://...) или пусто",String(shop.logo||shop.logo_url||"")); if(logoUrl===null)return;
    if(!name.trim()||!/^\d+$/.test(ownerId.trim())){flash("Название и корректный Telegram ID владельца обязательны.");return;}
    if(logoUrl.trim()&&!/^https:\/\//i.test(logoUrl.trim())){flash("Для логотипа укажите URL https:// или оставьте поле пустым.");return;}
    const saved=await secureAdminRequest("edit_shop",{id:shop.id,name:name.trim(),description:description.trim(),ownerTelegramId:Number(ownerId),logoUrl:logoUrl.trim()||null});
    if(!saved)return;
    setManagedShops(old=>old.map((x:any)=>String(x.id)===String(shop.id)?({...x,name:name.trim(),description:description.trim(),ownerTelegramId:Number(ownerId),owner:`ID: ${ownerId}`,logo:logoUrl.trim()}):x));
    setAdminShopSelected((old:any)=>old&&String(old.id)===String(shop.id)?({...old,name:name.trim(),description:description.trim(),ownerTelegramId:Number(ownerId),owner:`ID: ${ownerId}`,logo:logoUrl.trim()}):old);
    audit("Отредактирован магазин",`${name.trim()} · новый владелец ID ${ownerId}`); flash("Название, описание, логотип и владелец магазина обновлены.");
  }
  function isAdminAccessForShopEditor(){return isOwnerAccount;}
  function openShopSettings() {
    if (!currentUserShop?.id) { flash("У этого аккаунта нет закреплённого магазина."); return; }
    setShopThemeDraft({themeKey:currentUserShop.theme_key||"banner-purple",logoTextColor:currentUserShop.logo_text_color||"#ffffff",backgroundUrl:currentUserShop.background_url||"",coverUrl:currentUserShop.cover_url||"",description:currentUserShop.description||""});
    setShowShopSettings(true);
  }
  function openProfileSettings() {
    setProfileSettingsDraft({...profileSettings});
    setProfileDescriptionDraft(profileDescription);
    setLocalPlatformBackgroundDraft(localPlatformBackground);
    setShowProfileSettings(true);
  }
  function copyBotReferralLink() {
    if(!telegramUser?.id||!serverAuthenticated){flash("Откройте приложение через Telegram, чтобы получить персональную ссылку.");return;}
    const botName=(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME||"").replace(/^@/,"");
    if(!botName){flash("Добавьте NEXT_PUBLIC_TELEGRAM_BOT_USERNAME в Vercel.");return;}
    const url=`https://t.me/${botName}?start=${telegramUser.id}`;
    navigator.clipboard?.writeText(url).then(()=>flash("Персональная ссылка на бота скопирована.")).catch(()=>flash(url));
  }
  async function uploadImageInto(file: File | undefined, folder: string, onUploaded: (url: string) => void) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { flash("Максимальный размер изображения — 5 МБ."); return; }
    if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type)) { flash("Выбери изображение PNG, JPEG, WEBP или GIF."); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const url = await secureUpload(String(reader.result || ""), folder);
      if (url) onUploaded(url);
    };
    reader.onerror = () => flash("Не удалось прочитать изображение.");
    reader.readAsDataURL(file);
  }
  async function saveShopSettings() {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData || !serverAuthenticated || !currentUserShop?.id) { flash("Откройте Marketplace через Telegram как владелец магазина."); return; }
    try {
      const response = await fetch("/api/marketplace/shop-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, ...shopThemeDraft }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить настройки магазина.");
      const saved = data.shop || {};
      const updated = { ...currentUserShop, description: saved.description ?? shopThemeDraft.description, theme_key: saved.theme_key ?? shopThemeDraft.themeKey, listing_theme_key: saved.listing_theme_key ?? shopThemeDraft.themeKey, logo_text_color: saved.logo_text_color ?? shopThemeDraft.logoTextColor, background_url: saved.background_url ?? shopThemeDraft.backgroundUrl, cover_url: saved.cover_url ?? shopThemeDraft.coverUrl };
      setCurrentUserShop(updated);
      setManagedShops(old => old.map((shop: any) => String(shop.id) === String(currentUserShop.id) ? { ...shop, ...updated, theme: updated.theme_key } : shop));
      setShopThemeDraft({ themeKey: updated.theme_key, logoTextColor: updated.logo_text_color, backgroundUrl: updated.background_url || "", coverUrl: updated.cover_url || "", description: updated.description || "" });
      setShowShopSettings(false);
      flash("Настройки магазина сохранены. Они останутся доступны при следующем открытии.");
    } catch (error) { flash(error instanceof Error ? error.message : "Не удалось сохранить настройки магазина."); }
  }
  async function saveProfileSettings() {
    setLocalPlatformBackground(localPlatformBackgroundDraft.trim());
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData || !serverAuthenticated) {
      flash("Личный фон сохранён на этом устройстве. Для публичного оформления откройте площадку внутри Telegram.");
      setShowProfileSettings(false);
      return;
    }
    try {
      const response = await fetch("/api/marketplace/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, description: profileDescriptionDraft, ...profileSettingsDraft }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить профиль.");
      const saved = data.profileSettings || profileSettingsDraft;
      const next = { coverUrl: saved.coverUrl || "", backgroundUrl: saved.backgroundUrl || "", textColor: saved.textColor || "#ffffff", themeKey: saved.themeKey || "banner-purple" };
      setProfileSettings(next);
      setProfileSettingsDraft(next);
      setProfileDescription(String(data.description ?? profileDescriptionDraft).trim());
      setProfileDescriptionDraft(String(data.description ?? profileDescriptionDraft).trim());
      setShowProfileSettings(false);
      flash("Настройки профиля сохранены и будут видны другим пользователям.");
    } catch (error) { flash(error instanceof Error ? error.message : "Не удалось сохранить настройки профиля."); }
  }

  async function submitPlatformReview(targetType:"profile"|"shop", target:{username?:string;id?:string;name?:string}, stars:number, description:string) {
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData||!serverAuthenticated){flash("Откройте Marketplace через Telegram, чтобы отправить отзыв на сервер.");return false;}
    try {
      const response=await fetch("/api/marketplace/reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,targetType,targetUsername:target.username,targetTelegramId:undefined,targetShopId:target.id,targetTitle:target.name||target.username,stars,description}),cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Не удалось отправить отзыв.");
      const author=telegramUser?.username||String(telegramUser?.id||"Пользователь");
      if(targetType==="shop") setShopReviews(old=>[{shop:target.name||shopName,author,stars,text:description,status:"На модерации",id:String(data.review?.id||"")},...old]);
      else setReviews(old=>[{seller:target.username||sellerProfileUsername,author,stars,text:description,status:"На модерации",id:String(data.review?.id||"")},...old]);
      flash("Отзыв отправлен на модерацию. Получатель получит уведомление в приложении и боте.");
      return true;
    } catch(error) { flash(error instanceof Error?error.message:"Не удалось отправить отзыв.");return false; }
  }
  async function submitReviewDispute(review:any, reason:string) {
    if(!review?.id) { flash("У этого отзыва нет серверного ID. Обновите список отзывов и повторите."); return false; }
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData||!serverAuthenticated) { flash("Откройте Marketplace через Telegram, чтобы оспорить отзыв."); return false; }
    try {
      const response=await fetch("/api/marketplace/reviews/dispute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,reviewId:review.id,reason}),cache:"no-store"});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||"Не удалось оспорить отзыв.");
      setReviews(old=>old.map((r:any)=>r.id===review.id?{...r,dispute:reason,status:"Спор на проверке"}:r));
      setShopReviews(old=>old.map((r:any)=>r.id===review.id?{...r,dispute:reason,status:"Спор на проверке"}:r));
      flash("Оспаривание сохранено на сервере и передано владельцу платформы."); return true;
    } catch(error) { flash(error instanceof Error?error.message:"Не удалось оспорить отзыв."); return false; }
  }
  async function toggleProfileSubscription(targetUsername:string) {
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData||!serverAuthenticated){flash("Откройте Marketplace через Telegram, чтобы подписываться на профили.");return;}
    const key=targetUsername.replace(/^@/,""); const active=!subscriptions.includes(key);
    try {
      const response=await fetch("/api/marketplace/profile-subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,targetUsername:key,active}),cache:"no-store"});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||"Не удалось изменить подписку.");
      setSubscriptions(old=>active?[...old.filter(x=>x!==key),key]:old.filter(x=>x!==key));
      flash(active?`Вы подписались на @${key}. Новые публикации будут приходить в боте.`:`Вы отписались от @${key}.`);
    } catch(error) { flash(error instanceof Error?error.message:"Не удалось изменить подписку."); }
  }
  async function sendAccountReport() {
    if(!accountReportText.trim()) { flash("Подробно опишите, что произошло."); return; }
    if(!serverAuthenticated) { flash("Откройте Marketplace через Telegram, чтобы отправить жалобу на сервер."); return; }
    const saved=await secureAdminRequest("submit_report",{reason:accountReportReason,details:accountReportText.trim(),objectType:accountReportObjectType,objectId:accountReportObjectId||undefined,objectTitle:accountReportTitle,ownerUsername:accountReportObjectType==="profile"?sellerProfileUsername:undefined,ownerTelegramId:/^\d+$/.test(sellerProfileUsername)?Number(sellerProfileUsername):undefined,materials:[]});
    if(!saved) return;
    const raw=(saved as any).result; const row=Array.isArray(raw)?raw[0]:raw;
    setReports(old=>[{id:row?.id||Date.now(),serverId:row?.id,title:accountReportTitle,seller:sellerProfileUsername,reason:accountReportReason,details:accountReportText.trim(),status:accountReportReason.toLowerCase().includes("мошеннич")?"Новая · объект временно скрыт":"Новая",decisionComment:"",objectType:accountReportObjectType,objectId:accountReportObjectId,reporter:telegramUser?.username?`@${telegramUser.username}`:`ID ${telegramUser?.id||"—"}`,reporterId:telegramUser?.id},...old]);
    setShowAccountReport(false); setAccountReportText(""); flash("Жалоба отправлена на серверную очередь модерации.");
  }
  async function createAd() {
    if (!newTitle.trim()) { flash("Добавьте название объявления."); return; }
    let savedPhotoUrls = [...newPhotos];
    if (serverAuthenticated && savedPhotoUrls.some(url=>url.startsWith("data:"))) {
      const uploaded:string[]=[];
      for (const photo of savedPhotoUrls) {
        if (photo.startsWith("data:")) { const url=await secureUpload(photo,"listings"); if(!url) return; uploaded.push(url); }
        else uploaded.push(photo);
      }
      savedPhotoUrls=uploaded;
    }
    const ad: Ad = {
      id: Date.now(), title: newTitle.trim(), category: newCategory, sub: newSub,
      price: Number(newPrice) || 0, views: 0, seller: "you", sellerTelegramId:telegramUser?.id, emoji: "📦",
      tone: "lavender", description: newDescription || "Описание не добавлено.",
      photos: savedPhotoUrls.length, photoUrls: savedPhotoUrls, listingType: newListingType, listingGroup: listingGroup === "оба" ? "магазина" : listingGroup,
      shopId: listingGroup !== "частное" ? currentUserShop?.id : undefined
    };
    const publishPrivate = {...ad, listingGroup:"частное" as const};
    const publishShop = {...ad, listingGroup:"магазина" as const};
    setAds(old => listingGroup === "оба" ? [{...publishPrivate,id:ad.id+1},{...publishShop,id:ad.id},...old] : [ad,...old]);
    setViewHistory(old => [ad.id, ...old.filter(id => id !== ad.id)]); setShowCreate(false); if(tab!=="Витрина магазина"&&tab!=="ЛК магазин") setTab("Личный кабинет");
    if(serverAuthenticated) {
      try {
        const initData=window.Telegram?.WebApp?.initData||"";
        const variants=listingGroup==="оба"?[{...ad,id:ad.id+1,listingGroup:"частное" as const},{...ad,listingGroup:"магазина" as const}]:[ad];
        let notified=0;
        for(const item of variants) {
          const response=await fetch("/api/marketplace/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,listingId:String(item.id),title:item.title,category:item.category,subcategory:item.sub,price:item.price,description:item.description,photoUrls:item.photoUrls||[],listingType:item.listingType,listingGroup:item.listingGroup}),cache:"no-store"});
          const result=await response.json();
          if(!response.ok) throw new Error(result.error||"Не удалось сохранить объявление на сервере.");
          notified+=Number(result.notified||0);
        }
        flash(`Объявление сохранено на сервере.${notified?` Уведомлено подписчиков: ${notified}.`:""}`);
      } catch(error) { flash(error instanceof Error?`${error.message} Локальная копия осталась в этом браузере.`:"Ошибка сохранения. Локальная копия осталась в этом браузере."); }
    } else flash("Объявление добавлено только в этом браузере. Откройте Mini App через Telegram для публикации на сервере.");
    setNewTitle(""); setNewPrice(""); setNewDescription(""); setNewPhotos([]); setNewListingType("Продажа"); setListingGroup((tab === "Витрина магазина" || tab === "ЛК магазин") ? "магазина" : "частное");
  }
  async function trackListingView(ad: Ad) {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData || !serverAuthenticated) return;
    try { const response=await fetch("/api/marketplace/view", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({initData,listingId:String(ad.id),seller:ad.seller}), cache:"no-store" }); const data=await response.json(); if(response.ok&&Number.isFinite(Number(data.views))) setAds(old=>old.map(item=>item.id===ad.id?{...item,views:Number(data.views)}:item)); } catch { /* view counters must not block opening a listing */ }
  }
  async function sendReport() {
    if (!reportTarget) return;
    const target = reportTarget;
    if (!reportText.trim()) { flash("Опишите ситуацию, чтобы модерация поняла причину жалобы."); return; }
    if (!serverAuthenticated) { flash("Откройте Marketplace через Telegram, чтобы отправить жалобу на сервер."); return; }
    if (target.sellerTelegramId && target.sellerTelegramId === telegramUser?.id) { flash("Нельзя отправить жалобу на собственное объявление."); return; }
    let durableId: string | undefined;
    const submittedMaterials: string[] = [];
    for (const photo of reportPhotos) {
      if (photo.startsWith("data:")) { const uploaded = await secureUpload(photo, "reports"); if (!uploaded) return; submittedMaterials.push(uploaded); }
      else submittedMaterials.push(photo);
    }
    const saved = await secureAdminRequest("submit_report", { reason: reportReason, details: reportText.trim(), objectType: "listing", objectId: String(target.id), objectTitle: target.title, ownerUsername: target.seller, ownerTelegramId: Number(target.sellerTelegramId) || null, materials: submittedMaterials });
    if (!saved) return;
    const savedResult = (saved as any)?.result;
    const savedId = Array.isArray(savedResult) ? savedResult[0]?.id : savedResult?.id;
    if (typeof savedId === "string") durableId = savedId;
    const hiddenForReview = reportReason.toLowerCase().includes("мошеннич");
    const createdReport = { id: durableId || Date.now(), serverId: durableId, title: target.title, seller: target.seller, reason: reportReason, details: reportText.trim(), status: hiddenForReview ? "Скрыто на время проверки" : "Новая", decisionComment: "", photos: submittedMaterials, adId: target.id, objectId: String(target.id), reporter: telegramUser?.username ? "@" + telegramUser.username : "Пользователь Telegram", reporterId: telegramUser?.id, objectType: "Объявление", ownerTelegramId: target.sellerTelegramId };
    setReports(old => [createdReport, ...old]);
    if (hiddenForReview) { setAds(old => old.map(a => a.id === target.id ? { ...a, moderationHidden: true } as any : a)); audit("Временно скрыто объявление из-за жалобы на мошенничество", target.title); }
    setReportTarget(null); setReportText(""); setReportPhotos([]); flash("Жалоба отправлена на проверку модерации.");
  }

  const banners = [
    { kicker: "MARKETPLACE · BUY / SELL / DISCOVER", title: "Находи своё.\nПродавай легко.", sub: "Товары, услуги и магазины — всё в одном месте.", color: "banner-purple" },
    { kicker: "NEW FINDS · ONE COMMUNITY", title: "Меньше поиска.\nБольше находок.", sub: "Открой каталог и найди то, что давно искал.", color: "banner-blue" },
    { kicker: "YOUR STORE · YOUR STYLE", title: "Запусти свою\nвитрину сегодня.", sub: "Собери товары и услуги в красивом профиле.", color: "banner-orange" },
  ];
  const allBanners = [...banners, ...customBanners.filter(b => (tab === "Магазины" ? !!b.shops : !!b.home) && !b.hidden)];
  const currentBanner = allBanners[banner % Math.max(allBanners.length,1)];
  const seedShops: any[] = [];
  const communityShops = [
    ...seedShops.filter(seed => !managedShops.some(shop => shop.name.toLowerCase() === seed.name.toLowerCase())),
    ...managedShops.filter(shop => !shop.hidden).sort((a:any,b:any)=>Number(a.displayOrder??9999)-Number(b.displayOrder??9999)).map((shop,i) => ({...shop,category:"Магазин",theme:["banner-purple","banner-blue","banner-orange"][i%3],tagline:shop.description||"Витрина сообщества",createdAt:shop.createdAt||""})),
    ...(currentUserShop && !managedShops.some(shop => shop.name === currentUserShop.name) && !seedShops.some(shop => shop.name === currentUserShop.name) ? [{...currentUserShop,owner:"ID: "+(telegramUser?.id||""),category:"Магазин",theme:"banner-purple",tagline:currentUserShop.description||"Витрина сообщества",logo:currentUserShop.logo_url||"",createdAt:""}] : []),
  ];
  const activeShop = communityShops.find((x:any)=>x.name===shopName) || (currentUserShop?.name===shopName ? currentUserShop : null);
  const shopListings = ads.filter((ad:any) => isAdForShop(ad, activeShop || currentUserShop || {}));
  const adminListingRows = ads.filter(a => !(a as any).adminQueueHidden && (a.title+" "+a.category+" "+a.seller).toLowerCase().includes(adminSearch.toLowerCase()));
  const adminVisibleListingRows = adminListingRows.filter(a => adminListingTab === "viewed" ? adminViewedListingIds.includes(Number(a.id)) : !adminViewedListingIds.includes(Number(a.id)));

  useEffect(() => {
    const timer = window.setInterval(() => setBanner(current => (current + 1) % allBanners.length), 5000);
    return () => window.clearInterval(timer);
  }, [allBanners.length, tab]);

  const viewingProfile = tab === "Профиль продавца";
  const viewingShop = tab === "Витрина магазина" || tab === "ЛК магазин";
  const sceneShop = tab === "ЛК магазин" ? currentUserShop : activeShop;
  // Personal preferences stay local to the viewer except on another profile/store.
  const sceneTheme = viewingProfile ? publicProfileSettings?.themeKey : viewingShop ? (sceneShop?.listing_theme_key || sceneShop?.theme_key) : profileSettings.themeKey;
  const sceneTextColor = viewingProfile ? publicProfileSettings?.textColor : viewingShop ? sceneShop?.logo_text_color : profileSettings.textColor;
  const sceneBackground = viewingProfile ? publicProfileSettings?.backgroundUrl : viewingShop ? sceneShop?.background_url : (localPlatformBackground || profileSettings.backgroundUrl);
  const sceneLight = sceneTheme !== "banner-black" && sceneTextColor === "#000000";
  const sceneAccent = ({ "banner-purple": "#a78bfa", "banner-blue": "#60a5fa", "banner-pink": "#f472b6", "banner-gray": "#aeb6c3", "banner-black": "#f5f5f5" } as Record<string,string>)[sceneTheme || "banner-purple"] || "#a78bfa";
  const viewerAccent = ({ "banner-purple": "#a78bfa", "banner-blue": "#60a5fa", "banner-pink": "#f472b6", "banner-gray": "#aeb6c3", "banner-black": "#f5f5f5" } as Record<string,string>)[profileSettings.themeKey] || "#a78bfa";
  const viewerLight = profileSettings.themeKey !== "banner-black" && profileSettings.textColor === "#000000";
  const viewerBackground = localPlatformBackground || profileSettings.backgroundUrl;


  return (
    <main className={`app-shell ${siteTheme==="light"?"theme-light":"theme-dark"} profile-layout-theme-${String(sceneTheme||"banner-purple").replace("banner-","")} scene-${sceneLight?"light":"dark"} ${viewingShop?"store-scene":viewingProfile?"public-profile-scene":""} ${profileSettings.themeKey==="banner-black"?"viewer-monochrome":""}`} style={{["--viewer-accent" as any]:viewerAccent,["--viewer-text" as any]:viewerLight?"#202633":"#f5f5fa",["--viewer-muted" as any]:viewerLight?"#626b7c":"#b9b3c9",["--viewer-panel" as any]:profileSettings.themeKey==="banner-black"?"rgba(14,14,14,.96)":viewerLight?"rgba(250,251,255,.94)":"rgba(22,21,33,.94)",["--viewer-field" as any]:profileSettings.themeKey==="banner-black"?"#101010":viewerLight?"#ffffff":"#191725",["--viewer-overlay" as any]:profileSettings.themeKey==="banner-black"?"rgba(5,5,5,.94)":viewerLight?"rgba(250,251,255,.93)":"rgba(18,17,28,.93)",["--viewer-background" as any]:viewerBackground?`url("${String(viewerBackground).replace(/"/g,"%22")}")`:"none",["--scene-accent" as any]:sceneAccent,backgroundColor:sceneTheme==="banner-black"?"#000000":undefined,["--scene-background" as any]:sceneBackground?`url("${String(sceneBackground).replace(/"/g,"%22")}")`:"none", ...(sceneBackground?{backgroundImage:`linear-gradient(${sceneLight?"rgba(248,249,254,.72),rgba(248,249,254,.82)":"rgba(8,10,18,.58),rgba(8,10,18,.72)"}),url("${String(sceneBackground).replace(/"/g,"%22")}")`,backgroundAttachment:"fixed",backgroundSize:"cover",backgroundPosition:"center"}:{})}} onTouchStart={(e)=>{(window as any).__mpTouchX=e.touches[0]?.clientX}} onTouchEnd={(e)=>{const start=(window as any).__mpTouchX;const end=e.changedTouches[0]?.clientX;if(typeof start==="number"&&end-start>70&&start<60)setSideOpen(true);if(typeof start==="number"&&start-end>70&&sideOpen)setSideOpen(false)}}>
      <>{sideOpen && <button className="sidebar-scrim" aria-label="Закрыть меню" onClick={()=>setSideOpen(false)}/>}<aside className={`sidebar ${sideOpen?"sidebar-open":""}`}>
        <button className="brand" onClick={() => setSideOpen(v=>!v)} aria-label="Открыть меню">
          <span className="brand-mark">M</span><span>Marketplace<span className="brand-dot">.</span></span>
        </button>
        <div className="side-label">ПЛОЩАДКА</div>
        {[{ label: "Главная", icon: Search }, { label: "Магазины", icon: Store }].map(item => <button key={item.label} className={`nav-item ${tab === item.label ? "active" : ""}`} onClick={() => { setTab(item.label); setSelected(null); setSideOpen(false); }}><item.icon size={18}/><span>{item.label}</span></button>)}
        <div className="side-label side-label-spaced">МОЁ</div>
        {[{ label: "Мои подписки", icon: Users }, { label: "Уведомления", icon: Bell }, { label: "Избранное", icon: Heart }, { label: "История", icon: RotateCcw }, { label: "Личный кабинет", icon: UserRound }, ...(hasShopAccess ? [{ label: "ЛК магазин", icon: Store }] : [])].map(item => <button key={item.label} className={`nav-item ${tab === item.label ? "active" : ""}`} onClick={() => { setTab(item.label); setSelected(null); setSideOpen(false); setShowNotifications(false); }}><item.icon size={18}/><span>{item.label}</span>{item.label === "Избранное" && favorites.length > 0 && <span className="nav-count">{favorites.length}</span>}{item.label === "Уведомления" && unreadNotificationsCount > 0 && <span className="nav-count">{unreadNotificationsCount}</span>}</button>)}
        <div className="side-label side-label-spaced">ПОМОЩЬ</div>
        <button className={`nav-item ${tab === "FAQ" ? "active" : ""}`} onClick={() => { setTab("FAQ"); setSelected(null); setSideOpen(false); }}><CircleHelp size={18}/><span>FAQ</span></button>
        <div className="side-bottom">
          <div className="user-mini">{telegramUser?.photo_url ? <img className="avatar avatar-purple" src={telegramUser.photo_url} alt="Фото Telegram"/> : <div className="avatar avatar-purple">{(telegramUser?.first_name||"M").slice(0,1)}</div>}<div><strong>{telegramUser?.username ? "@"+telegramUser.username : "Профиль Telegram"}</strong><small>{isOwnerAccount ? "Владелец" : demoRole}</small></div>{isOwnerAccount && <ShieldCheck size={16} className="verified"/>}</div>
          {hasAdminAccess && <button className={`nav-item admin-nav ${tab === "Админ-панель" ? "active" : ""}`} onClick={() => { setTab("Админ-панель"); setSelected(null); }}><LayoutDashboard size={18}/><span>Админ-панель</span></button>}
          <div className="theme-switch-wrap"><span>Тема интерфейса</span><button className={`theme-switch ${siteTheme==="dark"?"is-dark":"is-light"}`} role="switch" aria-checked={siteTheme==="dark"} onClick={()=>setSiteTheme(old=>old==="dark"?"light":"dark")}><span className="theme-switch-knob"/><span className="theme-switch-light">☀</span><span className="theme-switch-dark">☾</span></button><small>{siteTheme==="dark"?"Тёмная":"Светлая"}</small></div>
          <div className="side-foot">МАРКЕТПЛЕЙС <span>Marketplace</span></div>
        </div>
      </aside></>

      <section className="main-area">
        {showNotifications && <button className="notification-scrim" aria-label="Закрыть уведомления" onClick={() => setShowNotifications(false)} />}
        <header className={`topbar ${showNotifications ? "notification-open" : ""}`}>
          <button className="mobile-brand" onClick={()=>setSideOpen(true)} aria-label="Открыть меню"><span className="brand-mark">M</span> Marketplace<span className="brand-dot">.</span></button>
          <div className="breadcrumb">Marketplace <span>/</span> {selected ? "Объявление" : tab}</div>
          <div className="top-actions">
            <button className="icon-button notification-button" onClick={() => setShowNotifications(!showNotifications)} aria-label="Уведомления"><Bell size={19}/>{unreadNotificationsCount>0&&<span className="notification-count">{unreadNotificationsCount>99?"99+":unreadNotificationsCount}</span>}</button>
            <button className="profile-pill" onClick={() => { setTab("Личный кабинет"); setSelected(null); }}>{telegramUser?.photo_url ? <img className="avatar avatar-purple small-avatar" src={telegramUser.photo_url} alt=""/> : <div className="avatar avatar-purple small-avatar">{(telegramUser?.first_name||"M").slice(0,1)}</div>}<span>{telegramUser?.username ? "@"+telegramUser.username : "Профиль"}</span><ChevronRight size={15}/></button>
          </div>
          {showNotifications && <div className="notification-pop"><div className="pop-title"><b>Уведомления</b><span className="soft-tag">{unreadNotificationsCount} непрочитано</span></div>{notifications.length===0&&<p>Пока нет уведомлений.</p>}{notifications.slice(0,12).map(n=><div className={`notification-line ${n.read?"is-read":"is-unread"}`} key={n.id} onClick={()=>openNotification(n)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter")openNotification(n)}}><span className="notification-dot"/><div className="notification-line-content">{n.title&&<strong>{n.title}</strong>}<b>{n.text||"Уведомление без текста"}</b><small>{n.createdAt?new Date(n.createdAt).toLocaleString("ru-RU"):""}{n.url&&<span> · Открыть</span>}</small></div></div>)}<div className="notification-pop-actions"><button className="text-button" onClick={()=>{setShowNotifications(false);setTab("Уведомления")}}>Все уведомления</button><button className="text-button" onClick={()=>void markAllNotificationsRead()} disabled={unreadNotificationsCount===0}>Прочитать все</button><button className="text-button" onClick={() => setShowNotifications(false)}>Закрыть</button></div></div>}
        </header>

        {selected ? (
          <div className="content detail-page">
            <button className="back-link" onClick={() => setSelected(null)}><ChevronLeft size={17}/> Назад к объявлениям</button>
            <div className="detail-grid">
              <div>
                <button className={`detail-photo ${selected.tone}`} onClick={() => setLightboxIndex(0)} aria-label="Открыть фото подробно">{selected.photoUrls?.[0] ? <img src={selected.photoUrls[0]} alt={selected.title}/> : <span>{selected.emoji}</span>}<div className="photo-count">▧ 1/{selected.photoUrls?.length || selected.photos || 1}</div><span className="photo-expand">⤢</span></button>
                <div className="thumb-row">{Array.from({length: selected.photoUrls?.length || selected.photos || 1}, (_, i) => <button key={i} className={`thumb ${selected.tone}`} onClick={() => setLightboxIndex(i)}>{selected.photoUrls?.[i] ? <img src={selected.photoUrls[i]} alt={`Фото ${i+1}`}/> : selected.emoji}</button>)}</div>
              </div>
              <div className="detail-info">
                <div className="eyebrow">{selected.category} <span>·</span> {selected.sub}</div>
                <h1>{selected.title}</h1>
                <div className="detail-price">{money(selected.price)}</div>
                <div className="detail-meta"><span><Eye size={16}/> {selected.views} просмотров</span><button className={`favorite-button ${favorites.includes(selected.id) ? "liked" : ""}`} onClick={() => toggleFavorite(selected.id)}><Heart size={17} fill={favorites.includes(selected.id) ? "currentColor" : "none"}/> {favorites.includes(selected.id) ? "В избранном" : "В избранное"}</button></div>
                <div className="line"/>
                <h3>Описание</h3><p className="description">{selected.description}</p>
                <div className="line"/>
                <h3>Продавец</h3>
                <button className="seller-card" onClick={() => { setSellerProfileUsername(selected.sellerTelegramId?String(selected.sellerTelegramId):selected.seller==="you"?(telegramUser?.username||String(telegramUser?.id||"")):selected.seller); setTab("Профиль продавца"); setSelected(null); }}><div className="avatar avatar-blue">{selected.seller[0].toUpperCase()}</div><div><strong>@{selected.seller}</strong><small>Профиль участника · рейтинг по одобренным отзывам</small></div><ChevronRight size={18}/></button>
                <button className="primary-button full-button" disabled={selected.seller==="you"} onClick={() => {const message=`Здравствуйте! Пишу по объявлению «${selected.title}» на Marketplace. Цена: ${money(selected.price)}. ${selected.description?`Описание: ${selected.description.slice(0,500)}. `:""}Подскажите, пожалуйста, объявление ещё актуально?`;if(!openTelegramContact(selected.seller, message))flash("У продавца не указан доступный Telegram username.")}}><MessageCircle size={18}/> {selected.seller==="you"?"Ваше объявление":"Написать продавцу"}</button>
                <button className="report-button full-button" onClick={() => setReportTarget(selected)}><Flag size={16}/> Пожаловаться на объявление</button>
                <p className="demo-note"></p>
              </div>
            </div>
          </div>
        ) : (
          <div className="content">
            {tab === "Главная" && <>
              <div className="home-create-row"><div><strong>Есть что продать?</strong><span>Размести объявление за пару минут</span></div><button className="primary-button home-create-button" onClick={()=>{setListingGroup("частное");setShowCreate(true)}}><Plus size={17}/> Подать объявление</button></div>
              <div className={`hero ${currentBanner.color}`} style={(currentBanner as any).image ? {backgroundImage:`linear-gradient(90deg,rgba(25,18,48,.92),rgba(25,18,48,.35)),url(${(currentBanner as any).image})`,backgroundSize:"cover",backgroundPosition:"center"} : undefined}>
                <div className="hero-copy"><span className="hero-kicker"><Sparkles size={13}/> {currentBanner.kicker}</span><h1>{currentBanner.title.split("\n").map((s,i)=><span key={i}>{s}<br/></span>)}</h1><p>{currentBanner.sub}</p><button className="hero-button" onClick={() => {const target=(currentBanner as any).url; if(target){try{const safe=new URL(target);if(["https:","http:"].includes(safe.protocol))window.open(safe.href,"_blank","noopener,noreferrer");else flash("Недопустимый адрес баннера.")}catch{flash("Ссылка должна быть полным URL, начинающимся с https:// или http://.")}}else document.getElementById("listing")?.scrollIntoView({behavior:"smooth"})}}>Смотреть объявления <ArrowUpRight size={16}/></button></div>
                <div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-cube">М<span>.</span></div><div className="float-card float-one">✦ <b>Новые находки</b></div><div className="float-card float-two"><Heart size={14} fill="currentColor"/> Твоё избранное</div></div>
                <div className="banner-controls"><span>{String(banner+1).padStart(2,"0")} <i>/ {String(allBanners.length).padStart(2,"0")}</i></span><button onClick={() => setBanner((banner+allBanners.length-1)%allBanners.length)} aria-label="Предыдущий баннер"><ChevronLeft size={17}/></button><button onClick={() => setBanner((banner+1)%allBanners.length)} aria-label="Следующий баннер"><ChevronRight size={17}/></button><div className="banner-progress"><span style={{width: `${(banner+1)/allBanners.length*100}%`}}/></div></div>
              </div>
              <div className="section-heading"><div><span className="section-overline">ПОИСК ПО МАРКЕТПЛЕЙСУ</span><h2>Что будем искать?</h2></div><span className="result-count">Объявления рядом с тобой</span></div>
              <div className="search-row"><div className="search-field"><Search size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Название, категория или продавец..."/>{search && <button aria-label="Очистить поиск" onClick={()=>setSearch("")}><X size={16}/></button>}</div><button className={`filter-button ${showFilters ? "filter-active" : ""}`} onClick={()=>setShowFilters(v=>!v)} aria-expanded={showFilters}><SlidersHorizontal size={17}/> Фильтры</button></div>
              <div className="category-row">{categories.filter(c=>c!=="Услуги").map((c,i)=><button key={c} onClick={()=>changeCategory(c)} className={`category-chip ${category===c?"chosen":""}`}><span className="category-symbol">{["✳","☁","⌘","◈","↗"][i]}</span>{c}</button>)}</div>
              {showFilters && <section className="filter-panel" aria-label="Фильтры объявлений">
                <div className="filter-panel-head"><div><span className="section-overline">НАСТРОЙКИ ВЫДАЧИ</span><h3>Фильтры объявлений</h3></div><button className="icon-button" aria-label="Закрыть фильтры" onClick={()=>setShowFilters(false)}><X size={17}/></button></div>
                <div className="filter-grid">
                  <div className="form-field"><label>Тип объявления</label><div className="filter-choice-row">{["Все","Покупка","Продажа"].map(type=><button key={type} className={`filter-choice ${listingType===type?"selected":""}`} onClick={()=>setListingType(type)}>{type}</button>)}</div></div>
                  <div className="form-field"><label>Цена, ₽</label><div className="price-range"><input aria-label="Цена от" type="number" min="0" placeholder="От" value={priceFrom} onChange={e=>setPriceFrom(e.target.value)}/><span>—</span><input aria-label="Цена до" type="number" min="0" placeholder="До" value={priceTo} onChange={e=>setPriceTo(e.target.value)}/></div>{priceFrom!=="" && priceTo!=="" && Number(priceFrom)>Number(priceTo) && <small className="filter-error">Цена «от» не может быть больше цены «до».</small>}</div>
                  <div className="form-field"><label>Категория</label><select value={category} onChange={e=>changeCategory(e.target.value)}>{categories.filter(c=>c!=="Услуги").map(c=><option key={c}>{c}</option>)}</select></div>
                  <div className="form-field"><label>Подкатегории <span>можно выбрать несколько</span></label><div className="filter-subcategories">{(category==="Все" ? Array.from(new Set(Object.values(subcategories).flat())) : (subcategories[category]||[])).map(s=><button type="button" key={s} className={`sub-chip ${selectedSubs.includes(s)?"chosen-sub":""}`} onClick={()=>toggleSubcategory(s)}>{selectedSubs.includes(s)?"✓ ":""}{s}</button>)}</div></div>
                </div>
                <div className="filter-panel-actions"><span>Найдено: <b>{filtered.length}</b></span><button className="secondary-button" onClick={resetFilters}><RotateCcw size={15}/> Сбросить фильтры</button><button className="primary-button" onClick={()=>setShowFilters(false)}>Показать {filtered.length}</button></div>
              </section>}
              {category!=="Все" && !showFilters && <div className="subcategory-row"><button className={sub==="Все" && selectedSubs.length===0?"sub-chip chosen-sub":"sub-chip"} onClick={()=>{setSub("Все");setSelectedSubs([])}}>Все</button>{(subcategories[category]||[]).map(s=><button key={s} className={selectedSubs.includes(s)||sub===s?"sub-chip chosen-sub":"sub-chip"} onClick={()=>toggleSubcategory(s)}>{s}</button>)}</div>}
              <div className="section-heading listing-heading" id="listing"><div><span className="section-overline">СВЕЖЕЕ НА ПЛОЩАДКЕ</span><h2>Лента объявлений <span className="heading-count">{filtered.length}</span></h2></div><select className="sort-select" aria-label="Сортировка объявлений" value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="newest">Сначала новые</option><option value="priceAsc">Сначала дешевле</option><option value="priceDesc">Сначала дороже</option></select></div>
              <div className="ad-grid">{filtered.map(ad=><AdCard key={ad.id} ad={ad} liked={favorites.includes(ad.id)} onOpen={()=>{setSelected(ad);setViewHistory(old=>[ad.id,...old.filter(id=>id!==ad.id)]);setAds(old=>old.map(x=>x.id===ad.id?{...x,views:x.views+1}:x));trackListingView(ad);}} onLike={()=>toggleFavorite(ad.id)} onReport={()=>setReportTarget(ad)}/>)}</div>
              {filtered.length===0 && <div className="empty-state"><Search size={30}/><h3>Ничего не найдено</h3><p>Попробуй изменить запрос или категорию.</p><button className="secondary-button" onClick={resetFilters}>Сбросить фильтры</button></div>}

            </>}

            {tab === "Личный кабинет" && <>
              <PageTitle overline="ТВОЁ ПРОСТРАНСТВО" title="Личный кабинет" subtitle="Профиль, настройки, статистика, отзывы и частные объявления." />
              <section className={`profile-area profile-theme-${String(profileSettings.themeKey || "banner-purple").replace("banner-", "")} ${profileSettings.textColor === "#000000" ? "profile-text-black" : "profile-text-white"}`} style={{ color: profileSettings.textColor, backgroundImage: profileSettings.backgroundUrl ? `linear-gradient(180deg,${profileSettings.textColor === "#000000" ? "rgba(255,255,255,.84),rgba(255,255,255,.90)" : "rgba(9,10,18,.58),rgba(9,10,18,.78)"}),url("${profileSettings.backgroundUrl.replace(/"/g, "%22")}")` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
                <div className={`profile-banner profile-cover-banner ${profileSettings.coverUrl ? "has-profile-cover" : ""}`} style={{ color: profileSettings.textColor, ["--profile-cover-image" as any]: profileSettings.coverUrl ? `linear-gradient(90deg,${profileSettings.textColor === "#000000" ? "rgba(255,255,255,.82),rgba(255,255,255,.48)" : "rgba(15,12,28,.82),rgba(15,12,28,.34)"}),url("${profileSettings.coverUrl.replace(/"/g, "%22")}")` : undefined }}>
                  <div className="profile-avatar-wrap">{telegramUser?.photo_url ? <img className="avatar avatar-purple profile-big" src={telegramUser.photo_url} alt="Фото Telegram" /> : <div className="avatar avatar-purple profile-big">{(telegramUser?.first_name || "М").slice(0, 1)}</div>}<button className="profile-settings-icon" title="Настройки профиля" aria-label="Настройки профиля" onClick={openProfileSettings}><Settings2 size={18} /></button></div>
                  <div className="profile-main">
                    <div className="profile-name">{telegramUser?.username ? "@" + telegramUser.username : (telegramUser?.first_name || "Профиль Telegram")} {serverVerifiedUser && <button className="identity-badge" onClick={() => flash("Профиль верифицирован владельцем.")} aria-label="Верифицированный профиль">☑️</button>} {isOwnerAccount && <button className="identity-badge" onClick={() => flash("Данный профиль является владельцем платформы.")} aria-label="Владелец платформы">👑</button>}</div>
                    <p>Telegram ID: {telegramUser?.id ?? "будет доступен при открытии из Telegram"}{telegramUser?.username ? ` · @${telegramUser.username}` : ""}</p>
                    {isOwnerAccount && <span className="soft-tag">👑 Владелец платформы</span>}
                    {hasShopAccess && <span className="shop-owner-badge"><Store size={14} /> Владелец магазина <b>· {currentUserShop?.name}</b></span>}
                    <p className="profile-description-text">{profileDescription || "Описание пока не добавлено."}</p>
                  </div>
                </div>
                <div className="profile-action-cards">
                  <button className="profile-action-card" onClick={copyBotReferralLink}><span className="profile-action-icon"><Send size={19} /></span><span><b>Реферальная ссылка</b><small>Приглашено через бота: {referralCount} · нажмите, чтобы скопировать</small></span><ChevronRight size={17} /></button>
                  <button className="profile-action-card" onClick={openProfileSettings}><span className="profile-action-icon"><Settings2 size={19} /></span><span><b>Настройки профиля</b><small>Обложка, фон, цвет текста и описание</small></span><ChevronRight size={17} /></button>
                </div>
              </section>
              <div className="stats-grid profile-stats-grid">
                <Stat icon={<Package />} label="Частные объявления" value={String(ads.filter(a => (a.seller === "you" || a.sellerTelegramId === telegramUser?.id) && a.listingGroup !== "магазина").length)} />
                <Stat icon={<Eye />} label="Просмотры объявлений" value={ads.filter(a => (a.seller === "you" || a.sellerTelegramId === telegramUser?.id) && a.listingGroup !== "магазина").reduce((total, a) => total + a.views, 0).toLocaleString("ru-RU")} />
                <Stat icon={<Heart />} label="В избранном" value={String(favorites.length)} />
                <Stat icon={<Users />} label="Подписчики профиля" value={String(profileSubscriberCount)} />
                <Stat icon={<Send />} label="Рефералы" value={String(referralCount)} />
              </div>
              <div className="section-heading"><div><span className="section-overline">ОЦЕНКИ</span><h2>Отзывы о профиле</h2></div><button className="secondary-button compact" onClick={() => setShowReviews(v => !v)}>{showReviews ? "Скрыть отзывы" : "Показать отзывы"}</button></div>
              {showReviews && <div className="review-demo-list">{reviews.filter(r => r.seller === (telegramUser?.username || "you") || r.seller === "you" || r.seller === `@${telegramUser?.username || ""}`).map((r, i) => <div className="review-list-card" key={r.id || i}><div className="stars-static">{[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= r.stars ? "star-on" : "star-off"}>★</span>)}</div><p>{r.text}</p><small>От: @{String(r.author || "Пользователь").replace(/^@/, "")} · {r.status || "На модерации"}</small>{!r.dispute && r.status === "Одобрен" && <button className="secondary-button compact" onClick={() => { setReviewDisputeIndex(reviews.findIndex((row: any) => row === r || (r.id && String(row.id) === String(r.id)))); setReviewDisputeText(""); }}>Оспорить отзыв</button>}</div>)}{reviews.filter(r => r.seller === (telegramUser?.username || "you") || r.seller === "you" || r.seller === `@${telegramUser?.username || ""}`).length === 0 && <p>Пока нет отзывов о вашем профиле.</p>}</div>}
              <div className="section-heading"><div><span className="section-overline">УПРАВЛЕНИЕ</span><h2>Мои частные объявления</h2></div><button className="primary-button" onClick={() => { setListingGroup("частное"); setNewTitle(""); setNewPrice(""); setNewDescription(""); setNewPhotos([]); setShowCreate(true); }}><Plus size={16} /> Добавить</button></div>
              <div className="ad-grid">{ads.filter(a => (a.seller === "you" || a.sellerTelegramId === telegramUser?.id) && a.listingGroup !== "магазина").map(ad => <div key={ad.id}><div className="listing-origin-tag">👤 Частное объявление</div><AdCard ad={ad} liked={favorites.includes(ad.id)} onOpen={() => { setViewHistory(old => [ad.id, ...old.filter(id => id !== ad.id)]); setSelected(ad); }} onLike={() => toggleFavorite(ad.id)} onReport={() => setReportTarget(ad)} /><div className="action-row"><button className="secondary-button compact" onClick={() => { setNewTitle(ad.title); setNewPrice(String(ad.price)); setNewCategory(ad.category); setNewSub(ad.sub); setNewDescription(ad.description); setNewPhotos(ad.photoUrls || []); setListingGroup("частное"); setShowCreate(true); }}><Pencil size={14} /> Подготовить копию</button><button className="danger-button compact" onClick={async () => { if (!window.confirm("Удалить частное объявление окончательно?")) return; const saved = serverAuthenticated ? await secureAdminRequest("delete_own_listing", { listingId: String(ad.id) }) : null; if (serverAuthenticated && !saved) return; setViewHistory(old => [ad.id, ...old.filter(id => id !== ad.id)]); setAds(old => old.filter(x => x.id !== ad.id)); audit("Удалено частное объявление", ad.title); flash(serverAuthenticated ? "Объявление удалено с сервера." : "Удалено только в этом браузере."); }}><Trash2 size={14} /> Удалить</button></div></div>)}</div>
              {ads.filter(a => (a.seller === "you" || a.sellerTelegramId === telegramUser?.id) && a.listingGroup !== "магазина").length === 0 && <div className="empty-state"><Package size={26} /><h3>Частных объявлений пока нет</h3><p>Объявления магазинов отображаются только в личном кабинете соответствующего магазина.</p></div>}
            </>}
            {tab === "Избранное" && <><PageTitle overline="СОХРАНЁННОЕ" title="Избранное" subtitle="Объявления, к которым хочется вернуться."/><div className="ad-grid">{ads.filter(a=>favorites.includes(a.id)).map(ad=><AdCard key={ad.id} ad={ad} liked={true} onOpen={()=>{setViewHistory(old=>[ad.id,...old.filter(id=>id!==ad.id)]);setSelected(ad)}} onLike={()=>toggleFavorite(ad.id)} onReport={()=>setReportTarget(ad)}/>)}</div>{favorites.length===0&&<div className="empty-state"><Heart size={30}/><h3>Пока ничего нет</h3><p>Нажми на сердечко в понравившемся объявлении.</p></div>}</>}

            {tab === "Магазины" && <><PageTitle overline="ВИТРИНЫ СООБЩЕСТВА" title="Магазины" subtitle="Магазинные витрины с товарами, услугами и собственными подборками."/><div className={`stores-feature-banner ${currentBanner.color}`} style={(currentBanner as any).image ? {backgroundImage:`linear-gradient(90deg,rgba(25,18,48,.92),rgba(25,18,48,.35)),url(${(currentBanner as any).image})`,backgroundSize:"cover",backgroundPosition:"center",cursor:(currentBanner as any).url?"pointer":undefined} : undefined} onClick={()=>{const target=String((currentBanner as any).url||"").trim();if(!target)return;try{const parsed=new URL(target);if(["https:","http:"].includes(parsed.protocol))window.open(parsed.href,"_blank","noopener,noreferrer");else flash("Ссылка баннера должна начинаться с http:// или https://.")}catch{flash("В баннере указана некорректная ссылка.")}}}><span className="shop-banner-kicker">{currentBanner.kicker}</span><h2>{currentBanner.title.replace("\n"," ")}</h2><p>{currentBanner.sub}</p><div className="stores-banner-controls"><span>{banner+1} / {allBanners.length}</span><button className="secondary-button compact" onClick={()=>setBanner((banner+allBanners.length-1)%allBanners.length)} aria-label="Предыдущий баннер"><ChevronLeft size={16}/></button><button className="secondary-button compact" onClick={()=>setBanner((banner+1)%allBanners.length)} aria-label="Следующий баннер"><ChevronRight size={16}/></button></div></div><div className="shop-banner-grid">{communityShops.map((shop:any,i:number)=>{const seller=String(shop.ownerUsername||shop.owner||"").replace(/^@|^ID:\s*/g,"").toLowerCase();const count=ads.filter(ad=>isAdForShop(ad,shop)).length;const shopImage=String(shop.logo||shop.logo_url||shop.cover_url||"");return <button className={`shop-banner-card ${shop.theme_key||shop.theme||"banner-purple"} ${shopImage?"has-shop-image":""}`} style={shopImage?{backgroundImage:`linear-gradient(180deg,rgba(9,10,18,.35),rgba(9,10,18,.88)),url("${shopImage.replace(/"/g,"%22")}")`,backgroundSize:"cover",backgroundPosition:"center"}:undefined} key={shop.id||shop.name} onClick={()=>{setShopName(shop.name);setTab("Витрина магазина")}}><div className="shop-banner-top">{shopImage?<img className="shop-small shop-logo-thumb" src={shopImage} alt={`Логотип ${shop.name}`}/>:<div className={`shop-small shop-${i%3}`}>{shop.name[0]}</div>}<span className="shop-category-tag">{shop.category||"Магазин"}</span></div><span className="shop-banner-kicker">MARKETPLACE · SHOP</span><strong>{shop.name}</strong><span className="shop-banner-tagline">{shop.tagline||shop.description||"Витрина сообщества"}</span><span className="shop-banner-meta">🏪 {count} объявлений · владелец {shop.owner||"не назначен"}</span><span className="shop-banner-link">Открыть магазин <ArrowUpRight size={15}/></span></button>})}</div></>}

            {tab === "Витрина магазина" && <><button className="back-link" onClick={()=>setTab("Магазины")}><ChevronLeft size={17}/> Все магазины</button><div className={`shop-cover ${(communityShops.find((x:any)=>x.name===shopName)?.theme_key||communityShops.find((x:any)=>x.name===shopName)?.theme||"banner-purple")} ${communityShops.find((x:any)=>x.name===shopName)?.cover_url?"has-shop-cover-image":""}`} style={{color:communityShops.find((x:any)=>x.name===shopName)?.logo_text_color||"#ffffff",["--shop-cover-image" as any]:communityShops.find((x:any)=>x.name===shopName)?.cover_url?`linear-gradient(90deg,${communityShops.find((x:any)=>x.name===shopName)?.logo_text_color==="#000000"?"rgba(255,255,255,.83),rgba(255,255,255,.50)":"rgba(19,14,37,.85),rgba(19,14,37,.32)"}),url("${String(communityShops.find((x:any)=>x.name===shopName)?.cover_url).replace(/"/g,"%22")}")`:undefined}}><div className="shop-emblem">{communityShops.find((x:any)=>x.name===shopName)?.logo||communityShops.find((x:any)=>x.name===shopName)?.logo_url?<img src={communityShops.find((x:any)=>x.name===shopName)?.logo||communityShops.find((x:any)=>x.name===shopName)?.logo_url} alt="Логотип магазина"/>:shopName[0]||"M"}</div><div className="shop-cover-copy" style={{color:communityShops.find((x:any)=>x.name===shopName)?.logo_text_color||"#ffffff"}}><span className="soft-tag">🏪 Магазин Marketplace</span><h1>{shopName}</h1><p>{communityShops.find((x:any)=>x.name===shopName)?.description|| `Витрина ${shopName}: товары, подборки и актуальные предложения.`}</p><small style={{color:communityShops.find((x:any)=>x.name===shopName)?.logo_text_color||"#ffffff"}}>Владелец: <button className="text-button" onClick={()=>{const sh=communityShops.find((x:any)=>x.name===shopName);setSellerProfileUsername(sh?.ownerTelegramId?String(sh.ownerTelegramId):String(sh?.owner||"").replace(/^ID: /,""));setTab("Профиль продавца")}}>{communityShops.find((x:any)=>x.name===shopName)?.owner||"не назначен"}</button></small><div className="shop-cover-rating"><span className="stars-static">{[1,2,3,4,5].map(n=><span key={n} className={n<=Math.round(shopReviews.filter(r=>r.shop===shopName&&r.status==="Одобрен").reduce((sum,r)=>sum+r.stars,0)/(shopReviews.filter(r=>r.shop===shopName&&r.status==="Одобрен").length||1))?"star-on":"star-off"}>★</span>)}</span><b>{(shopReviews.filter(r=>r.shop===shopName&&r.status==="Одобрен").reduce((sum,r)=>sum+r.stars,0)/(shopReviews.filter(r=>r.shop===shopName&&r.status==="Одобрен").length||1)).toFixed(1)}</b> · {shopReviews.filter(r=>r.shop===shopName&&r.status==="Одобрен").length} оценок</div></div></div><div className="shop-action-row"><button className="primary-button" onClick={()=>toggleStoreSubscription(communityShops.find((x:any)=>x.name===shopName)||{name:shopName})}><Bell size={16}/>{isStoreSubscribed(communityShops.find((x:any)=>x.name===shopName)||{name:shopName})?"Вы подписаны":"Подписаться на магазин"}</button><button className="secondary-button" onClick={()=>{const target=communityShops.find((x:any)=>x.name===shopName);setAccountReportObjectType("shop");setAccountReportObjectId(String(target?.id||""));setAccountReportTitle(`Магазин ${shopName}`);setSellerProfileUsername(target?.ownerTelegramId?String(target.ownerTelegramId):String(target?.owner||"").replace(/^ID: /,""));setAccountReportText("");setShowAccountReport(true)}}><Flag size={16}/> Пожаловаться</button><button className="secondary-button" onClick={()=>{setShowShopReviews(true);setTimeout(()=>document.querySelector(".shop-reviews-section")?.scrollIntoView({behavior:"smooth",block:"start"}),0)}}><MessageCircle size={16}/> Оценить магазин</button><button className="secondary-button" onClick={()=>{const target=communityShops.find((x:any)=>x.name===shopName);const contact=target?.ownerUsername||String(target?.owner||"").replace(/^@|^ID:\s*/g,"");if(!openTelegramContact(contact||target?.ownerTelegramId,`Здравствуйте! Пишу по магазину «${shopName}» на Marketplace. Подскажите, пожалуйста, по ассортименту, наличию и условиям заказа.`))flash("У владельца магазина не указан доступный Telegram username.")}}><Send size={16}/> Связаться с владельцем</button></div><div className={`shop-catalog-backdrop shop-theme-${(communityShops.find((x:any)=>x.name===shopName)?.listing_theme_key||communityShops.find((x:any)=>x.name===shopName)?.theme_key||"banner-purple").replace("banner-","")} ${communityShops.find((x:any)=>x.name===shopName)?.logo_text_color==="#000000"?"shop-text-black":"shop-text-white"}`} style={communityShops.find((x:any)=>x.name===shopName)?.background_url?{backgroundImage:`linear-gradient(180deg,${communityShops.find((x:any)=>x.name===shopName)?.logo_text_color==="#000000"?"rgba(255,255,255,.85),rgba(255,255,255,.93)":"rgba(9,10,18,.72),rgba(9,10,18,.88)"}),url("${String(communityShops.find((x:any)=>x.name===shopName)?.background_url).replace(/"/g,"%22")}")`}:undefined}><div className="shop-reviews-section"><div className="section-heading"><div><span className="section-overline">ОЦЕНКИ ПОКУПАТЕЛЕЙ</span><h2>Отзывы о магазине</h2></div><button className="secondary-button compact" onClick={()=>setShowShopReviews(v=>!v)}>{showShopReviews?"Скрыть отзывы":"Показать отзывы"}</button></div>{showShopReviews&&<div className="shop-reviews-panel"><div className="rating-summary"><span className="stars-static">{[1,2,3,4,5].map(n=><span key={n} className={n<=Math.round(shopReviews.filter(r=>r.shop===shopName&&r.status==="Одобрен").reduce((sum,r)=>sum+r.stars,0)/(shopReviews.filter(r=>r.shop===shopName&&r.status==="Одобрен").length||1))?"star-on":"star-off"}>★</span>)}</span><b>{(shopReviews.filter(r=>r.shop===shopName&&r.status==="Одобрен").reduce((sum,r)=>sum+r.stars,0)/(shopReviews.filter(r=>r.shop===shopName&&r.status==="Одобрен").length||1)).toFixed(1)}</b> ({shopReviews.filter(r=>r.shop===shopName&&r.status==="Одобрен").length} оценок)</div><div className="form-field"><label>Оставить отзыв</label><div className="stars">{[1,2,3,4,5].map(n=><button type="button" key={n} onClick={()=>setShopReviewStars(n)} style={{color:n<=shopReviewStars?"#ffd34e":"#687080",fontSize:27,background:"transparent",border:0,cursor:"pointer"}}>★</button>)}</div><textarea rows={3} value={shopReviewText} onChange={e=>setShopReviewText(e.target.value)} placeholder="Расскажи о своём опыте покупки"/><button className="primary-button" onClick={async()=>{if(!shopReviewText.trim()){flash("Добавьте текст отзыва.");return;}const shop=managedShops.find((x:any)=>x.name===shopName)||currentUserShop;const ok=await submitPlatformReview("shop",{id:shop?.id,name:shopName},shopReviewStars,shopReviewText.trim());if(ok)setShopReviewText("")}}>Отправить отзыв</button></div>{shopReviews.filter(r=>r.shop===shopName).map((r,i)=><div className="review-list-card" key={`${r.shop}-${r.author}-${i}`}><button className="review-author" onClick={()=>{setSellerProfileUsername(r.author.replace(/^@/,""));setTab("Профиль продавца")}}><div className="avatar avatar-blue">{r.author[0]?.toUpperCase()}</div><div><b>@{r.author}</b><small>Открыть профиль</small></div><ChevronRight size={16}/></button><div className="stars-static">{[1,2,3,4,5].map(n=><span key={n} className={n<=r.stars?"star-on":"star-off"}>★</span>)} <small>{r.stars}.0</small></div><p>{r.text}</p><small>Статус: {r.status}</small>{r.dispute&&<small>Оспаривание: {r.dispute}</small>}{shopName===currentUserShop?.name&&r.status==="Одобрен"&&<button className="secondary-button compact" onClick={()=>{setShopReviewDisputeIndex(i);setShopReviewDisputeText("")}}>Оспорить отзыв</button>}</div>)}{shopReviewDisputeIndex!==null&&<div className="form-field"><label>Причина оспаривания</label><textarea rows={3} value={shopReviewDisputeText} onChange={e=>setShopReviewDisputeText(e.target.value)} placeholder="Опишите, почему отзыв нужно проверить"/><button className="primary-button" onClick={async()=>{if(!shopReviewDisputeText.trim()){flash("Укажите причину оспаривания.");return;}const review=shopReviews[shopReviewDisputeIndex as number];const ok=await submitReviewDispute(review,shopReviewDisputeText);if(ok){setShopReviewDisputeIndex(null);setShopReviewDisputeText("")}}}>Отправить модерации</button></div>}</div>}</div><p className="temporary-stats-note">Подписчики магазина: {Number((communityShops.find((shop:any)=>shop.name===shopName)||{}).subscriberCount||0)} · уникальные просмотры витрины: {shopViewCount}</p><div className="section-heading"><div><span className="section-overline">КАТАЛОГ МАГАЗИНА</span><h2>Объявления</h2></div><span className="result-count">Магазинные товары</span></div><div className="ad-grid">{shopListings.map(ad=><div key={ad.id}><div className="listing-origin-tag">🏪 Объявление магазина</div><AdCard ad={ad} liked={favorites.includes(ad.id)} onOpen={()=>{setViewHistory(old=>[ad.id,...old.filter(id=>id!==ad.id)]);setSelected(ad)}} onLike={()=>toggleFavorite(ad.id)} onReport={()=>setReportTarget(ad)}/></div>)}{shopListings.length===0&&<div className="empty-state"><Package size={28}/><h3>Пока нет объявлений</h3><p>Новые предложения появятся здесь.</p></div>}</div></div></>}

            {tab === "Уведомления" && <><PageTitle overline="ВАЖНОЕ И НОВОЕ" title="Уведомления" subtitle="Новые объявления по подпискам, сообщения администрации и события вашего профиля."/><div className="notification-page-actions"><span className="soft-tag">{unreadNotificationsCount} непрочитано</span><button className="secondary-button compact" onClick={()=>void markAllNotificationsRead()} disabled={unreadNotificationsCount===0}>Прочитать все</button></div><div className="notification-page-list">{notifications.map(n=><article key={n.id} className={`notification-page-item ${n.read?"is-read":"is-unread"}`}><span className="notification-page-dot"/><div className="notification-page-body">{n.title&&<h3>{n.title}</h3>}<p>{n.text||"Уведомление без текста"}</p><small>{n.createdAt?new Date(n.createdAt).toLocaleString("ru-RU"):"Дата не указана"}</small><div className="action-row">{n.url&&<button className="primary-button compact" onClick={()=>openNotification(n)}>Открыть</button>}{!n.read&&<button className="secondary-button compact" onClick={()=>void markNotificationRead(n.id)}>Отметить прочитанным</button>}</div></div></article>)}{notifications.length===0&&<div className="empty-state"><Bell size={28}/><h3>Пока нет уведомлений</h3><p>Здесь появятся новые публикации по подпискам и сообщения площадки.</p></div>}</div></>}

            {tab === "История" && <><button className="back-link" onClick={()=>setTab("Личный кабинет")}><ChevronLeft size={17}/> Назад в личный кабинет</button><PageTitle overline="ТВОИ ДЕЙСТВИЯ" title="История объявлений" subtitle="Просматривай объявления, которые открывал или добавлял. Удалённые доступны только для ознакомления."/><div className="history-hero"><div><span className="section-overline">АРХИВ MARKETPLACE</span><h2>{viewHistory.length + deletedAds.length} записей</h2><p>Активные объявления можно открыть. Удалённые сохранены без возможности взаимодействия.</p></div><div className="history-symbol">◷</div></div><div className="form-field"><label>Поиск по истории</label><input placeholder="Название объявления" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="history-list">{viewHistory.length===0&&deletedAds.length===0&&<div className="empty-state"><RotateCcw size={30}/><h3>История пока пуста</h3><p>Открывай объявления — они появятся здесь.</p></div>}{viewHistory.map(id=>{const item=ads.find(a=>a.id===id)||deletedAds.find(a=>a.id===id);if(!item||!item.title.toLowerCase().includes(search.toLowerCase()))return null;const active=ads.some(a=>a.id===id);return <div className="history-card" key={id}><div className={`history-thumb ${active?"":"is-deleted"}`}>{item.emoji}</div><div className="history-card-info"><b>{item.title}</b><span>{money(item.price)}</span><small>{active?"Активное объявление":"Объявление удалено"}</small></div>{active?<button className="secondary-button compact" onClick={()=>setSelected(item)}>Просмотреть</button>:<span className="soft-tag">Только просмотр</span>}</div>})}{deletedAds.filter(a=>!viewHistory.includes(a.id)&&a.title.toLowerCase().includes(search.toLowerCase())).map(item=><div className="history-card" key={item.id}><div className="history-thumb is-deleted">{item.emoji}</div><div className="history-card-info"><b>{item.title}</b><span>—</span><small>Объявление удалено · взаимодействия недоступны</small></div><span className="soft-tag">Архив</span></div>)}</div></>}
            {tab === "Лента подписки" && <><button className="back-link" onClick={()=>setTab("Мои подписки")}><ChevronLeft size={17}/> Назад к подпискам</button><PageTitle overline="ЛЕНТА ПОДПИСКИ" title={(subFeedProfile||"").startsWith("shop:")?`Объявления магазина ${subFeedProfile!.slice(5)}`:`Частные объявления ${subFeedProfile?"@"+subFeedProfile:""}`} subtitle="Все объявления профиля с явной отметкой: магазин или частное объявление."/><div className="ad-grid">{ads.filter(a=>a.seller===((subFeedProfile||"").startsWith("shop:")?String(subFeedProfile||"").slice(5):(subFeedProfile||""))&&((subFeedProfile||"").startsWith("shop:")?a.listingGroup==="магазина":a.listingGroup!=="магазина")).map(ad=><div key={ad.id}><div className="listing-origin-tag">{ad.listingGroup==="магазина"?"🏪 Объявление магазина":"👤 Частное объявление"}</div><AdCard ad={ad} liked={favorites.includes(ad.id)} onOpen={()=>{setViewHistory(old=>[ad.id,...old.filter(id=>id!==ad.id)]);setSelected(ad)}} onLike={()=>toggleFavorite(ad.id)} onReport={()=>setReportTarget(ad)}/></div>)}{!ads.some(a=>a.seller===((subFeedProfile||"").startsWith("shop:")?String(subFeedProfile||"").slice(5):(subFeedProfile||""))&&((subFeedProfile||"").startsWith("shop:")?a.listingGroup==="магазина":a.listingGroup!=="магазина"))&&<div className="empty-state"><Package size={28}/><h3>Пока нет активных объявлений</h3><p>Если пользователь опубликует объявление, оно появится здесь.</p></div>}</div></>}
            {tab === "Мои подписки" && <><PageTitle overline="ТВОЁ СООБЩЕСТВО" title="Мои подписки" subtitle="Подписки на профили и магазины. Новые публикации появляются в ленте и уведомлениях."/><div className="shop-banner-grid">{subscriptions.filter(x=>x!=="you"&&!x.startsWith("shop-id:")&&!x.startsWith("shop:")).map((profile,i)=><button className={`shop-banner-card ${["banner-purple","banner-blue","banner-pink"][i%3]}`} key={profile} onClick={()=>{setSubFeedProfile(profile);setTab("Лента подписки")}}><div className="shop-banner-top"><div className={`shop-small shop-${i%3}`}>{profile[0]?.toUpperCase()}</div><span className="shop-category-tag">Профиль</span></div><span className="shop-banner-kicker">MARKETPLACE · ПОДПИСКА</span><strong>@{profile.replace(/^@/,"")}</strong><span className="shop-banner-tagline">Частные объявления пользователя</span><span className="shop-banner-link">Открыть ленту <ArrowUpRight size={15}/></span></button>)}{subscriptions.filter(x=>x.startsWith("shop-id:")||x.startsWith("shop:")).map((key,i)=>{const id=key.startsWith("shop-id:")?key.slice(8):"";const sh=managedShops.find((x:any)=>String(x.id)===id)||managedShops.find((x:any)=>String(x.name)===key.slice(5));if(!sh)return null;return <button className={`shop-banner-card ${sh.theme_key||"banner-purple"}`} key={key} onClick={()=>{setShopName(sh.name);setTab("Витрина магазина")}}><div className="shop-banner-top">{(sh.logo||sh.logo_url)?<img className="shop-small shop-logo-thumb" src={sh.logo||sh.logo_url} alt=""/>:<div className="shop-small">{String(sh.name||"М")[0]}</div>}<span className="shop-category-tag">Магазин</span></div><span className="shop-banner-kicker">MARKETPLACE · ПОДПИСКА</span><strong>{sh.name}</strong><span className="shop-banner-tagline">{sh.description||"Магазин в вашей подборке"}</span><span className="shop-banner-link">Открыть магазин <ArrowUpRight size={15}/></span></button>})}{deletedShopSubscriptions.map((row:any)=><article className="shop-banner-card deleted-shop-card" key={`deleted-${row.shop_id}`}><div className="shop-banner-top"><div className="shop-small">×</div><span className="shop-category-tag">Удалён</span></div><span className="shop-banner-kicker">ИСТОРИЯ ПОДПИСОК</span><strong>{row.shop_name||"Магазин"}</strong><span className="shop-banner-tagline">Данный магазин был удалён. Его объявления и связанные данные удалены с площадки.</span><small>{row.deleted_at?new Date(row.deleted_at).toLocaleDateString("ru-RU"):""}</small></article>)}{subscriptions.filter(x=>x!=="you").length===0&&deletedShopSubscriptions.length===0&&<div className="empty-state"><Users size={30}/><h3>Пока нет подписок</h3><p>Подпишись на профиль или магазин — они появятся здесь.</p><button className="primary-button" onClick={()=>setTab("Магазины")}>Найти магазины</button></div>}</div></>}
            {tab === "FAQ" && <><PageTitle overline="ПОМОЩЬ И ПОДДЕРЖКА" title="Как пользоваться Marketplace?" subtitle="Понятные инструкции по поиску, объявлениям, магазинам и безопасности."/>{hasShopAccess && <section className="shop-owner-guide"><span className="section-overline">ДЛЯ ВЛАДЕЛЬЦА МАГАЗИНА</span><h2>Как пользоваться магазином</h2><details className="faq-item"><summary>Настройка витрины <ChevronRight size={17}/></summary><p>Откройте «ЛК магазин» и нажмите «Редактировать магазин». Владелец может изменить описание, фото верхней обложки, фон витрины, тему объявлений (фиолетовую, синюю или розовую) и цвет текста. Настройки сохраняются на сервере и восстанавливаются при следующем входе.</p></details><details className="faq-item"><summary>Создание объявлений магазина <ChevronRight size={17}/></summary><p>В «ЛК магазин» нажмите «Создать объявление». Оно публикуется в привязанном магазине и отображается в витрине, а не в списке частных объявлений личного кабинета. Чтобы удалить публикацию, используйте кнопку «Удалить» у нужной карточки.</p></details><details className="faq-item"><summary>Отзывы и оспаривание <ChevronRight size={17}/></summary><p>Отзывы о магазине находятся в блоке «Отзывы о магазине». Если отзыв нарушает правила или содержит недостоверные сведения, нажмите «Оспорить отзыв», опишите основание и отправьте его на проверку администрации.</p></details><details className="faq-item"><summary>Название, логотип и владелец <ChevronRight size={17}/></summary><p>Название, логотип и владелец магазина меняются через административную панель платформы. При смене владельца принадлежность магазинных объявлений также обновляется.</p></details></section>}<div className="owner-cta faq-contact-pinned"><div className="cta-icon"><MessageCircle/></div><div><h3>Сотрудничество</h3><p>Вопросы по партнёрству, предложения и обратная связь.</p></div><button className="contact-gradient-button" onClick={()=>window.open("https://t.me/nukm0","_blank","noopener,noreferrer")}>Связаться <ArrowUpRight size={16}/></button></div><div className="faq-topic-grid"><button className="faq-topic" onClick={()=>document.getElementById("faq-use")?.scrollIntoView({behavior:"smooth"})}><b>Как пользоваться</b><span>Навигация и возможности площадки</span></button><button className="faq-topic" onClick={()=>document.getElementById("faq-violations")?.scrollIntoView({behavior:"smooth"})}><b>Нарушения</b><span>Жалобы и безопасные сделки</span></button></div><div id="faq-use" className="faq-section-title"><span className="section-overline">НАЧАЛО РАБОТЫ</span><h2>Как пользоваться</h2><p>Нажмите на вопрос, чтобы открыть подробную инструкцию.</p></div><div className="faq-list">{[{q:"Как найти нужный товар?",a:"На главной странице введите название в строку поиска. Категории помогут сузить выбор, а фильтры позволяют указать тип объявления и диапазон цены. Нажмите на карточку, чтобы увидеть фотографии, описание, цену и профиль продавца."},{q:"Что находится в главном меню?",a:"Главная — лента объявлений и поиск. Магазины — витрины продавцов с логотипами и каталогами. Избранное — объявления, которые вы сохранили сердечком. Мои подписки — выбранные профили и магазины. История — недавно просмотренные объявления. Личный кабинет — ваш профиль и публикации. FAQ — ответы и инструкции."},{q:"Как открыть магазин продавца?",a:"Откройте раздел «Магазины», выберите нужную витрину и нажмите на её карточку. Внутри магазина можно прочитать описание, просмотреть товары и ознакомиться с отзывами. Значок 🏪 у профиля показывает, что к пользователю привязан магазин."},{q:"Как создать объявление?",a:"Перейдите в «Личный кабинет» и выберите создание объявления. Укажите понятный заголовок, категорию, цену и описание. Добавьте фотографии, которые показывают реальное состояние товара. Перед публикацией проверьте текст и цену."},{q:"Как редактировать профиль?",a:"Откройте «Личный кабинет». Там отображаются доступные сведения профиля и ваши публикации. Фото, имя и username могут поступать из Telegram, если вы открыли приложение через Telegram."},{q:"Как связаться с продавцом?",a:"Откройте объявление и нажмите «Написать продавцу». Перед отправкой уточните наличие товара, итоговую цену, способ передачи и возможные дополнительные расходы."},{q:"Как добавить объявление в избранное?",a:"Нажмите на сердечко на карточке объявления или на странице товара. Сохранённые объявления будут доступны в разделе «Избранное». Повторное нажатие на сердечко убирает объявление из списка."},{q:"Как подписаться на профиль или магазин?",a:"Откройте профиль продавца или страницу магазина и нажмите «Подписаться». Найти выбранные профили и магазины можно в разделе «Мои подписки»."},{q:"Почему объявление не отображается?",a:"Возможно, объявление снял продавец, оно было удалено или временно скрыто на время рассмотрения жалобы. Если вы владелец объявления, проверьте его статус в личном кабинете."},{q:"Можно ли восстановить удалённое объявление?",a:"Если объявление удалено окончательно, восстановление через интерфейс недоступно. Перед подтверждением удаления внимательно проверьте выбранную публикацию."}].map(f=><details className="faq-item" key={f.q}><summary>{f.q}<ChevronRight size={17}/></summary><p>{f.a}</p></details>)}{faqCustomEntries.filter((entry:any)=>entry.section==="Как пользоваться").map((entry:any)=><details className="faq-item" key={entry.id}><summary>{entry.heading&&<strong>{entry.heading}: </strong>}{entry.question}<ChevronRight size={17}/></summary>{entry.parent&&<small className="faq-parent">{entry.parent}</small>}<p>{entry.answer}</p></details>)}</div><div id="faq-violations" className="faq-section-title"><span className="section-overline">БЕЗОПАСНОСТЬ</span><h2>Нарушения</h2><p>Как сообщить о проблеме и помочь разобраться в ситуации.</p></div><div className="faq-list">{[{q:"Что считается нарушением?",a:"Например, обман при сделке, намеренно неверное описание товара, подозрительные требования предоплаты, запрещённые предложения, оскорбления или попытки увести пользователя на опасные ссылки."},{q:"Как пожаловаться на объявление?",a:"Откройте страницу объявления и нажмите кнопку с флагом. Выберите наиболее подходящую причину, подробно опишите ситуацию и приложите подтверждающие материалы, если они есть."},{q:"Как пожаловаться на магазин или пользователя?",a:"Откройте магазин или профиль и используйте доступную кнопку жалобы. Укажите, что именно произошло, когда это случилось и какое объявление или сообщение связано с проблемой."},{q:"Что указать в жалобе на мошенничество?",a:"Опишите последовательность событий, обещания продавца, сумму и способ оплаты, а также приложите скриншоты переписки или другие материалы. Не публикуйте пароли, коды входа и данные банковской карты."},{q:"Что происходит после отправки жалобы?",a:"Жалоба поступает на рассмотрение. При подозрении на мошенничество объявление может быть временно скрыто на время проверки. Решение зависит от обстоятельств и доступных доказательств."},{q:"Как сообщить об ошибке?",a:"Нажмите кнопку связи внизу страницы FAQ и напишите, что вы делали перед появлением ошибки. Скриншот и название устройства помогут быстрее понять проблему."}].map(f=><details className="faq-item" key={f.q}><summary>{f.q}<ChevronRight size={17}/></summary><p>{f.a}</p></details>)}{faqCustomEntries.filter((entry:any)=>entry.section==="Нарушения").map((entry:any)=><details className="faq-item" key={entry.id}><summary>{entry.heading&&<strong>{entry.heading}: </strong>}{entry.question}<ChevronRight size={17}/></summary>{entry.parent&&<small className="faq-parent">{entry.parent}</small>}<p>{entry.answer}</p></details>)}</div>{Array.from(new Set(faqCustomEntries.map((entry:any)=>String(entry.section||"")).filter((section:string)=>section && !["Как пользоваться","Нарушения"].includes(section)))).map((section:string)=><div className="faq-section-title" key={section}><span className="section-overline">ИНФОРМАЦИЯ</span><h2>{section}</h2><div className="faq-list">{faqCustomEntries.filter((entry:any)=>entry.section===section).map((entry:any)=><details className="faq-item" key={entry.id}><summary>{entry.heading&&<strong>{entry.heading}: </strong>}{entry.question}<ChevronRight size={17}/></summary>{entry.parent&&<small className="faq-parent">{entry.parent}</small>}<p>{entry.answer}</p></details>)}</div></div>)}</>}

            {tab === "Админ-панель" && hasAdminAccess && <><header className="admin-page-heading"><div><span className="section-overline">УПРАВЛЕНИЕ ПЛОЩАДКОЙ</span><h1>Админ-панель</h1><p>Управление площадкой</p></div><span className="admin-position"><ShieldCheck size={16}/>{isOwnerAccount ? "Владелец" : serverRole}</span></header>
              <div className="admin-tiles">{[{name:"Обзор",desc:"Сводка и очередь дел",icon:LayoutDashboard,num:String(reports.filter(r=>!r.status.includes("Решено")&&!r.status.includes("Завершена")&&!r.status.includes("Отклонено")&&!r.status.includes("Одобрено владельцем")).length)},{name:"Жалобы и оспаривания",desc:"Проверка, заключения и решения",icon:Flag,num:String(reports.length)},{name:"Объявления",desc:"Каталог и окончательное удаление",icon:Package,num:String(ads.length)},{name:"Пользователи",desc:"Поиск, статистика и ограничения",icon:Users,num:"Управление"},{name:"Пользователи и роли",desc:"Сотрудники и полномочия",icon:ShieldCheck,num:String(Object.keys(staffRoles).length)},{name:"Верификация",desc:"Ручная проверка профилей",icon:ShieldCheck,num:String(Object.keys(verifiedUsers).length)},{name:"Магазины",desc:"Витрины и кабинеты магазинов",icon:Store,num:String(communityShops.length)},{name:"Отзывы",desc:"Отзывы и споры",icon:MessageCircle,num:String(adminReviewRows.length||reviews.length+shopReviews.length)},{name:"Рефералы",desc:"Кто сколько пригласил через бота",icon:Users,num:String(referralRanking.length)},{name:"Баннеры и уведомления",desc:"Витрина и объявления платформы",icon:Megaphone,num:String(banners.length)},{name:"Журнал действий",desc:"История административных операций",icon:RotateCcw,num:String(adminAudit.length)},{name:"Настройки и FAQ",desc:"Категории и справка",icon:Settings2,num:"Настройки"}].map((t,i)=><button key={t.name} className={`admin-tile ${adminPage===t.name?"tile-active":""}`} onClick={()=>{setAdminPage(t.name);setAdminPanelOpen(true)}}><div className={`tile-icon tile-${i%5}`}><t.icon size={21}/></div><strong>{t.name}</strong><span>{t.desc}</span><div className="tile-bottom"><small>{t.num}</small><ArrowUpRight size={16}/></div></button>)}</div>
              <>{adminPanelOpen && <button className="admin-drawer-scrim" aria-label="Закрыть раздел" onClick={()=>setAdminPanelOpen(false)}/>}<div className={`admin-content ${adminPanelOpen?"admin-drawer-open":"admin-drawer-closed"}`} onTouchStart={e=>{(e.currentTarget as HTMLDivElement).dataset.touchX=String(e.touches[0].clientX)}} onTouchEnd={e=>{const x=Number((e.currentTarget as HTMLDivElement).dataset.touchX||0);if(x-e.changedTouches[0].clientX>70)setAdminPanelOpen(false)}}><div className="admin-drawer-head"><button className="secondary-button compact" onClick={()=>setAdminPanelOpen(false)}><ChevronLeft size={16}/> Назад в меню</button><button className="icon-button" aria-label="Закрыть раздел" onClick={()=>setAdminPanelOpen(false)}><X size={18}/></button></div><div className="section-heading"><div><span className="section-overline">РАЗДЕЛ АДМИНИСТРИРОВАНИЯ</span><h2>{adminPage}</h2></div><span className="soft-tag">Серверная проверка роли</span></div>
              {adminPage==="Обзор" && <><div className="stats-grid admin-stats"><Stat icon={<Users/>} label="Зарегистрировано пользователей" value={String(totalRegistered)}/><Stat icon={<Users/>} label="Сотрудники" value={String(Object.keys(staffRoles).length)}/><Stat icon={<Package/>} label="Активные объявления" value={String(ads.length)}/><Stat icon={<Flag/>} label="Дела в очереди" value={String(reports.filter(r=>!r.status.includes("Решено")&&!r.status.includes("Завершена")&&!r.status.includes("Отклонено")&&!r.status.includes("Одобрено владельцем")).length)}/><Stat icon={<MessageCircle/>} label="Отзывы" value={String(reviews.length+shopReviews.length)}/></div><div className="permission-box"><h3>Требуют внимания</h3>{reports.filter(r=>!r.status.includes("Решено")&&!r.status.includes("Завершена")&&!r.status.includes("Отклонено")&&!r.status.includes("Одобрено владельцем")).map(r=><div className="permission-row" key={r.id}><div><b>{r.reason}: {r.title}</b><p>@{r.seller} · {r.status}</p></div><button className="secondary-button compact" onClick={()=>setAdminPage("Жалобы и оспаривания")}>Открыть дело</button></div>)}{reports.every(r=>r.status.includes("Решено")||r.status.includes("Отклонено")||r.status.includes("Одобрено владельцем"))&&<p>Нет незавершённых жалоб в очереди.</p>}</div><div className="permission-box"><h3>Магазины · дата создания</h3>{managedShops.length===0&&<p>Серверные магазины появятся здесь после настройки базы.</p>}{managedShops.map((shop:any)=><div className="permission-row" key={shop.id||shop.name}><div><b>{shop.name}</b><p>{shop.hidden?"Скрыт":"Опубликован"} · {shop.createdAt?new Date(shop.createdAt).toLocaleString("ru-RU"):"дата неизвестна"}</p></div><div className="action-row">{shop.id&&<><button className="secondary-button compact" onClick={()=>{setAdminShopSelected(shop);setAdminPage("Подробнее о магазине")}}>Подробнее</button>{isOwnerAccount && <button className="secondary-button compact" onClick={()=>editShopPrompt(shop)}><Pencil size={14}/> Редактировать</button>}<button className="secondary-button compact" onClick={async()=>{const saved=await secureAdminRequest("toggle_shop",{id:shop.id,hidden:!shop.hidden});if(!saved)return;setManagedShops(old=>old.map((x:any)=>x.id===shop.id?{...x,hidden:!x.hidden}:x));audit(shop.hidden?"Магазин восстановлен":"Магазин скрыт",shop.name)}}>{shop.hidden?"Вернуть":"Скрыть"}</button><button className="danger-button compact" onClick={async()=>{if(!window.confirm(`Удалить магазин «${shop.name}»?`))return;const saved=await secureAdminRequest("delete_shop",{id:shop.id});if(!saved)return;setManagedShops(old=>old.filter((x:any)=>String(x.id)!==String(shop.id)));if(String(currentUserShop?.id||"")===String(shop.id)){setCurrentUserShop(null);setTab("Магазины");}setSubscriptions(old=>old.filter((key:string)=>key!==`shop-id:${shop.id}`&&key!==`shop:${shop.name}`));audit("Магазин удалён",shop.name)}}><Trash2 size={14}/> Удалить</button></>}</div></div>)}</div><div className="permission-box"><h3>Баннеры · дата создания</h3>{customBanners.length===0&&<p>Серверные баннеры появятся здесь после настройки базы.</p>}{customBanners.map((b:any)=><div className="permission-row" key={b.id||b.title}><div><b>{b.title}</b><p>{b.hidden?"Скрыт":"Опубликован"} · {b.createdAt?new Date(b.createdAt).toLocaleString("ru-RU"):"дата неизвестна"}</p></div><div className="action-row"><button className="secondary-button compact" onClick={async()=>{if(typeof b.id==="string"){const saved=await secureAdminRequest("toggle_banner",{id:b.id,hidden:!b.hidden});if(!saved)return;}setCustomBanners(old=>old.map((x:any)=>x.id===b.id?{...x,hidden:!x.hidden}:x));audit(b.hidden?"Баннер восстановлен":"Баннер скрыт",b.title)}}>{b.hidden?"Вернуть":"Скрыть"}</button><button className="danger-button compact" onClick={async()=>{if(!window.confirm(`Удалить баннер «${b.title}»?`))return;if(typeof b.id==="string"){const saved=await secureAdminRequest("delete_banner",{id:b.id});if(!saved)return;}setCustomBanners(old=>old.filter((x:any)=>x.id!==b.id));audit("Баннер удалён",b.title)}}><Trash2 size={14}/> Удалить</button></div></div>)}</div></>}
              {adminPage==="Жалобы и оспаривания" && <><div className="form-field"><label>Поиск по жалобам</label><input value={adminSearch} onChange={e=>setAdminSearch(e.target.value)} placeholder="Причина, объявление или пользователь"/></div><div className="form-field"><label>Комментарий для текущего заключения / решения</label><textarea rows={3} value={adminDecisionComment} onChange={e=>setAdminDecisionComment(e.target.value)} placeholder="Опишите проверку, основания и вывод"/></div><div className="form-field"><label>Рекомендуемое ограничение</label><select value={adminRestriction} onChange={e=>setAdminRestriction(e.target.value)}>{["Без ограничения","Предупреждение","Скрыть объявление","Временная блокировка","Постоянная блокировка","Запросить дополнительную проверку"].map(x=><option key={x}>{x}</option>)}</select></div>{adminRestriction==="Временная блокировка"&&<div className="form-field"><label>Длительность блокировки</label><div className="form-two"><input aria-label="Дни блокировки" type="number" min="0" max="3650" value={reportDuration.days} onChange={e=>setReportDuration(v=>({...v,days:e.target.value}))} placeholder="Дни"/><input aria-label="Часы блокировки" type="number" min="0" max="23" value={reportDuration.hours} onChange={e=>setReportDuration(v=>({...v,hours:e.target.value}))} placeholder="Часы"/><input aria-label="Минуты блокировки" type="number" min="0" max="59" value={reportDuration.minutes} onChange={e=>setReportDuration(v=>({...v,minutes:e.target.value}))} placeholder="Минуты"/></div><small className="form-hint">Общая длительность: {durationMinutes()} минут.</small></div>}<div className="report-list">{reports.filter(r=>(r.reason+" "+r.title+" "+r.seller+" "+r.status+" "+(r.reporter||"")).toLowerCase().includes(adminSearch.toLowerCase())).map((r:any)=><div className="report-row report-detail-row" key={r.id}><div className="report-flag"><Flag size={17}/></div><div style={{flex:1,minWidth:0}}><b>{r.reason} · {r.title}</b><small>Жалоба #{String(r.id).slice(-8)} · {r.createdAt?new Date(r.createdAt).toLocaleString("ru-RU"):"дата не указана"}</small><small>Отправитель: {r.reporter||"не указан"}{r.reporterId?` · Telegram ID ${r.reporterId}`:""}</small><small>Объект: {r.objectType||"Объявление"} · Владелец: @{String(r.seller||"не указан").replace(/^@/,"")}{r.ownerTelegramId?` · ID ${r.ownerTelegramId}`:""}</small><small>Статус: {r.status}{r.reviewer?` · Проверяющий: ${r.reviewer}`:""}</small><p>{r.details}</p>{ads.find((a)=>String(a.id)===String(r.adId??r.objectId))&&<div className="permission-box"><b>Объект жалобы</b><p>{ads.find((a)=>String(a.id)===String(r.adId??r.objectId))?.title}</p><button className="secondary-button compact" onClick={()=>setSelected(ads.find((a)=>String(a.id)===String(r.adId??r.objectId))||null)}>Открыть объявление</button></div>}{r.photos?.length>0&&<div className="picked-photos">{r.photos.map((photo:string,i:number)=><a key={i} href={photo} target="_blank" rel="noreferrer">Материал {i+1}</a>)}</div>}{r.decisionComment&&<p>Заключение и история: {r.decisionComment}</p>}{r.ownerComment&&<p>Решение владельца: {r.ownerComment}</p>}<div className="form-field"><label>Telegram ID владельца объекта (для мер к аккаунту)</label><input inputMode="numeric" value={reportTargetIds[String(r.id)]??String(r.ownerTelegramId||"")} onChange={e=>setReportTargetIds(old=>({...old,[String(r.id)]:e.target.value.replace(/[^0-9]/g,"")}))} placeholder="ID из проверенного профиля"/></div><div className="action-row">{["Модератор","Администратор","Владелец","Заместитель владельца"].includes(serverRole)&&!String(r.status).startsWith("Решено")&&!String(r.status).startsWith("Завершена")&&<button className="secondary-button compact" disabled={!!r.reviewer&&!String(r.reviewer).includes(String(telegramUser?.id||""))} onClick={()=>claimReport(r)}><CheckCircle2 size={14}/> {r.reviewer?"В работе":"Взять в работу"}</button>}{["Модератор","Администратор"].includes(serverRole)&&r.status==="Взята в работу"&&<button className="secondary-button compact" onClick={()=>recommendReport(r)}>Передать заключение</button>}{isLeadership&&!String(r.status).startsWith("Решено")&&!String(r.status).startsWith("Завершена")&&<><button className="primary-button compact" onClick={()=>decideReport(r,"apply")}>Применить решение</button><button className="secondary-button compact" onClick={()=>decideReport(r,"dismiss")}>Без наказания</button><button className="secondary-button compact" onClick={()=>decideReport(r,"recheck")}>На проверку</button></>}</div></div><span className="soft-tag">{r.status}</span></div>)}</div><p className="temporary-stats-note">Модератор закрепляет жалобу за собой и передаёт заключение с рекомендуемой мерой. Владелец или заместитель может принять решение сразу, изменить рекомендацию либо закрыть дело без наказания.</p></>}
              {adminPage==="Объявления" && <><div className="admin-listing-tabs"><button className={adminListingTab==="new"?"selected":""} onClick={()=>setAdminListingTab("new")}>Новые <span>{adminListingRows.filter(a=>!adminViewedListingIds.includes(Number(a.id))).length}</span></button><button className={adminListingTab==="viewed"?"selected":""} onClick={()=>setAdminListingTab("viewed")}>Просмотренные <span>{adminListingRows.filter(a=>adminViewedListingIds.includes(Number(a.id))).length}</span></button></div><div className="form-field"><label>Поиск объявлений</label><input value={adminSearch} onChange={e=>setAdminSearch(e.target.value)} placeholder="Название, категория или продавец"/></div><div className="ad-grid">{adminVisibleListingRows.map(ad=><div key={ad.id}><AdCard ad={ad} liked={favorites.includes(ad.id)} onOpen={()=>{setAdminViewedListingIds(old=>old.includes(Number(ad.id))?old:[Number(ad.id),...old]);setSelected(ad)}} onLike={()=>toggleFavorite(ad.id)} onReport={()=>setReportTarget(ad)}/><div className="action-row">{(serverRole==="Владелец"||serverRole==="Заместитель владельца"||serverRole==="Администратор")&&<><button className="secondary-button compact" onClick={async()=>{const saved=await secureAdminRequest("hide_from_admin_queue",{objectType:"listing",objectId:String(ad.id),hidden:true,reason:"Проверено администрацией"});if(!saved)return;setAds(old=>old.map(x=>x.id===ad.id?{...x,adminQueueHidden:true} as any:x));audit("Объявление скрыто только из рабочего списка",ad.title);flash("Объявление убрано из рабочего списка, публикация сохранена.")}}><EyeOff size={14}/> Убрать из списка</button><button className="danger-button compact" onClick={async()=>{if(!window.confirm("Удалить объявление окончательно из базы Supabase? Действие нельзя отменить."))return;const saved=await secureAdminRequest("delete_listing",{listingId:String(ad.id)});if(!saved)return;setAds(old=>old.filter(x=>x.id!==ad.id));setViewHistory(old=>old.filter(id=>id!==ad.id));setDeletedAds(old=>old.filter(x=>x.id!==ad.id));setAdminViewedListingIds(old=>old.filter(id=>id!==Number(ad.id)));audit("Окончательно удалено объявление",ad.title);flash("Объявление удалено из серверной базы.")}}><Trash2 size={14}/> Удалить окончательно</button></>}</div></div>)}</div>{adminVisibleListingRows.length===0&&<div className="empty-state"><Package size={28}/><h3>{adminListingTab==="new"?"Новых объявлений нет":"Просмотренных объявлений нет"}</h3><p>{adminListingTab==="new"?"Открой вкладку «Просмотренные», чтобы управлять уже проверенными публикациями.":"Открой объявление во вкладке «Новые» — оно появится здесь."}</p></div>}</>}
              {adminPage==="Пользователи и роли" && <><p>Новые аккаунты получают роль обычного пользователя. Назначайте сотрудникам права по Telegram ID; ID владельца 998579758 защищён.</p>{isOwnerAccount && <div className="permission-box"><h3>Назначить права аккаунту</h3><div className="form-field"><label>Telegram ID</label><input value={staffDraft.id} onChange={e=>setStaffDraft(v=>({...v,id:e.target.value.replace(/[^0-9]/g,"")}))} placeholder="123456789"/></div><div className="form-field"><label>Username (необязательно)</label><input value={staffDraft.username} onChange={e=>setStaffDraft(v=>({...v,username:e.target.value.startsWith("@")?e.target.value:"@"+e.target.value}))} placeholder="@username"/></div><div className="form-field"><label>Роль</label><select value={staffDraft.role} onChange={e=>setStaffDraft(v=>({...v,role:e.target.value}))}>{["Участник","Стажёр","Модератор","Администратор","Заместитель владельца"].map(r=><option key={r}>{r}</option>)}</select></div><button className="primary-button" onClick={async()=>{if(!staffDraft.id||Number(staffDraft.id)===998579758){flash("Укажите Telegram ID другого пользователя.");return;}const saved=await secureAdminRequest(staffDraft.role==="Участник"?"remove_role":"assign_role",{telegramId:Number(staffDraft.id),role:staffDraft.role});if(!saved)return;setStaffRoles(old=>({...old,[`id:${staffDraft.id}`]:staffDraft.role,...(staffDraft.username.trim()?{["@"+staffDraft.username.trim().replace(/^@/,"")]:staffDraft.role}:{})}));if(staffDraft.role==="Магазин"&&staffDraft.username.trim())setStaffBadges(old=>({...old,["@"+staffDraft.username.trim().replace(/^@/,"")] : "🏪"}));audit("Назначена роль Telegram ID",staffDraft.id+" → "+staffDraft.role);setStaffDraft({id:"",username:"",role:"Модератор"});flash("Права назначены на сервере.")}}><Plus size={16}/> Сохранить права</button></div>}{Object.entries(staffRoles).map(([user,role])=><div className="permission-row" key={user}><div><b>{user}</b><p>Текущая роль: {role} · {staffBadges[user]||""}</p>{demoRole==="Владелец"&&<div className="form-field"><label>Эмодзи статуса сотрудника</label><input aria-label={`Эмодзи статуса ${user}`} maxLength={8} value={staffBadges[user]||""} onChange={e=>setStaffBadges(old=>({...old,[user]:e.target.value}))} placeholder="🛡️"/></div>}</div>{(demoRole==="Владелец" || (demoRole==="Заместитель владельца" && role!=="Владелец" && role!=="Заместитель владельца"))&&user!=="@nukm0"&&user!=="id:998579758"&&<select value={role} onChange={async e=>{const newRole=e.target.value;const idMatch=user.match(/^id:(\d+)$/);if(!idMatch){flash("Для изменения роли выберите запись с Telegram ID.");return;}const saved=await secureAdminRequest(newRole==="Участник"?"remove_role":"assign_role",{telegramId:Number(idMatch[1]),role:newRole});if(!saved)return;setStaffRoles(old=>({...old,[user]:newRole}));audit("Изменена роль сотрудника",user+" → "+newRole);flash("Роль обновлена на сервере.")}}>{["Участник","Стажёр","Модератор","Администратор",...(demoRole==="Владелец"?["Заместитель владельца"]:[])].map(r=><option key={r}>{r}</option>)}</select>}</div>)}</>}
              {adminPage==="Пользователи" && <div className="permission-box"><h3>Поиск пользователей Telegram</h3><p>Ищи по Telegram ID, username или отображаемому имени. Результаты содержат только аккаунты, которые хотя бы раз открыли Mini App через проверенную Telegram-сессию.</p><div className="form-field"><label>Никнейм, Telegram ID или @username</label><input value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="998579758 или @username"/></div><button className="primary-button" onClick={async()=>{if(userSearch.trim().length<2){flash("Введите не менее двух символов для поиска.");return;}const result=await secureAdminRequest("search_users",{query:userSearch.trim()});if(!result)return;setUserResults(Array.isArray((result as any).result)?(result as any).result:[]);setSelectedAdminUser(null);flash(`Найдено пользователей: ${Array.isArray((result as any).result)?(result as any).result.length:0}`)}}><Search size={16}/> Найти пользователя</button><div className="report-list">{userResults.map((u:any)=><button key={u.telegram_id} className="permission-row" onClick={()=>setSelectedAdminUser(u)} style={{width:"100%",textAlign:"left",cursor:"pointer"}}><div>{u.photo_url?<img src={u.photo_url} alt="" style={{width:44,height:44,objectFit:"cover",borderRadius:14,float:"left",marginRight:12}}/>:<div className="avatar avatar-purple" style={{float:"left",marginRight:12}}>{String(u.first_name||u.username||"U").slice(0,1)}</div>}<b>{[u.first_name,u.last_name].filter(Boolean).join(" ")||u.username||"Пользователь Telegram"}</b><p>{u.username?"@"+u.username+" · ":""}ID {u.telegram_id}</p><small>Регистрация: {u.created_at?new Date(u.created_at).toLocaleString("ru-RU"):"не указана"} · {u.active_ban?"Есть активная блокировка":"Нет активной блокировки"}</small></div><ChevronRight/></button>)}</div>{selectedAdminUser&&<div className="permission-box"><h3>Профиль пользователя</h3><p><b>{[selectedAdminUser.first_name,selectedAdminUser.last_name].filter(Boolean).join(" ")||"Без имени"}</b></p><p>{selectedAdminUser.username?"@"+selectedAdminUser.username:"Без username"} · Telegram ID {selectedAdminUser.telegram_id}</p><div className="stats-grid"><Stat icon={<Eye/>} label="Просмотрено объявлений" value={String(selectedAdminUser.listing_views||0)}/><Stat icon={<Package/>} label="Объявления" value={String(selectedAdminUser.listing_count||0)}/><Stat icon={<Flag/>} label="Жалобы" value={String(selectedAdminUser.report_count||0)}/><Stat icon={<ShieldCheck/>} label="Верификация" value={selectedAdminUser.verified?"Да":"Нет"}/></div>{selectedAdminUser.active_ban&&<p className="form-hint">Активная блокировка: {selectedAdminUser.active_ban.reason} · {selectedAdminUser.active_ban.permanent?"навсегда":selectedAdminUser.active_ban.expires_at?"до "+new Date(selectedAdminUser.active_ban.expires_at).toLocaleString("ru-RU"):"срок не указан"}</p>}<div className="action-row"><button className="secondary-button" onClick={async()=>{const result=await secureAdminRequest("clear_bans",{telegramId:Number(selectedAdminUser.telegram_id)});if(!result)return;setSelectedAdminUser({...selectedAdminUser,active_ban:null});setUserResults(old=>old.map(u=>u.telegram_id===selectedAdminUser.telegram_id?{...u,active_ban:null}:u));flash("Активные блокировки сняты.")}}>Снять ограничения</button><button className="danger-button" onClick={async()=>{const saved=await secureAdminRequest("set_ban",{telegramId:Number(selectedAdminUser.telegram_id),reason:userBanReason,permanent:userBanPermanent,durationMinutes:Number(userBanMinutes)});if(!saved)return;flash("Блокировка сохранена на сервере.");setSelectedAdminUser({...selectedAdminUser,active_ban:{reason:userBanReason,permanent:userBanPermanent,expires_at:userBanPermanent?null:new Date(Date.now()+Number(userBanMinutes)*60000).toISOString()}})}}><Ban size={15}/> Заблокировать</button></div><div className="form-field"><label>Причина ограничения</label><input value={userBanReason} onChange={e=>setUserBanReason(e.target.value)}/></div><div className="form-field"><label>Срок</label><select value={userBanPermanent?"permanent":"temporary"} onChange={e=>setUserBanPermanent(e.target.value==="permanent")}><option value="temporary">Временная блокировка</option><option value="permanent">Навсегда</option></select></div>{!userBanPermanent&&<div className="form-field"><label>Длительность в минутах</label><input type="number" min="1" value={userBanMinutes} onChange={e=>setUserBanMinutes(e.target.value)}/></div>}</div>}</div>}
              {adminPage==="Верификация" && <>{isOwnerAccount?<div className="permission-box"><h3>Ручная верификация профиля</h3><p>Данные Telegram (имя, username, фото и ID) берутся из проверенной сервером сессии. ФИО и телефон доступны только владельцу для проверки.</p><div className="form-field"><label>Telegram ID *</label><input value={verificationDraft.id} onChange={e=>setVerificationDraft(v=>({...v,id:e.target.value.replace(/[^0-9]/g,"")}))} placeholder="998123456"/></div><div className="form-field"><label>ФИО *</label><input value={verificationDraft.fullName} onChange={e=>setVerificationDraft(v=>({...v,fullName:e.target.value}))} placeholder="Фамилия Имя Отчество"/></div><div className="form-field"><label>Телефон *</label><input type="tel" value={verificationDraft.phone} onChange={e=>setVerificationDraft(v=>({...v,phone:e.target.value}))} placeholder="+7..."/></div><div className="form-field"><label>Username Telegram (необязательно)</label><input value={verificationDraft.username} onChange={e=>setVerificationDraft(v=>({...v,username:e.target.value.replace(/^@/,"")}))} placeholder="username"/></div><div className="form-field"><label>Никнейм (необязательно)</label><input value={verificationDraft.nickname} onChange={e=>setVerificationDraft(v=>({...v,nickname:e.target.value}))} placeholder="Никнейм пользователя"/></div><button className="primary-button" onClick={async()=>{if(!verificationDraft.id||!verificationDraft.fullName.trim()||!verificationDraft.phone.trim()){flash("Заполните Telegram ID, ФИО и телефон.");return;}const saved=await secureAdminRequest("verify_user",{telegramId:Number(verificationDraft.id),fullName:verificationDraft.fullName.trim(),phone:verificationDraft.phone.trim(),username:verificationDraft.username.trim(),nickname:verificationDraft.nickname.trim()});if(!saved)return;setVerifiedUsers(old=>({...old,[verificationDraft.id]:{...verificationDraft}}));audit("Вручную верифицирован пользователь",verificationDraft.id+" · "+verificationDraft.fullName);setVerificationDraft({fullName:"",phone:"",id:"",username:"",nickname:""});flash("Верификация сохранена на сервере.")}}><ShieldCheck size={16}/> Подтвердить профиль</button><h3 style={{marginTop:24}}>Недавние локальные записи</h3>{Object.entries(verifiedUsers).map(([id,u]:[string,any])=><div className="permission-row" key={id}><div><b>{u.fullName}</b><p>ID {id} · {u.username?"@"+u.username:"username не указан"} · {u.phone}</p></div><span className="soft-tag">Отмечен</span></div>)}</div>:<div className="empty-state"><ShieldCheck size={30}/><h3>Только владелец платформы</h3><p>Ручная верификация доступна владельцу.</p></div>}</>}
              {adminPage==="Магазины" && <><div className="permission-box"><h3>Редактирование размещения магазинов</h3><p>Измени порядок карточек витрин. Случайное размещение перемешивает только текущие магазины и сохраняет порядок в этой сессии.</p><div className="action-row"><button className="secondary-button" onClick={()=>setShopOrderDraft(communityShops.map((shop:any)=>String(shop.id||shop.name)))}>Загрузить текущий порядок</button><button className="secondary-button" onClick={()=>{const shuffled=[...communityShops].sort(()=>Math.random()-.5).map((shop:any)=>String(shop.id||shop.name));setShopOrderDraft(shuffled);setManagedShops(old=>old.map((shop:any)=>({...shop,displayOrder:shuffled.indexOf(String(shop.id||shop.name))})));flash("Порядок перемешан. Нажми «Сохранить порядок», чтобы записать его на сервер.")}}>В разброс</button><button className="primary-button" onClick={async()=>{const orders=shopOrderDraft.map((id:string,index:number)=>({id,order:index})).filter((x:any)=>/^[0-9a-f-]{36}$/i.test(x.id));const saved=await secureAdminRequest("set_shop_order",{orders});if(!saved)return;setManagedShops(old=>old.map((shop:any)=>({...shop,displayOrder:shopOrderDraft.indexOf(String(shop.id||shop.name))})));flash("Порядок магазинов сохранён.")}}>Сохранить порядок</button></div>{communityShops.map((shop:any,i:number)=><div className="permission-row" key={shop.id||shop.name}><div><b>{shop.name}</b><p>Позиция {i+1}</p></div><div className="action-row"><button className="secondary-button compact" disabled={i===0} onClick={()=>{const items=[...communityShops];[items[i-1],items[i]]=[items[i],items[i-1]];setShopOrderDraft(items.map((x:any)=>String(x.id||x.name)));setManagedShops(old=>old.map((item:any)=>({...item,displayOrder:items.findIndex((x:any)=>String(x.id||x.name)===String(item.id||item.name))})))}}><ChevronLeft size={14}/> Выше</button><button className="secondary-button compact" disabled={i===communityShops.length-1} onClick={()=>{const items=[...communityShops];[items[i+1],items[i]]=[items[i],items[i+1]];setShopOrderDraft(items.map((x:any)=>String(x.id||x.name)));setManagedShops(old=>old.map((item:any)=>({...item,displayOrder:items.findIndex((x:any)=>String(x.id||x.name)===String(item.id||item.name))})))}}>Ниже <ChevronRight size={14}/></button></div></div>)}</div><div className="permission-box"><h3>Создать магазин и назначить владельца</h3><div className="form-field"><label>Название магазина</label><input value={shopDraft.name} onChange={e=>setShopDraft(v=>({...v,name:e.target.value}))} placeholder="Название витрины"/></div><div className="form-field"><label>Описание магазина</label><textarea rows={3} value={shopDraft.description} onChange={e=>setShopDraft(v=>({...v,description:e.target.value}))} placeholder="Чем занимается магазин"/></div><div className="form-field"><label>Логотип магазина</label><input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>setShopDraft(v=>({...v,logo:String(reader.result)}));reader.readAsDataURL(file)}}/>{shopDraft.logo&&<img src={shopDraft.logo} alt="Логотип" style={{width:64,height:64,objectFit:"cover",borderRadius:14,marginTop:8}}/>}</div><div className="form-field"><label>Telegram ID владельца (или @username)</label><input value={shopDraft.owner} onChange={e=>setShopDraft(v=>({...v,owner:e.target.value.trim().startsWith("@")?e.target.value.trim():/^\d*$/.test(e.target.value.trim())?e.target.value.trim():"@"+e.target.value.trim()}))} placeholder="998579758 или @username"/></div><button className="primary-button" onClick={async()=>{const rawOwner=shopDraft.owner.trim();const owner= /^\d+$/.test(rawOwner)?"ID: "+rawOwner:(rawOwner.startsWith("@")?rawOwner:"@"+rawOwner);const normalized=owner.toLowerCase();if(!shopDraft.name.trim()||!shopDraft.logo||rawOwner.replace(/^@/,"").length<2){flash("Укажите название, логотип магазина и Telegram ID владельца или username.");return;}if(managedShops.some(x=>x.owner.toLowerCase()===normalized||x.owner.toLowerCase().replace(/^@/,"")===normalized.replace(/^@/,""))){flash("Этот пользователь уже владеет магазином. Один пользователь может иметь только один магазин.");return;}const logoUrl=shopDraft.logo?await secureUpload(shopDraft.logo,"shops"):"";if(shopDraft.logo&&!logoUrl)return;const saved=await secureAdminRequest("create_shop",{name:shopDraft.name.trim(),description:shopDraft.description.trim(),ownerTelegramId:/^\d+$/.test(rawOwner)?Number(rawOwner):null,ownerUsername:/^@/.test(rawOwner)?rawOwner.replace(/^@/,""):null,logoUrl:logoUrl||null});if(!saved)return;const serverShop=(saved as any).result?.[0];const item={id:serverShop?.id||String(Date.now()),name:shopDraft.name.trim(),owner,ownerTelegramId:/^\d+$/.test(rawOwner)?Number(rawOwner):undefined,description:shopDraft.description.trim(),logo:logoUrl||"",createdAt:serverShop?.created_at||new Date().toISOString(),views:0,hidden:false};setManagedShops(old=>[...old,item]);setStaffBadges(old=>({...old,[owner] : "🏪"}));audit("Создан магазин и назначен владелец",item.name+" → "+owner);setShopDraft({name:"",owner:"",description:"",logo:""});flash("Магазин сохранён на сервере и добавлен в каталог.")}}><Plus size={16}/> Создать магазин</button><h3 style={{marginTop:22}}>Магазины сообщества</h3>{managedShops.map(shop=><div className="permission-row" key={shop.name}><div><b>{shop.name}</b><p>Владелец: {shop.owner} · Создан: {shop.createdAt?new Date(shop.createdAt).toLocaleDateString("ru-RU"):"системная витрина"}</p></div><div className="action-row"><button className="secondary-button compact" onClick={()=>{setAdminShopSelected(shop);setAdminPage("Подробнее о магазине")}}>Подробнее</button>{shop.id&&<><button className="secondary-button compact" onClick={async()=>{const saved=await secureAdminRequest("toggle_shop",{id:shop.id,hidden:!shop.hidden});if(!saved)return;setManagedShops(old=>old.map((x:any)=>x.id===shop.id?{...x,hidden:!x.hidden}:x));audit(shop.hidden?"Магазин восстановлен":"Магазин скрыт",shop.name);flash(shop.hidden?"Магазин восстановлен.":"Магазин скрыт.")}}>{shop.hidden?"Вернуть":"Скрыть"}</button><button className="danger-button compact" onClick={async()=>{if(!window.confirm(`Удалить магазин «${shop.name}» окончательно?`))return;const saved=await secureAdminRequest("delete_shop",{id:shop.id});if(!saved)return;setManagedShops(old=>old.filter((x:any)=>String(x.id)!==String(shop.id)));if(String(currentUserShop?.id||"")===String(shop.id)){setCurrentUserShop(null);setTab("Магазины");}setSubscriptions(old=>old.filter((key:string)=>key!==`shop-id:${shop.id}`&&key!==`shop:${shop.name}`));audit("Магазин удалён",shop.name);flash("Магазин удалён.")}}><Trash2 size={14}/> Удалить</button></>}</div></div>)}</div></>}
              {adminPage==="Подробнее о магазине" && adminShopSelected && <><div className="profile-banner">{adminShopSelected.logo?<img className="avatar avatar-purple profile-big" src={adminShopSelected.logo} alt="Логотип магазина"/>:<div className="shop-emblem">{adminShopSelected.name[0]}</div>}<div className="profile-main"><h2>{adminShopSelected.name}</h2><p>Владелец: {adminShopSelected.owner}</p><p>{adminShopSelected.description||"Описание магазина не добавлено."}</p><small>Создан: {adminShopSelected.createdAt?new Date(adminShopSelected.createdAt).toLocaleString("ru-RU"):"не указано"}</small></div></div><div className="stats-grid"><Stat icon={<Users/>} label="Подписчики магазина" value={String(adminShopSelected.subscriberCount??subscriptions.filter(x=>x===`shop:${adminShopSelected!.name}`).length)}/><Stat icon={<Package/>} label="Объявления владельца" value={String(ads.filter(a=>a.seller.replace(/^@/,"").toLowerCase()===adminShopSelected.owner.replace(/^@/,"").toLowerCase()).length)}/><Stat icon={<Flag/>} label="Жалобы на магазин" value={String(reports.filter(r=>r.seller.replace(/^@/,"").toLowerCase()===adminShopSelected.owner.replace(/^@/,"").toLowerCase()).length)}/><Stat icon={<Eye/>} label="Просмотры объявлений" value={String(ads.filter(a=>a.seller.replace(/^@/,"").toLowerCase()===adminShopSelected.owner.replace(/^@/,"").toLowerCase()).reduce((n,a)=>n+a.views,0))}/></div><div className="section-heading"><div><span className="section-overline">КАТАЛОГ</span><h2>Объявления магазина</h2></div></div><div className="report-list">{ads.filter(a=>a.seller.replace(/^@/,"").toLowerCase()===adminShopSelected.owner.replace(/^@/,"").toLowerCase()).map(ad=><div className="permission-row" key={ad.id}><div><b>{ad.title}</b><p>{money(ad.price)} · {ad.views} просмотров</p></div><button className="danger-button compact" onClick={()=>{setAds(old=>old.filter(a=>a.id!==ad.id));audit("Удалено объявление магазина",ad.title);flash("Объявление удалено окончательно.")}}><Trash2 size={14}/> Удалить</button></div>)}{ads.filter(a=>a.seller.replace(/^@/,"").toLowerCase()===adminShopSelected.owner.replace(/^@/,"").toLowerCase()).length===0&&<p>У этого владельца пока нет объявлений.</p>}</div><div className="section-heading"><div><span className="section-overline">ОБРАЩЕНИЯ</span><h2>Жалобы на магазин и владельца</h2></div></div><div className="report-list">{reports.filter(r=>r.seller.replace(/^@/,"").toLowerCase()===adminShopSelected.owner.replace(/^@/,"").toLowerCase()).map(r=><div className="report-row" key={r.id}><div><b>{r.reason} · {r.title}</b><small>{r.status}</small><p>{r.details}</p>{r.decisionComment&&<small>Комментарий: {r.decisionComment}</small>}</div></div>)}{reports.filter(r=>r.seller.replace(/^@/,"").toLowerCase()===adminShopSelected.owner.replace(/^@/,"").toLowerCase()).length===0&&<p>Актуальных жалоб не найдено.</p>}</div><div className="action-row"><button className="primary-button" onClick={()=>editShopPrompt(adminShopSelected)}><Pencil size={15}/> Редактировать магазин</button><button className="secondary-button" onClick={()=>setAdminPage("Магазины")}><ChevronLeft size={16}/> Назад к магазинам</button></div></>}
              {adminPage==="Отзывы" && <div className="review-demo-list"><div className="permission-box"><h3>Поиск и фильтры отзывов</h3><div className="form-field"><label>Поиск по username, Telegram ID или магазину</label><input value={adminReviewSearch} onChange={e=>setAdminReviewSearch(e.target.value)} placeholder="@username, 123456789 или магазин"/></div><div className="form-two"><div className="form-field"><label>Количество звёзд</label><select value={adminReviewStars} onChange={e=>setAdminReviewStars(e.target.value)}><option value="all">Все оценки</option>{[1,2,3,4,5].map(n=><option key={n} value={String(n)}>{n} из 5</option>)}</select></div><div className="form-field"><label>Оставлена / получена</label><select value={adminReviewDirection} onChange={e=>setAdminReviewDirection(e.target.value)}><option value="all">Все</option><option value="given">Оставлена пользователем</option><option value="received">Получена профилем / магазином</option></select></div></div><button className="secondary-button" onClick={async()=>{const saved=await secureAdminRequest("list_reviews",{});if(saved&&Array.isArray((saved as any).result)){setAdminReviewRows((saved as any).result);flash("Список отзывов обновлён.")}}}><RotateCcw size={14}/> Обновить отзывы</button></div>{adminReviewRows.filter((r:any)=>(String(r.author||"")+" "+String(r.authorId||"")+" "+String(r.seller||"")+" "+String(r.targetId||"")).toLowerCase().includes(adminReviewSearch.toLowerCase())&&(adminReviewStars==="all"||String(r.stars)===adminReviewStars)&&(adminReviewDirection==="all"||(adminReviewDirection==="given"&&String(r.authorId)===String(telegramUser?.id))||(adminReviewDirection==="received"&&String(r.authorId)!==String(telegramUser?.id)))).map((r:any)=><div className="review-list-card" key={r.id}><div className="review-admin-meta"><b>Кем выдана: {r.author?.startsWith("ID ")||r.author?.startsWith("@")?r.author:"@"+r.author} · ID {r.authorId}</b><b>Кому выдана: {r.targetType==="shop"?"магазину ":"профилю "}{r.seller}{r.targetId?` · ID ${r.targetId}`:""}</b></div><div className="stars-static" aria-label={`${r.stars} из 5`}>{[1,2,3,4,5].map(n=><span key={n} className={n<=r.stars?"star-on":"star-off"}>★</span>)} <small>{r.stars}/5</small></div><p><b>Описание оценки</b><br/>{r.text}</p><small>Статус: {({pending:"На модерации",approved:"Одобрен",rejected:"Отклонён",hidden:"Скрыт",disputed:"Оспаривается"} as any)[r.status]||r.status}{r.dispute?" · Оспаривание: "+r.dispute:""}</small>{r.moderatorComment&&<p>Комментарий модерации: {r.moderatorComment}</p>}<div className="action-row"><button className="primary-button compact" onClick={async()=>{const saved=await secureAdminRequest("review_decision",{id:r.id,decision:"approve"});if(!saved)return;setAdminReviewRows(old=>old.map((x:any)=>x.id===r.id?{...x,status:"approved"}:x));flash("Отзыв одобрен.")}}>Одобрить</button><button className="secondary-button compact" onClick={async()=>{const saved=await secureAdminRequest("review_decision",{id:r.id,decision:"reject"});if(!saved)return;setAdminReviewRows(old=>old.map((x:any)=>x.id===r.id?{...x,status:"rejected"}:x));flash("Отзыв отклонён.")}}>Отклонить</button><button className="secondary-button compact" onClick={async()=>{const saved=await secureAdminRequest("review_decision",{id:r.id,decision:"hide"});if(!saved)return;setAdminReviewRows(old=>old.map((x:any)=>x.id===r.id?{...x,status:"hidden"}:x));flash("Отзыв скрыт.")}}>Скрыть</button></div></div>)}{adminReviewRows.length===0&&<div className="empty-state"><MessageCircle size={28}/><h3>В базе пока нет отзывов</h3><p>Новые отзывы появятся после отправки через форму магазина или профиля и сохранения в Supabase.</p></div>}</div>}
              {adminPage==="Рефералы" && <div className="permission-box"><h3>Статистика рефералов бота</h3><p>В зачёт попадают только пользователи, которые нажали «Старт» в Telegram-боте по ссылке приглашения. Открытие Mini App без запуска бота не считается рефералом.</p><div className="stats-grid admin-stats"><Stat icon={<Users/>} label="Всего зарегистрировано в Mini App" value={String(totalRegistered)}/><Stat icon={<Send/>} label="Приглашено вами" value={String(referralCount)}/><Stat icon={<Users/>} label="Приглашавшие пользователи" value={String(referralRanking.length)}/></div><div className="form-field"><label>Поиск по ID или username</label><input value={adminReviewSearch} onChange={e=>setAdminReviewSearch(e.target.value)} placeholder="ID или @username"/></div><div className="report-list">{referralRanking.filter((r:any)=>(String(r.telegramId)+" "+r.username+" "+r.name).toLowerCase().includes(adminReviewSearch.toLowerCase())).map((r:any)=><div className="permission-row" key={r.telegramId}><div><b>{r.username?"@"+r.username:(r.name||"Пользователь")}</b><p>Telegram ID: {r.telegramId}</p></div><span className="soft-tag">Рефералов: {r.count}</span></div>)}{referralRanking.length===0&&<p>Пока нет данных о приглашениях, учтённых через запуск бота.</p>}</div></div>}
              {adminPage==="Баннеры и уведомления" && <div className="permission-box"><h3>Массовое уведомление</h3><p>Текст появится в уведомлениях Mini App всех зарегистрированных пользователей и отправится сообщением пользователям, которые уже нажали «Старт» в боте. Только владелец платформы может запустить рассылку.</p><div className="form-field"><label>Заголовок</label><input value={broadcastDraft.title} onChange={e=>setBroadcastDraft(v=>({...v,title:e.target.value}))} maxLength={120}/></div><div className="form-field"><label>Текст уведомления *</label><textarea rows={4} value={broadcastDraft.message} onChange={e=>setBroadcastDraft(v=>({...v,message:e.target.value}))} maxLength={3500} placeholder="Объявление для всех пользователей"/></div><div className="form-field"><label>Ссылка (необязательно)</label><input value={broadcastDraft.url} onChange={e=>setBroadcastDraft(v=>({...v,url:e.target.value}))} placeholder="https://..."/></div><button className="primary-button" disabled={!isOwnerAccount} onClick={async()=>{if(!broadcastDraft.message.trim()){flash("Введите текст уведомления.");return;}const saved=await secureAdminRequest("broadcast",broadcastDraft);if(!saved)return;const result=(saved as any).result||{};audit("Запущена массовая рассылка",`${result.registered||0} аккаунтов · бот отправил ${result.botSent||0}`);flash(`Рассылка завершена: ${result.registered||0} уведомлений в приложении, отправлено ботом ${result.botSent||0}.`);setBroadcastDraft({title:"Объявление администрации",message:"",url:""});}}>{isOwnerAccount?"Отправить всем":"Только владелец может отправлять рассылку"}</button><hr style={{borderColor:"var(--line)",margin:"22px 0"}}/><h3>Создать баннер</h3><div className="form-field"><label>Заголовок</label><input value={bannerDraft.title} onChange={e=>setBannerDraft(v=>({...v,title:e.target.value}))} placeholder="Заголовок баннера"/></div><div className="form-field"><label>Описание</label><textarea rows={3} value={bannerDraft.sub} onChange={e=>setBannerDraft(v=>({...v,sub:e.target.value}))} placeholder="Краткое описание"/></div><div className="form-field"><label>Ссылка для перехода</label><input value={(bannerDraft as any).url||""} onChange={e=>setBannerDraft(v=>({...v,url:e.target.value} as any))} placeholder="https://..."/></div><div className="form-field"><label>Фото баннера</label><small className="form-hint">Рекомендуемый размер: 1600 × 600 px (панорамный формат 8:3). Фото 16:9 будет обрезано по высоте; важные объекты располагайте ближе к центру.</small><input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>setBannerDraft(v=>({...v,image:String(reader.result)} as any));reader.readAsDataURL(file)}}/>{(bannerDraft as any).image&&<img src={(bannerDraft as any).image} alt="Предпросмотр баннера" style={{width:"100%",maxHeight:180,objectFit:"cover",borderRadius:12,marginTop:10}}/>}</div><div className="form-field"><label>Цвет оформления</label><select value={bannerDraft.color} onChange={e=>setBannerDraft(v=>({...v,color:e.target.value}))}><option value="banner-purple">Фиолетовый</option><option value="banner-blue">Синий</option><option value="banner-orange">Розовый / персиковый</option></select></div><div className="banner-targets"><label><input type="checkbox" checked={(bannerDraft as any).home!==false} onChange={e=>setBannerDraft(v=>({...v,home:e.target.checked} as any))}/> Главная страница</label><label><input type="checkbox" checked={!!(bannerDraft as any).shops} onChange={e=>setBannerDraft(v=>({...v,shops:e.target.checked} as any))}/> Страница магазинов</label></div><button className="primary-button" onClick={async()=>{if(!bannerDraft.title.trim()||!bannerDraft.image){flash("Введите заголовок и выберите фото баннера.");return;}if(!bannerDraft.home&&!bannerDraft.shops){flash("Выберите хотя бы одну категорию показа.");return;}let targetUrl="";if(bannerDraft.url.trim()){try{const parsed=new URL(bannerDraft.url.trim());if(!["https:","http:"].includes(parsed.protocol))throw new Error();targetUrl=parsed.href;}catch{flash("Укажите полный адрес https:// или http:// — домен Marketplace не будет добавляться автоматически.");return;}}const imageUrl=bannerDraft.image?await secureUpload(bannerDraft.image,"banners"):"";if(bannerDraft.image&&!imageUrl)return;const saved=await secureAdminRequest("create_banner",{title:bannerDraft.title.trim(),description:bannerDraft.sub.trim(),url:targetUrl,imageUrl:imageUrl||null,showHome:bannerDraft.home,showShops:bannerDraft.shops});if(!saved)return;const serverBanner=(saved as any).result?.[0];const item={...bannerDraft,id:serverBanner?.id||Date.now(),url:targetUrl,image:imageUrl||"",home:!!bannerDraft.home,shops:!!bannerDraft.shops,hidden:false,createdAt:serverBanner?.created_at||new Date().toISOString()};setCustomBanners(old=>[...old,item]);setBannerDraft({title:"",sub:"",kicker:"MARKETPLACE · НОВОСТИ",color:"banner-purple",url:"",image:"",home:true,shops:false});setBanner(0);audit("Создан баннер",item.title);flash("Баннер сохранён на сервере и добавлен в ротацию.")}}><Plus size={16}/> Добавить в ленту</button><h3 style={{marginTop:24}}>Лента баннеров</h3>{customBanners.map((b:any)=><div className="permission-row" key={b.id||b.title}><div style={{display:"flex",gap:12,alignItems:"center"}}>{b.image&&<img src={b.image} alt="" style={{width:66,height:48,objectFit:"cover",borderRadius:8}}/>}<div><b>{b.title}</b><p>{b.hidden?"Скрыт": "Опубликован"} · {[b.home&&"Главная",b.shops&&"Магазины"].filter(Boolean).join(" + ")} · Создан: {b.createdAt?new Date(b.createdAt).toLocaleDateString("ru-RU"):"дата не указана"}</p></div></div><div className="action-row"><button className="secondary-button compact" onClick={async()=>{if(typeof b.id==="string"){const saved=await secureAdminRequest("toggle_banner",{id:b.id,hidden:!b.hidden});if(!saved)return;}setCustomBanners(old=>old.map((x:any)=>x.id===b.id?{...x,hidden:!x.hidden}:x));audit(b.hidden?"Баннер возвращён в ленту":"Баннер скрыт",b.title);flash(b.hidden?"Баннер возвращён в ленту.":"Баннер скрыт из ленты.")}}>{b.hidden?"Вернуть в ленту":"Скрыть"}</button><button className="danger-button compact" onClick={async()=>{if(typeof b.id==="string"){const saved=await secureAdminRequest("delete_banner",{id:b.id});if(!saved)return;}setCustomBanners(old=>old.filter((x:any)=>x.id!==b.id));audit("Баннер удалён без восстановления",b.title);flash("Баннер удалён окончательно.")}}><Trash2 size={14}/> Удалить</button></div></div>)}</div>}
              {adminPage==="Настройки и FAQ" && <div className="permission-box"><h3>Редактор FAQ</h3><p>Создавайте разделы, заголовки, вложенные пункты и ответы. Новые записи сохраняются на сервере.</p><div className="form-field"><label>Раздел меню</label><input value={faqDraft.section} onChange={e=>setFaqDraft(v=>({...v,section:e.target.value}))} placeholder="Как пользоваться, Нарушения или новый раздел"/><small className="form-hint">Введи новое название, чтобы создать отдельную кнопку-раздел в FAQ.</small></div><div className="form-field"><label>Заголовок раздела / подраздела</label><input value={faqDraft.heading} onChange={e=>setFaqDraft(v=>({...v,heading:e.target.value}))} placeholder="Например, Безопасная сделка"/></div><div className="form-field"><label>Родительский пункт (необязательно)</label><input value={faqDraft.parent} onChange={e=>setFaqDraft(v=>({...v,parent:e.target.value}))} placeholder="Подраздел или пункт выше"/></div><div className="form-field"><label>Вопрос / пункт *</label><input value={faqDraft.question} onChange={e=>setFaqDraft(v=>({...v,question:e.target.value}))} placeholder="Задайте понятный вопрос"/></div><div className="form-field"><label>Ответ / инструкция *</label><textarea rows={4} value={faqDraft.answer} onChange={e=>setFaqDraft(v=>({...v,answer:e.target.value}))} placeholder="Подробная инструкция для пользователя"/></div><div className="action-row"><button className="primary-button" onClick={async()=>{if(!faqDraft.question.trim()||!faqDraft.answer.trim()){flash("Заполните вопрос и ответ.");return;}const saved=await secureAdminRequest("save_faq",{entry:faqDraft});if(!saved)return;const row=Array.isArray((saved as any).result)?(saved as any).result[0]:(saved as any).result;const entry={...faqDraft,id:row?.id||Date.now(),createdAt:row?.created_at||new Date().toISOString()};setFaqCustomEntries(old=>(faqDraft as any).id?old.map((x:any)=>String(x.id)===String((faqDraft as any).id)?entry:x):[...old,entry]);setFaqDraft({section:"Как пользоваться",heading:"",parent:"",question:"",answer:""});audit("Изменён FAQ",""+entry.question);flash("FAQ сохранён на сервере.")}}><Plus size={16}/> Сохранить пункт FAQ</button><button className="secondary-button" onClick={()=>setTab("FAQ")}>Посмотреть FAQ</button></div><h3 style={{marginTop:24}}>Опубликованные пункты</h3>{faqCustomEntries.map((entry:any)=><div className="permission-row" key={entry.id}><div><b>{entry.heading&&entry.heading+" · "}{entry.question}</b><p>{entry.section}{entry.parent?" · "+entry.parent:""}</p></div><div className="action-row"><button className="secondary-button compact" onClick={()=>setFaqDraft({...entry})}>Изменить</button><button className="danger-button compact" onClick={async()=>{if(typeof entry.id==="string"){const saved=await secureAdminRequest("delete_faq",{id:entry.id});if(!saved)return;}setFaqCustomEntries(old=>old.filter((x:any)=>String(x.id)!==String(entry.id)));audit("Удалён пункт FAQ",entry.question);flash("Пункт FAQ удалён.")}}><Trash2 size={14}/> Удалить</button></div></div>)}</div>}
              {adminPage==="Журнал действий" && <div className="report-list">{adminAudit.map(entry=><div className="report-row" key={entry.id}><div className="report-flag"><RotateCcw size={16}/></div><div><b>{entry.action}</b><small>{entry.actor} · {entry.target}</small><small>{entry.time}</small></div></div>)}{adminAudit.length===0&&<p>Пока нет записей. Административные действия будут отображаться здесь.</p>}</div>}
              </div></></>}
            {tab === "Админ-панель" && !hasAdminAccess && <div className="empty-state"><ShieldCheck size={30}/><h3>Доступ ограничен</h3><p>У вашей роли нет доступа к административной панели.</p><button className="secondary-button" onClick={()=>setTab("Главная")}>На главную</button></div>}



            {tab === "ЛК магазин" && hasShopAccess && <>
              <PageTitle overline="УПРАВЛЕНИЕ ВИТРИНОЙ" title={`Магазин · ${currentUserShop?.name || "Магазин"}`} subtitle="Оформление, статистика, отзывы и публикации магазина." />
              <section className={`shop-owner-workspace shop-theme-${String(shopThemeDraft.themeKey || "banner-purple").replace("banner-", "")} ${shopThemeDraft.logoTextColor === "#000000" ? "shop-text-black" : "shop-text-white"}`} style={shopThemeDraft.backgroundUrl ? { backgroundImage: `linear-gradient(180deg, ${shopThemeDraft.logoTextColor === "#000000" ? "rgba(255,255,255,.86),rgba(255,255,255,.91)" : "rgba(9,10,18,.72),rgba(9,10,18,.9)"}),url("${shopThemeDraft.backgroundUrl.replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                <div className={`shop-owner-hero ${currentUserShop?.cover_url ? "has-shop-cover-image" : ""}`} style={{ color: shopThemeDraft.logoTextColor, ["--shop-cover-image" as any]: currentUserShop?.cover_url ? `linear-gradient(90deg,${shopThemeDraft.logoTextColor === "#000000" ? "rgba(255,255,255,.82),rgba(255,255,255,.55)" : "rgba(14,10,25,.80),rgba(14,10,25,.30)"}),url("${String(currentUserShop.cover_url).replace(/"/g, "%22")}")` : undefined }}>
                  <div className="shop-owner-logo">{currentUserShop?.logo_url ? <img src={currentUserShop.logo_url} alt={`Логотип ${currentUserShop.name}`} /> : <span>{String(currentUserShop?.name || "M").slice(0, 1).toUpperCase()}</span>}</div>
                  <div className="shop-owner-hero-copy">
                    <span className="shop-owner-kicker"><Store size={13} /> ВАША ВИТРИНА</span>
                    <h2>{currentUserShop?.name || "Магазин"}</h2>
                    <p className="shop-owner-holder">Владелец: <b>{telegramUser?.username ? `@${telegramUser.username}` : `ID ${telegramUser?.id || "—"}`}</b></p>
                    <p className="shop-owner-description">{currentUserShop?.description || "Добавьте описание магазина в настройках, чтобы покупатели понимали, что вы предлагаете."}</p>
                    <span className="shop-owner-badge"><Store size={14} /> Владелец магазина <b>· {currentUserShop?.name || "Магазин"}</b></span>
                  </div>
                  <button className="secondary-button shop-edit-trigger" onClick={openShopSettings}><Settings2 size={16} /> Редактировать магазин</button>
                </div>
                <div className="shop-owner-stats stats-grid">
                  <Stat icon={<Package />} label="Объявления" value={String(ads.filter(a => isAdForShop(a, currentUserShop || {})).length)} />
                  <Stat icon={<Users />} label="Подписчики" value={String(currentUserShop?.subscriber_count ?? currentUserShop?.subscriberCount ?? 0)} />
                  <Stat icon={<Eye />} label="Просмотры витрины" value={String(shopViewCount)} />
                </div>
                <section className="shop-owner-reviews">
                  <div className="section-heading">
                    <div><span className="section-overline">ОЦЕНКИ ПОКУПАТЕЛЕЙ</span><h2>Отзывы о магазине</h2></div>
                    <button className="secondary-button compact" onClick={() => setShowShopReviews(v => !v)}>{showShopReviews ? "Скрыть отзывы" : `Показать отзывы (${shopReviews.filter(r => r.shop === currentUserShop?.name).length})`}</button>
                  </div>
                  {showShopReviews && <div className="shop-reviews-panel">
                    {shopReviews.filter(r => r.shop === currentUserShop?.name).map((review, i) => {
                      const sourceIndex = shopReviews.findIndex((row: any) => row === review || (review.id && String(row.id) === String(review.id)));
                      return <article className="review-list-card" key={`${review.id || review.author}-${i}`}>
                        <div className="review-list-card-head"><b>@{String(review.author || "Пользователь").replace(/^@/, "")}</b><span className="stars-static">{[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= review.stars ? "star-on" : "star-off"}>★</span>)}</span></div>
                        <p>{review.text}</p><small>Статус: {review.status || "На модерации"}</small>
                        {review.dispute && <p className="review-dispute-note">Оспаривание: {review.dispute}</p>}
                        {!review.dispute && review.status === "Одобрен" && <button className="secondary-button compact" onClick={() => { setShopReviewDisputeIndex(sourceIndex); setShopReviewDisputeText(""); }}>Оспорить отзыв</button>}
                      </article>;
                    })}
                    {shopReviews.filter(r => r.shop === currentUserShop?.name).length === 0 && <div className="empty-state"><MessageCircle size={24} /><h3>Пока нет отзывов</h3><p>Одобренные отзывы о магазине будут отображаться здесь.</p></div>}
                    {shopReviewDisputeIndex !== null && <div className="form-field shop-dispute-field"><label>Причина оспаривания отзыва</label><textarea rows={3} value={shopReviewDisputeText} onChange={e => setShopReviewDisputeText(e.target.value)} placeholder="Опишите, какие сведения в отзыве неверны или нарушают правила." /><button className="primary-button" onClick={async () => { if (!shopReviewDisputeText.trim()) { flash("Укажите причину оспаривания."); return; } const review = shopReviews[shopReviewDisputeIndex as number]; const ok = await submitReviewDispute(review, shopReviewDisputeText); if (ok) { setShopReviewDisputeIndex(null); setShopReviewDisputeText(""); } }}>Отправить модерации</button></div>}
                  </div>}
                </section>
                <div className="shop-sticky-create"><div><b>Добавить публикацию в магазин</b><small>Она будет видна в витрине магазина, а не в личных объявлениях.</small></div><button className="primary-button" onClick={() => { setNewTitle(""); setNewPrice(""); setNewDescription(""); setNewPhotos([]); setListingGroup("магазина"); setShowCreate(true); }}><Plus size={16} /> Создать объявление</button></div>
                <section className="shop-owner-listings">
                  <div className="section-heading"><div><span className="section-overline">КАТАЛОГ</span><h2>Объявления магазина</h2></div><span className="result-count">{ads.filter(a => isAdForShop(a, currentUserShop || {})).length} публикаций</span></div>
                  <div className="ad-grid">{ads.filter(a => isAdForShop(a, currentUserShop || {})).map(ad => <div key={ad.id}>
                    <div className="listing-origin-tag">🏪 Только магазин</div><AdCard ad={ad} liked={favorites.includes(ad.id)} onOpen={() => { setViewHistory(old => [ad.id, ...old.filter(id => id !== ad.id)]); setSelected(ad); }} onLike={() => toggleFavorite(ad.id)} onReport={() => setReportTarget(ad)} />
                    <div className="action-row"><button className="secondary-button compact" onClick={() => { setNewTitle(ad.title); setNewPrice(String(ad.price)); setNewCategory(ad.category); setNewSub(ad.sub); setNewDescription(ad.description); setNewPhotos(ad.photoUrls || []); setListingGroup("магазина"); flash("Чтобы изменить опубликованную запись, отредактируйте данные и опубликуйте новую версию; старая запись не удаляется автоматически."); setShowCreate(true); }}><Pencil size={14} /> Подготовить копию</button>
                    <button className="danger-button compact" onClick={async () => { if (!window.confirm("Удалить это объявление магазина окончательно?")) return; if (serverAuthenticated) { const saved = await secureAdminRequest("delete_own_shop_listing", { listingId: String(ad.id) }); if (!saved) return; } setViewHistory(old => [ad.id, ...old.filter(id => id !== ad.id)]); setAds(old => old.filter(x => x.id !== ad.id)); audit("Удалено объявление магазина", ad.title); flash(serverAuthenticated ? "Объявление и связанные данные удалены с сервера." : "Удалено только из текущего браузера. Откройте приложение через Telegram для серверного удаления."); }}><Trash2 size={14} /> Удалить</button></div>
                  </div>)}{ads.filter(a => isAdForShop(a, currentUserShop || {})).length === 0 && <div className="empty-state"><Package size={28} /><h3>Пока нет объявлений магазина</h3><p>Создайте первую публикацию кнопкой выше. Она появится только в витрине магазина.</p></div>}</div>
                </section>
              </section>
            </>}
            {tab === "Профиль продавца" && <>
              <section className={`profile-area public-profile-view profile-theme-${String(publicProfileSettings?.themeKey || "banner-purple").replace("banner-", "")} ${publicProfileSettings?.textColor === "#000000" ? "profile-text-black" : "profile-text-white"}`} style={{ color: publicProfileSettings?.textColor || "#ffffff", backgroundImage: publicProfileSettings?.backgroundUrl ? `linear-gradient(180deg,${publicProfileSettings?.textColor === "#000000" ? "rgba(255,255,255,.84),rgba(255,255,255,.90)" : "rgba(9,10,18,.58),rgba(9,10,18,.78)"}),url("${String(publicProfileSettings.backgroundUrl).replace(/"/g, "%22")}")` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
              <PageTitle overline="ПРОФИЛЬ УЧАСТНИКА" title={`@${publicProfileSettings?.username || sellerProfileUsername}`} subtitle="Профиль участника Marketplace." />
                <div className={`profile-banner profile-cover-banner ${publicProfileSettings?.coverUrl ? "has-profile-cover" : ""}`} style={{ color: publicProfileSettings?.textColor || "#ffffff", ["--profile-cover-image" as any]: publicProfileSettings?.coverUrl ? `linear-gradient(90deg,${publicProfileSettings?.textColor === "#000000" ? "rgba(255,255,255,.82),rgba(255,255,255,.48)" : "rgba(15,12,28,.82),rgba(15,12,28,.34)"}),url("${String(publicProfileSettings.coverUrl).replace(/"/g, "%22")}")` : undefined }}>
                  {publicProfileSettings?.photoUrl ? <img className="avatar avatar-blue profile-big" src={publicProfileSettings.photoUrl} alt="Фото профиля" /> : <div className="avatar avatar-blue profile-big">{String(publicProfileSettings?.firstName || sellerProfileUsername[0] || "U").slice(0, 1).toUpperCase()}</div>}
                  <div className="profile-main"><div className="profile-name">@{publicProfileSettings?.username || sellerProfileUsername}</div><p>Telegram ID: {publicProfileSettings?.telegramId || "—"}</p><p className="profile-description-text">{publicProfileSettings?.description || "Пользователь пока не добавил описание."}</p>
                    <div className="rating-line"><span className="stars-static">{[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= Math.round(reviews.filter(r => r.seller === sellerProfileUsername && r.status === "Одобрен").reduce((sum, r) => sum + r.stars, 0) / (reviews.filter(r => r.seller === sellerProfileUsername && r.status === "Одобрен").length || 1)) ? "star-on" : "star-off"}>★</span>)}</span> <b>{(reviews.filter(r => r.seller === sellerProfileUsername && r.status === "Одобрен").reduce((sum, r) => sum + r.stars, 0) / (reviews.filter(r => r.seller === sellerProfileUsername && r.status === "Одобрен").length || 1)).toFixed(1)}</b> <span>({reviews.filter(r => r.seller === sellerProfileUsername && r.status === "Одобрен").length} оценок)</span></div>
                  </div>
                  <div className="action-row profile-public-actions"><button className="primary-button" onClick={() => toggleProfileSubscription(sellerProfileUsername)}><Bell size={16} />{subscriptions.includes(sellerProfileUsername) ? "Вы подписаны" : "Подписаться"}</button><button className="secondary-button" onClick={() => { setAccountReportObjectType("profile"); setAccountReportObjectId(String(publicProfileSettings?.telegramId || sellerProfileUsername)); setAccountReportTitle(`Профиль @${publicProfileSettings?.username || sellerProfileUsername}`); setAccountReportText(""); setShowAccountReport(true); }}><Flag size={16} /> Пожаловаться</button><button className="secondary-button" onClick={() => { if (!openTelegramContact(publicProfileSettings?.username || sellerProfileUsername, `Здравствуйте! Пишу вам через Marketplace. Хотел(а) уточнить информацию о ваших объявлениях и условиях сделки.`)) flash("Не удалось открыть личный чат Telegram."); }}><Send size={16} /> Связаться</button></div>
                </div>
              <div className="stats-grid profile-stats-grid"><Stat icon={<Eye />} label="Просмотры профиля" value={String(profileViewCount)} /><Stat icon={<Package />} label="Частные объявления" value={String(ads.filter(a => a.listingGroup !== "магазина" && (a.seller === sellerProfileUsername || a.seller === publicProfileSettings?.username || (publicProfileSettings?.telegramId && a.sellerTelegramId === Number(publicProfileSettings.telegramId)))).length)} /><Stat icon={<CheckCircle2 />} label="Оценка продавца" value={`${(reviews.filter(r => r.seller === sellerProfileUsername && r.status === "Одобрен").reduce((n, r) => n + r.stars, 0) / (reviews.filter(r => r.seller === sellerProfileUsername && r.status === "Одобрен").length || 1)).toFixed(1)}/5`} /></div>
              <div className="section-heading"><div><span className="section-overline">ОТЗЫВЫ ПОКУПАТЕЛЕЙ</span><h2>Оценить продавца</h2></div></div>
              <div className="rating-form"><p>Как прошла ваша сделка?</p><div className="stars" role="group" aria-label="Оценка продавца">{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} aria-label={`${n} из 5 звёзд`} onClick={() => setReviewStars(n)} style={{ color: n <= reviewStars ? "#ffd34e" : "#687080", fontSize: 30, background: "transparent", border: 0, cursor: "pointer" }}>★</button>)}<span>{reviewStars} из 5</span></div><textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Расскажи о своём опыте" /><button className="primary-button" onClick={async () => { if (!reviewText.trim()) { flash("Напишите отзыв о взаимодействии."); return; } const ok = await submitPlatformReview("profile", { username: publicProfileSettings?.username || sellerProfileUsername, name: "@" + (publicProfileSettings?.username || sellerProfileUsername) }, reviewStars, reviewText.trim()); if (ok) setReviewText(""); }}>Отправить оценку</button></div>
              <div className="section-heading"><div><span className="section-overline">В ПРОДАЖЕ</span><h2>Частные объявления</h2></div></div>
              <div className="ad-grid">{ads.filter(a => a.listingGroup !== "магазина" && (a.seller === sellerProfileUsername || a.seller === publicProfileSettings?.username || (publicProfileSettings?.telegramId && a.sellerTelegramId === Number(publicProfileSettings.telegramId)))).map(ad => <AdCard key={ad.id} ad={ad} liked={favorites.includes(ad.id)} onOpen={() => { setViewHistory(old => [ad.id, ...old.filter(id => id !== ad.id)]); setSelected(ad); }} onLike={() => toggleFavorite(ad.id)} onReport={() => setReportTarget(ad)} />)}</div>
              </section>
            </>}

            {tab !== "Главная" && !["Личный кабинет","Уведомления","Избранное","Магазины","Витрина магазина","FAQ","Админ-панель","Профиль продавца","Мои подписки","ЛК магазин"].includes(tab) && <div className="empty-state"><h3>{tab}</h3><button className="secondary-button" onClick={()=>setTab("Главная")}>На главную</button></div>}
          </div>
        )}
        <footer className="footer"><span>© 2026 MARKETPLACE</span><span>Создано для сообщества <b>✳</b></span><button onClick={()=>setTab("FAQ")}>Помощь</button></footer>
      </section>

      {banInfo && <div className="modal-backdrop ban-backdrop"><div className="modal ban-screen" role="dialog" aria-modal="true" aria-labelledby="ban-title"><div className="report-flag"><Ban size={22}/></div><h1 id="ban-title">Вы забанены</h1><p>{banInfo.reason||"Нарушение правил площадки"}</p><p className="ban-time">{banInfo.permanent?"Навсегда":`Окончание: ${new Date(banInfo.expires_at).toLocaleString("ru-RU")}`}</p><a className="primary-button" href={`https://t.me/nukm0?text=${encodeURIComponent(`Прошу пересмотреть блокировку. Telegram ID: ${telegramUser?.id||"не указан"}. Причина блокировки: ${banInfo.reason||"не указана"}.`)}`} target="_blank" rel="noreferrer">Подать апелляцию владельцу</a></div></div>}
      <nav className="mobile-nav">{[{label:"Главная",icon:Search},{label:"Магазины",icon:Store},{label:"Мои подписки",icon:Users},{label:"Избранное",icon:Heart},{label:"Личный кабинет",icon:UserRound},{label:"FAQ",icon:CircleHelp}].map(it=><button key={it.label} className={tab===it.label?"mobile-active":""} onClick={()=>{setTab(it.label);setSelected(null)}}><it.icon size={19}/><span>{it.label==="Личный кабинет"?"Профиль":it.label}</span></button>)}</nav>

      {selected && lightboxIndex !== null && <div className="lightbox" onClick={()=>setLightboxIndex(null)} onTouchStart={e=>{(window as any).__touchX=e.touches[0].clientX}} onTouchEnd={e=>{const dx=e.changedTouches[0].clientX-((window as any).__touchX||0);if(Math.abs(dx)>55){const count=selected.photoUrls?.length||selected.photos||1;setLightboxIndex(i=>Math.max(0,Math.min(count-1,(i??0)+(dx<0?1:-1))))}}}><button className="lightbox-close" onClick={()=>setLightboxIndex(null)} aria-label="Закрыть">×</button>{selected.photoUrls?.[lightboxIndex] ? <img src={selected.photoUrls[lightboxIndex]} alt={`Фото ${lightboxIndex+1}`}/> : <div className={`lightbox-placeholder ${selected.tone}`}>{selected.emoji}</div>}<div className="lightbox-count">{lightboxIndex+1}/{selected.photoUrls?.length||selected.photos||1}</div><button className="lightbox-prev" onClick={e=>{e.stopPropagation();setLightboxIndex(i=>Math.max(0,(i??0)-1))}}>‹</button><button className="lightbox-next" onClick={e=>{e.stopPropagation();setLightboxIndex(i=>Math.min((selected.photoUrls?.length||selected.photos||1)-1,(i??0)+1))}}>›</button></div>}

      {showShopSettings && <div className="modal-backdrop settings-overlay" onClick={() => setShowShopSettings(false)}><div className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="shop-settings-title" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><span className="section-overline">ОФОРМЛЕНИЕ ВИТРИНЫ</span><h2 id="shop-settings-title">Редактировать магазин</h2><p className="settings-modal-subtitle">{currentUserShop?.name || "Магазин"}</p></div><button className="icon-button" onClick={() => setShowShopSettings(false)} aria-label="Закрыть"><X size={18} /></button></div>
        <div className="form-field"><label>Описание магазина</label><textarea rows={3} maxLength={2000} value={shopThemeDraft.description} onChange={e => setShopThemeDraft(v => ({ ...v, description: e.target.value }))} placeholder="Опишите ассортимент, услуги и условия работы." /></div>
        <div className="form-field"><label>Фото главной плашки / обложка</label><input type="url" value={shopThemeDraft.coverUrl} onChange={e => setShopThemeDraft(v => ({ ...v, coverUrl: e.target.value }))} placeholder="https://..." /><label className="upload-box settings-upload"><Plus size={18}/><b>Загрузить обложку</b><small>PNG, JPEG, WEBP или GIF · до 5 МБ</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void uploadImageInto(file, "shop-cover", url => setShopThemeDraft(v => ({ ...v, coverUrl: url }))); }} /></label>{shopThemeDraft.coverUrl && <div className="settings-image-preview"><img src={shopThemeDraft.coverUrl} alt="Предпросмотр обложки"/><button type="button" className="secondary-button compact" onClick={() => setShopThemeDraft(v => ({ ...v, coverUrl: "" }))}>Убрать фото</button></div>}</div>
        <div className="form-field"><label>Фон страницы магазина (за объявлениями)</label><input type="url" value={shopThemeDraft.backgroundUrl} onChange={e => setShopThemeDraft(v => ({ ...v, backgroundUrl: e.target.value }))} placeholder="https://..." /><label className="upload-box settings-upload"><Plus size={18}/><b>Загрузить фон</b><small>Изображение будет видно на странице магазина</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void uploadImageInto(file, "shop-background", url => setShopThemeDraft(v => ({ ...v, backgroundUrl: url }))); }} /></label>{shopThemeDraft.backgroundUrl && <div className="settings-image-preview"><img src={shopThemeDraft.backgroundUrl} alt="Предпросмотр фона"/><button type="button" className="secondary-button compact" onClick={() => setShopThemeDraft(v => ({ ...v, backgroundUrl: "" }))}>Убрать фон</button></div>}</div>
        <div className="form-field"><label>Стиль объявлений</label><div className="theme-choice-grid">{[{v:"banner-purple",t:"Фиолетовый",c:"theme-swatch-purple"},{v:"banner-blue",t:"Синий",c:"theme-swatch-blue"},{v:"banner-pink",t:"Розовый",c:"theme-swatch-pink"},{v:"banner-black",t:"Чёрно-белый",c:"theme-swatch-black"}].map(opt => <button type="button" key={opt.v} className={`theme-choice ${opt.c} ${shopThemeDraft.themeKey === opt.v ? "selected" : ""}`} onClick={() => setShopThemeDraft(v => ({ ...v, themeKey: opt.v, ...(opt.v === "banner-black" ? {logoTextColor:"#ffffff"} : {}) }))}><span/>{opt.t}</button>)}</div></div>
        <div className="form-field"><label>Цвет текста страницы</label><div className="filter-choice-row"><button type="button" className={`filter-choice ${shopThemeDraft.logoTextColor === "#ffffff" ? "selected" : ""}`} onClick={() => setShopThemeDraft(v => ({ ...v, logoTextColor: "#ffffff" }))}>Белый текст</button><button type="button" className={`filter-choice ${shopThemeDraft.logoTextColor === "#000000" ? "selected" : ""}`} onClick={() => setShopThemeDraft(v => ({ ...v, logoTextColor: "#000000" }))}>Чёрный текст</button></div></div>
        <p className="form-hint">Логотип и название магазина меняет администрация в админ-панели. Эти настройки сохраняются для публичной витрины.</p>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setShowShopSettings(false)}>Отмена</button><button className="primary-button" onClick={saveShopSettings}><CheckCircle2 size={16}/> Сохранить настройки</button></div>
      </div></div>}

      {showProfileSettings && <div className="modal-backdrop settings-overlay" onClick={() => setShowProfileSettings(false)}><div className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="profile-settings-title" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><span className="section-overline">ЛИЧНЫЕ НАСТРОЙКИ</span><h2 id="profile-settings-title">Настройки профиля</h2><p className="settings-modal-subtitle">Публичные элементы увидят другие пользователи. Личный фон платформы виден только в вашем браузере.</p></div><button className="icon-button" onClick={() => setShowProfileSettings(false)} aria-label="Закрыть"><X size={18}/></button></div>
        <div className="form-field"><label>Описание профиля</label><textarea rows={3} maxLength={1000} value={profileDescriptionDraft} onChange={e => setProfileDescriptionDraft(e.target.value)} placeholder="Расскажите о себе, интересах или условиях сделки." /></div>
        <div className="form-field"><label>Личный фон платформы (только для вас)</label><input type="url" value={localPlatformBackgroundDraft} onChange={e => setLocalPlatformBackgroundDraft(e.target.value)} placeholder="https://... или загрузите изображение" /><label className="upload-box settings-upload"><Plus size={18}/><b>Загрузить личный фон</b><small>Отображается только на этом устройстве</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void uploadImageInto(file, "personal-background", url => setLocalPlatformBackgroundDraft(url)); }} /></label></div>
        <div className="form-field"><label>Обложка личного кабинета (публичная)</label><input type="url" value={profileSettingsDraft.coverUrl} onChange={e => setProfileSettingsDraft(v => ({ ...v, coverUrl: e.target.value }))} placeholder="https://..." /><label className="upload-box settings-upload"><Plus size={18}/><b>Загрузить обложку профиля</b><small>Её увидят посетители вашего профиля</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void uploadImageInto(file, "profile-cover", url => setProfileSettingsDraft(v => ({ ...v, coverUrl: url }))); }} /></label>{profileSettingsDraft.coverUrl && <div className="settings-image-preview"><img src={profileSettingsDraft.coverUrl} alt="Обложка профиля"/><button type="button" className="secondary-button compact" onClick={() => setProfileSettingsDraft(v => ({ ...v, coverUrl: "" }))}>Убрать фото</button></div>}</div>
        <div className="form-field"><label>Фоновое изображение публичного профиля</label><input type="url" value={profileSettingsDraft.backgroundUrl} onChange={e => setProfileSettingsDraft(v => ({ ...v, backgroundUrl: e.target.value }))} placeholder="https://..." /><label className="upload-box settings-upload"><Plus size={18}/><b>Загрузить фон профиля</b><small>Видно посетителям личного профиля</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void uploadImageInto(file, "profile-background", url => setProfileSettingsDraft(v => ({ ...v, backgroundUrl: url }))); }} /></label>{profileSettingsDraft.backgroundUrl && <div className="settings-image-preview"><img src={profileSettingsDraft.backgroundUrl} alt="Фон профиля"/><button type="button" className="secondary-button compact" onClick={() => setProfileSettingsDraft(v => ({ ...v, backgroundUrl: "" }))}>Убрать фон</button></div>}</div>
        <div className="form-field"><label>Цвет текста публичного профиля</label><div className="filter-choice-row"><button type="button" className={`filter-choice ${profileSettingsDraft.textColor === "#ffffff" ? "selected" : ""}`} onClick={() => setProfileSettingsDraft(v => ({ ...v, textColor: "#ffffff" }))}>Белый</button><button type="button" className={`filter-choice ${profileSettingsDraft.textColor === "#000000" ? "selected" : ""}`} onClick={() => setProfileSettingsDraft(v => ({ ...v, textColor: "#000000" }))}>Чёрный</button></div></div>
        <div className="form-field"><label>Цвет темы объявлений и блоков профиля</label><div className="theme-choice-grid">{[{v:"banner-purple",t:"Фиолетовый",c:"theme-swatch-purple"},{v:"banner-blue",t:"Синий",c:"theme-swatch-blue"},{v:"banner-pink",t:"Розовый",c:"theme-swatch-pink"},{v:"banner-black",t:"Чёрно-белый",c:"theme-swatch-black"},...(isOwnerAccount?[{v:"banner-gray",t:"Серый · владелец",c:"theme-swatch-gray"}]:[])].map(opt => <button type="button" key={opt.v} className={`theme-choice ${opt.c} ${profileSettingsDraft.themeKey === opt.v ? "selected" : ""}`} onClick={() => setProfileSettingsDraft(v => ({ ...v, themeKey: opt.v, ...(opt.v === "banner-black" ? {textColor:"#ffffff"} : {}) }))}><span/>{opt.t}</button>)}</div></div>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setShowProfileSettings(false)}>Отмена</button><button className="primary-button" onClick={saveProfileSettings}><CheckCircle2 size={16}/> Сохранить настройки</button></div>
      </div></div>}

      {reportTarget && <div className="modal-backdrop settings-overlay" onClick={() => setReportTarget(null)}><div className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="listing-report-title" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><span className="section-overline">БЕЗОПАСНОСТЬ</span><h2 id="listing-report-title">Пожаловаться на объявление</h2><p className="settings-modal-subtitle">{reportTarget.title}</p></div><button className="icon-button" onClick={() => setReportTarget(null)} aria-label="Закрыть"><X size={18}/></button></div>
        <div className="form-field"><label>Причина жалобы</label><select value={reportReason} onChange={e => setReportReason(e.target.value)}>{["Подозрение на мошенничество", "Недостоверное описание или подмена товара", "Запрещённый товар или услуга", "Спам или дубликат объявления", "Чужие фотографии или нарушение авторских прав", "Неверная цена или вводящие в заблуждение условия", "Оскорбления или дискриминация", "Нарушение правил площадки", "Другая причина"].map(reason => <option key={reason}>{reason}</option>)}</select></div>
        <div className="form-field"><label>Подробности *</label><textarea rows={4} value={reportText} onChange={e => setReportText(e.target.value)} placeholder="Опишите, что именно не так. Укажите факты, даты и детали объявления." /></div>
        <div className="form-field"><label>Подтверждающие фото (необязательно, до 3)</label><label className="upload-box settings-upload"><Plus size={18}/><b>Добавить скриншот или фото</b><small>{reportPhotos.length}/3 файлов · до 5 МБ на файл</small><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={e => { const files = (Array.from(e.currentTarget.files || []) as File[]).slice(0, Math.max(0, 3 - reportPhotos.length)); e.currentTarget.value = ""; files.forEach(file => { if (file.size > 5 * 1024 * 1024) { flash("Файл больше 5 МБ — пропущен."); return; } const reader = new FileReader(); reader.onload = () => setReportPhotos(old => old.length < 3 ? [...old, String(reader.result || "")] : old); reader.readAsDataURL(file); }); }} /></label>{reportPhotos.length > 0 && <div className="picked-photos">{reportPhotos.map((url, i) => <div key={i}><img src={url} alt={`Материал жалобы ${i + 1}`} /><button type="button" onClick={() => setReportPhotos(old => old.filter((_, j) => j !== i))}>×</button></div>)}</div>}</div>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setReportTarget(null)}>Отмена</button><button className="primary-button" onClick={sendReport}><Flag size={16}/> Отправить жалобу</button></div><p className="form-hint">Не добавляйте пароли, коды входа или полные данные банковских карт.</p>
      </div></div>}

      {showCreate && <div className="modal-backdrop" onClick={()=>setShowCreate(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="section-overline">НОВАЯ ПУБЛИКАЦИЯ</span><h2>Создать объявление</h2></div><button className="icon-button" onClick={()=>setShowCreate(false)}><X size={18}/></button></div><div className="form-field"><label>Название объявления *</label><input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Например, наушники в отличном состоянии"/></div><div className="form-field"><label>Тип объявления *</label><div className="filter-choice-row">{(["Продажа","Покупка"] as const).map(t=><button type="button" key={t} className={`filter-choice ${newListingType===t?"selected":""}`} onClick={()=>setNewListingType(t)}>{t}</button>)}</div><small className="form-hint">Продажа — вы предлагаете товар. Покупка — вы ищете товар, например подик.</small></div><div className="form-two"><div className="form-field"><label>Категория *</label><select value={newCategory} onChange={e=>{setNewCategory(e.target.value);setNewSub(subcategories[e.target.value]?.[0]||"Б/у")}}>{categories.filter(c=>c!=="Все").map(c=><option key={c}>{c}</option>)}</select></div><div className="form-field"><label>Подкатегория *</label><select value={newSub} onChange={e=>setNewSub(e.target.value)}>{(subcategories[newCategory]||["Б/у"]).map(s=><option key={s}>{s}</option>)}</select></div></div><div className="form-field"><label>Куда разместить объявление?</label><div className="filter-choice-row">{[{v:"частное",t:"Частное объявление"},{v:"магазина",t:"В магазине"},{v:"оба",t:"В магазин и в ленту"}].map(opt=><button type="button" key={opt.v} className={`filter-choice ${listingGroup===opt.v?"selected":""}`} onClick={()=>setListingGroup(opt.v as "частное"|"магазина"|"оба")} disabled={opt.v!=="частное"&&!hasShopAccess}>{opt.t}</button>)}</div><small className="form-hint">На главной странице по умолчанию — частное объявление. Из витрины магазина — объявление магазина. Для размещения в магазине аккаунту должна быть назначена роль владельца магазина.</small></div><div className="form-field"><label>Описание <span>(необязательно)</span></label><textarea value={newDescription} onChange={e=>setNewDescription(e.target.value)} placeholder="Расскажи подробнее о товаре..." rows={3}/></div><div className="form-field"><label>Цена, ₽</label><input type="number" min="0" value={newPrice} onChange={e=>setNewPrice(e.target.value)} placeholder="0 — договорная"/></div><div className="form-field"><label>Фотографии * <span>({newPhotos.length}/3)</span></label><label className="upload-box" htmlFor="ad-photo-upload"><Plus size={22}/><b>Выбрать из галереи / файлов</b><small>Можно выбрать до 3 фото с телефона или компьютера</small></label><input id="ad-photo-upload" type="file" accept="image/*" multiple hidden onChange={e=>{const files=(Array.from(e.target.files||[]) as File[]).slice(0,3-newPhotos.length);files.forEach(file=>{const reader=new FileReader();reader.onload=()=>setNewPhotos(old=>old.length<3?[...old,String(reader.result)]:old);reader.readAsDataURL(file)});e.currentTarget.value=""}}/>{newPhotos.length>0&&<div className="picked-photos">{newPhotos.map((src,i)=><div key={i}><img src={src} alt={`Фото ${i+1}`}/><button type="button" onClick={()=>setNewPhotos(old=>old.filter((_,j)=>j!==i))}>×</button></div>)}</div>}</div><div className="modal-actions"><button className="secondary-button" onClick={()=>setShowCreate(false)}>Отмена</button><button className="primary-button" onClick={createAd}><Plus size={16}/> Опубликовать</button></div><p className="form-hint">Фото выбираются с устройства и пока сохраняются в этом браузере.</p></div></div>}

      {showAccountReport && <div className="modal-backdrop" onClick={()=>setShowAccountReport(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="section-overline">БЕЗОПАСНОСТЬ</span><h2>Пожаловаться: {accountReportTitle||`@${sellerProfileUsername}`}</h2></div><button className="icon-button" onClick={()=>setShowAccountReport(false)}><X size={18}/></button></div><div className="form-field"><label>Причина жалобы</label><select value={accountReportReason} onChange={e=>setAccountReportReason(e.target.value)}>{["Подозрение на мошенничество","Выдаёт себя за другого человека","Оскорбления или угрозы","Спам и навязчивая реклама","Фальшивый или накрученный аккаунт","Обход блокировки","Публикация чужих личных данных","Нарушение правил платформы","Другая причина"].map(x=><option key={x}>{x}</option>)}</select></div><div className="form-field"><label>Подробности</label><textarea rows={4} value={accountReportText} onChange={e=>setAccountReportText(e.target.value)} placeholder="Опишите, что произошло: факты, дату и связанные объявления"/></div><div className="modal-actions"><button className="secondary-button" onClick={()=>setShowAccountReport(false)}>Отмена</button><button className="primary-button" onClick={sendAccountReport}><Flag size={16}/> Отправить жалобу</button></div></div></div>}
      {notice && <div className="toast"><CheckCircle2 size={17}/>{notice}</div>}
    </main>
  );
}

function PageTitle({overline,title,subtitle}:{overline:string,title:string,subtitle:string}) {
  return <div className="page-title"><span className="section-overline">{overline}</span><h1>{title}</h1><p>{subtitle}</p></div>;
}
function Stat({icon,label,value}:{icon:React.ReactNode,label:string,value:string}) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>;
}
function AdCard({ad,liked,onOpen,onLike,onReport}:{ad:Ad,liked:boolean,onOpen:()=>void,onLike:()=>void,onReport:()=>void}) {
  return <article className="ad-card"><button className={`ad-art ${ad.tone} ${ad.photoUrls?.[0] ? "has-ad-photo" : ""}`} onClick={onOpen} aria-label={`Открыть ${ad.title}`}>{ad.photoUrls?.[0] ? <img className="ad-card-photo" src={ad.photoUrls[0]} alt={ad.title}/> : <span className="ad-placeholder-emoji">{ad.emoji}</span>}<span className="art-tag">{ad.category}</span><span className="art-view"><Eye size={13}/>{ad.views}</span></button><div className="ad-card-body"><div className="ad-card-top"><span className="ad-sub">{ad.sub}</span><button className={`heart-button ${liked?"liked":""}`} onClick={onLike} aria-label="В избранное"><Heart size={17} fill={liked?"currentColor":"none"}/></button></div><button className="ad-title" onClick={onOpen}>{ad.title}</button><div className="ad-price">{ad.price===0?"Договорная":money(ad.price)}</div><div className="ad-card-bottom"><button className="seller-link" onClick={onOpen}><span className="seller-dot">{ad.seller[0].toUpperCase()}</span>@{ad.seller}</button><button className="report-mini" onClick={onReport} aria-label="Пожаловаться"><Flag size={14}/></button></div><button className="contact-button" disabled={ad.seller==="you"} onClick={()=>{if(ad.seller==="you")return;const message=`Здравствуйте! Пишу по объявлению «${ad.title}» на Marketplace. Цена: ${money(ad.price)}. ${ad.description?`Описание: ${ad.description.slice(0,500)}. `:""}Подскажите, пожалуйста, объявление ещё актуально?`;if(!openTelegramContact(ad.seller, message))return;}}><MessageCircle size={15}/> {ad.seller==="you"?"Ваше объявление":"Написать продавцу"}</button></div></article>;
}

