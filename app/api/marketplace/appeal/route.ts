import {NextRequest,NextResponse} from "next/server";
import {getVerifiedSession,supabaseRequest} from "../../../../lib/telegram-auth";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){try{
 const b=await request.json(),s=await getVerifiedSession(String(b.initData||""),{allowBanned:true});
 let source:any=null;if(b.reportId){const reports=await supabaseRequest(`marketplace_reports?id=eq.${encodeURIComponent(String(b.reportId))}&object_owner_telegram_id=eq.${s.user.id}&status=eq.resolved&select=*&limit=1`) as any[];source=reports[0];if(!source||!["warning","hide_listing","temporary_ban","permanent_ban"].includes(source.owner_decision))return NextResponse.json({error:"Ограничение не найдено."},{status:404});}
 if(!s.ban&&!source)return NextResponse.json({error:"Активное ограничение не найдено."},{status:400});
 const description=String(b.description||"").trim(),materials=Array.isArray(b.materials)?b.materials:[];
 if(!description)return NextResponse.json({error:"Напишите описание апелляции."},{status:400});
 if(!materials.length||materials.length>3||materials.some((url:unknown)=>typeof url!=="string"||!/^https:\/\//.test(url)))return NextResponse.json({error:"Приложите от 1 до 3 фото доказательств."},{status:400});
 const sourceId=String(source?.id||s.ban?.id);
 const previous=await supabaseRequest(`marketplace_reports?object_type=eq.appeal&object_id=eq.${sourceId}&status=neq.resolved&select=id&limit=1`) as any[];
 if(previous.length)return NextResponse.json({error:"Апелляция уже находится на рассмотрении."},{status:409});
 await supabaseRequest("marketplace_reports",{method:"POST",body:JSON.stringify({reporter_telegram_id:s.user.id,object_type:"appeal",object_id:sourceId,object_title:"Ограничение аккаунта",object_owner_telegram_id:s.user.id,reason:"Апелляция на ограничение",details:`Ограничение: ${source?.owner_comment||s.ban?.reason||"Ограничение по жалобе"}\n\nАпелляция: ${description}`,materials,status:"new"})});
 return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:"Не удалось отправить апелляцию."},{status:400});}}
