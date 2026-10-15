import { ImageResponse } from "next/og";
import { createElement as h } from "react";
import { supabaseRequest, supabaseConfig } from "../../../../lib/supabase";
export const runtime = "edge";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ad = params.get("ad");
  let title = ({menu:"Твой маркетплейс",shops:"Магазины сообщества",stats:"Твоя статистика",ref:"Приглашай друзей",support:"Помощь и поддержка"} as Record<string,string>)[params.get("kind")||"menu"] || "Marketplace";
  let subtitle = "Покупай · продавай · находи своё";
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
  return new ImageResponse(h("div",{style:{width:"100%",height:"100%",display:"flex",background:"linear-gradient(125deg,#090a10,#21172f)",color:"white",padding:60,fontFamily:"sans-serif"}},
    h("div",{style:{display:"flex",flexDirection:"column",justifyContent:"space-between",width:photo?"58%":"100%"}},
      h("div",{style:{display:"flex",fontSize:24,color:"#d0b4ff",letterSpacing:4}},"MARKETPLACE · ПТЗ"),
      h("div",{style:{display:"flex",fontSize:58,fontWeight:800,lineHeight:1.1}},title),
      h("div",{style:{display:"flex",fontSize:32,color:"#eee0ff"}},subtitle),
      h("div",{style:{display:"flex",fontSize:20,color:"#b6a9c7"}},"Открой в Telegram →")),
    photo?h("img",{src:photo,width:370,height:480,style:{objectFit:"cover",marginLeft:32,borderRadius:30}}):h("div",{style:{position:"absolute",right:60,top:30,fontSize:200,color:"rgba(180,130,255,.12)",display:"flex"}},"M")
  ),{width:1200,height:630,headers:{"Cache-Control":"public, max-age=60"}});
}
