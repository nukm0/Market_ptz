import {NextRequest,NextResponse} from "next/server";
import {getVerifiedSession,supabaseRequest} from "../../../../../lib/telegram-auth";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:NextRequest){try{
 const body=await request.json(),session=await getVerifiedSession(String(body.initData||""));
 const reason=String(body.reason||"").trim(),review=String(body.reviewId||"");
 if(!reason)return NextResponse.json({error:"Напишите описание оспаривания."},{status:400});
 const materials=Array.isArray(body.materials)?body.materials:[];
 if(reason.length>2000||materials.length>3||materials.some((url:unknown)=>typeof url!=="string"||!/^https:\/\//.test(url)))return NextResponse.json({error:"Описание до 2000 символов, не более 3 фото."},{status:400});
 const result=await supabaseRequest("rpc/marketplace_dispute_review",{method:"POST",body:JSON.stringify({p_user:session.user.id,p_review:review,p_reason:reason,p_materials:materials})});
 await supabaseRequest("marketplace_notifications",{method:"POST",body:JSON.stringify({telegram_id:998579758,title:"Оспаривание отзыва",message:reason,read:false})}).catch(()=>null);
 return NextResponse.json({ok:true,result});
 }catch(error){const msg=error instanceof Error?error.message:"";const known=["уже был оспорен","недоступен для оспаривания","только его получатель"].find(x=>msg.includes(x));return NextResponse.json({error:known?"Отзыв "+known+".":"Не удалось отправить оспаривание. Проверьте данные и попробуйте снова."},{status:409});}}
