import {NextRequest,NextResponse} from "next/server";
import {getVerifiedSession,supabaseRequest} from "../../../../lib/telegram-auth";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){try{const b=await request.json(),s=await getVerifiedSession(String(b.initData||""));if(!["favorite","contact"].includes(b.kind)||!/^\d{1,20}$/.test(String(b.listingId)))return NextResponse.json({error:"Неверное действие."},{status:400});await supabaseRequest("rpc/marketplace_track_listing",{method:"POST",body:JSON.stringify({p_actor:s.user.id,p_listing:String(b.listingId),p_kind:b.kind})});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:"Не удалось сохранить действие."},{status:400});}}
