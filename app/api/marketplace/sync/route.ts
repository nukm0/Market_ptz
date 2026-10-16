import {NextRequest,NextResponse} from "next/server";
import {POST as loadSession} from "../../telegram/session/route";
import {GET as loadListings} from "../listings/route";
import {GET as loadConfig} from "../config/route";
import {GET as loadNotifications} from "../notifications/route";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const initData=request.headers.get("x-telegram-init-data")||"";
 const sessionRequest=new NextRequest(request.url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData})});
 const responses=await Promise.all([loadSession(sessionRequest),loadListings(request),loadConfig(request),loadNotifications(request)]);
 const [session,listings,config,notifications]=await Promise.all(responses.map(r=>r.json()));
 if(!responses[0].ok)return NextResponse.json({error:session.error||"Не удалось загрузить профиль."},{status:responses[0].status});
 return NextResponse.json({session,listings:responses[1].ok?listings.listings:null,config:config.persistenceConfigured===false?null:config,notifications:responses[3].ok?notifications.notifications:null},{headers:{"Cache-Control":"no-store"}});
}
