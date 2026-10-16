import { ImageResponse } from "next/og";
import { createElement as h } from "react";
import { supabaseRequest, supabaseConfig } from "../../../../lib/supabase";
import {helpGuides,cooperationGuides} from "../../../../lib/bot-guides";
export const runtime = "edge";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const [regular,bold]=await Promise.all([
    fetch(new URL("/fonts/PT_Sans-Web-Regular.ttf",request.url)).then(r=>r.arrayBuffer()),
    fetch(new URL("/fonts/PT_Sans-Web-Bold.ttf",request.url)).then(r=>r.arrayBuffer()),
  ]);
  const params = new URL(request.url).searchParams;
  const ad = params.get("ad");
  let title = ({menu:"Твой маркетплейс",shops:"Магазины сообщества",stats:"Твоя статистика",ref:"Приглашай друзей",support:"Помощь и поддержка"} as Record<string,string>)[params.get("kind")||"menu"] || "Marketplace";
  let subtitle = "Покупай · продавай · находи своё";
  const kind=params.get("kind")||"menu";
  const guide=kind.startsWith("help_")?helpGuides[kind.slice(5)]:kind.startsWith("coop_")?cooperationGuides[kind.slice(5)]:undefined;
  let accent=guide?.accent||"#bc96ff";
  let tag=guide?.tag||"MARKETPLACE · ПТЗ";
  if(guide){title=guide.title;subtitle=guide.summary;}
  if(kind==="help"){title="Помощь Marketplace";subtitle="Пошаговые инструкции · ответы на вопросы";tag="ТВОЙ ПУТЕВОДИТЕЛЬ";}
  if(kind==="cooperation"){title="Давай развивать площадку";subtitle="Магазин · реклама · верификация · команда";tag="СОТРУДНИЧЕСТВО";accent="#f277b7";}
  let photo = "";
  if (ad) {
    if (!/^\d{1,20}$/.test(ad)) return new Response("Not found",{status:404});
    const rows = await supabaseRequest(`marketplace_listings?listing_id=eq.${encodeURIComponent(ad)}&hidden=eq.false&select=title,price,photo_urls,shop_id&limit=1`) as any[];
    if(!rows?.[0])return new Response("Not found",{status:404});
    const row=rows[0];
    if(row.shop_id){const shops=await supabaseRequest(`marketplace_shops?id=eq.${row.shop_id}&hidden=eq.false&select=id&limit=1`) as any[];if(!shops?.length)return new Response("Not found",{status:404});}
    const hidden=await supabaseRequest(`marketplace_listing_moderation?object_type=eq.listing&object_id=eq.${ad}&public_hidden=eq.true&select=object_id&limit=1`) as any[];
    if(hidden?.length)return new Response("Not found",{status:404});
    title=String(row.title).slice(0,90);subtitle=Number(row.price)?`${Number(row.price).toLocaleString("ru-RU")} руб.`:"Договорная цена";
    const candidate=row.photo_urls?.[0];
    try{if(candidate&&new URL(candidate).origin===new URL(supabaseConfig().url).origin)photo=candidate;}catch{}
  }
  return new ImageResponse(h("div",{style:{width:"100%",height:"100%",display:"flex",background:"linear-gradient(125deg,#090a10,#21172f)",color:"white",padding:60,fontFamily:"PT Sans"}},
    h("div",{style:{display:"flex",flexDirection:"column",justifyContent:"space-between",width:photo||guide||kind==="help"||kind==="cooperation"?"64%":"100%"}},
      h("div",{style:{display:"flex",fontSize:24,color:accent,letterSpacing:3}},tag),
      h("div",{style:{display:"flex",fontSize:guide?52:58,fontWeight:700,lineHeight:1.12}},title),
      h("div",{style:{display:"flex",fontSize:32,color:"#eee0ff"}},subtitle),
      h("div",{style:{display:"flex",fontSize:20,color:"#b6a9c7"}},"Открой в Telegram →")),
    photo?h("img",{src:photo,width:370,height:480,style:{objectFit:"cover",marginLeft:32,borderRadius:30}}):(guide||kind==="help"||kind==="cooperation")?h("div",{style:{width:330,height:420,marginLeft:25,borderRadius:32,border:`2px solid ${accent}55`,background:`linear-gradient(145deg,${accent}22,#11111b)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:36}},guideIcon(kind,accent),h("div",{style:{display:"flex",width:210,height:12,borderRadius:8,background:`${accent}66`}}),h("div",{style:{display:"flex",width:150,height:10,borderRadius:8,background:`${accent}33`}})):h("div",{style:{position:"absolute",right:60,top:30,fontSize:200,color:"rgba(180,130,255,.12)",display:"flex"}},"M")
  ),{width:1200,height:630,fonts:[{name:"PT Sans",data:regular,weight:400,style:"normal"},{name:"PT Sans",data:bold,weight:700,style:"normal"}],headers:{"Cache-Control":"public, max-age=60"}});
}

function guideIcon(kind:string,accent:string){
 const paths:Record<string,string[]>={
 shop:["M24 68h132v92H24z","M18 68l16-38h112l16 38","M18 68q18 24 36 0q18 24 36 0q18 24 36 0q18 24 36 0","M66 160v-52h48v52"],
 banner:["M18 34h144v108H18z","M34 119l34-35 28 24 20-18 30 29","M58 154h64","M90 142v12"],
 verified:["M90 18l61 26v43c0 38-28 62-61 79-33-17-61-41-61-79V44z","M61 89l20 20 40-43"],
 team:["M60 39a22 22 0 1 0 0 44a22 22 0 1 0 0-44","M120 47a18 18 0 1 0 0 36a18 18 0 1 0 0-36","M18 153v-23c0-24 18-36 42-36s42 12 42 36v23","M119 97c25 0 43 12 43 35v21"],
 publish:["M38 22h78l26 26v112H38z","M111 22v32h31","M90 83v49","M66 108h48"],
 search:["M78 24a51 51 0 1 0 0 102a51 51 0 1 0 0-102","M116 115l44 44"],
 profile:["M90 24a29 29 0 1 0 0 58a29 29 0 1 0 0-58","M28 157v-16c0-27 25-44 62-44s62 17 62 44v16"],
 notifications:["M46 124V77c0-27 18-42 44-42s44 15 44 42v47l14 16H32z","M76 153q14 24 28 0","M90 18v17"],
 reviews:["M90 19l21 45 50 6-37 34 10 51-44-26-44 26 10-51-37-34 50-6z"],
 referrals:["M22 52h136v31H22z","M32 83h116v77H32z","M90 52v108","M90 50C25 49 49-6 90 50c41-56 65-1 0 0"],
 help:["M90 19a71 71 0 1 0 0 142a71 71 0 1 0 0-142","M67 62c0-28 49-28 49 0 0 20-26 17-26 40","M90 124v4"],
 };
 const key=kind.replace(/^(coop|help)_/,"");const selected=paths[key]||paths[key==="shops"?"shop":key==="safety"?"verified":"help"];
 return h("svg",{width:220,height:220,viewBox:"0 0 180 180",fill:"none",stroke:accent,strokeWidth:8,strokeLinecap:"round",strokeLinejoin:"round"},...selected.map((d,i)=>h("path",{key:i,d})));
}
