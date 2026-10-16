const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const base = path.resolve(__dirname,'..');
const links = { APP_URL:'https://market-ptz.vercel.app',BOT_USERNAME:'baraxolka_ptzbot',GROUP_URL:'https://t.me/marketplace_Support_info',miniAppWebUrl:(kind='page',id='home')=>`https://market-ptz.vercel.app/?${kind}=${id}`,telegramMiniAppLink:(kind='page',id='home')=>`https://t.me/baraxolka_ptzbot?startapp=${kind}_${id}`,telegramNotificationLink:value=>value };
function load(file,{role='Владелец',userId=998579758,db=async()=>[],fetch=async()=>new Response(JSON.stringify({ok:true,result:{}})),send=async()=>true,session}={}){
 const code=ts.transpileModule(fs.readFileSync(path.join(base,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const module={exports:{}};
 const auth={getVerifiedSession:async()=>session||{user:{id:userId,username:'test_moderator',first_name:'Test'},role,isOwner:userId===998579758,shop:null},supabaseRequest:db,supabaseConfig:()=>({url:"https://fixture.supabase.co",key:"fixture"}),sendTelegramMessage:send,sendTelegramPost:async()=>true};
 vm.runInNewContext(code,{exports:module.exports,module,require:name=>name==='next/server'?{NextResponse:{json:(data,init={})=>new Response(JSON.stringify(data),{status:init.status||200,headers:init.headers})}}:name.includes('telegram-links')?links:auth,URL,URLSearchParams,Response,Buffer,fetch,console,process:{env:{TELEGRAM_BOT_TOKEN:'test-fixture',TELEGRAM_WEBHOOK_SECRET:'test-secret'}}});
 return module.exports;
}
const post=(body)=>({json:async()=>body,headers:{get:()=> 'test-secret'}});
const get=(query='')=>({headers:{get:()=>null},nextUrl:{searchParams:new URLSearchParams(query)}});
test('reviewed listings persist who reviewed them and remain in the queue',async()=>{
 let mark;const api=load('app/api/admin/manage/route.ts',{role:'Модератор',userId:123456789,db:async(url,init)=>{if(url.startsWith('marketplace_listing_moderation?on_conflict')){mark=JSON.parse(init.body);return [mark]}return []}});
 const result=await api.POST(post({initData:'signed-fixture',action:'mark_listing_reviewed',payload:{listingId:'1234567890000'}}));assert.equal(result.status,200);assert.equal(mark.admin_queue_hidden,false);assert.equal(mark.reviewed_by,123456789);assert.equal(mark.reviewed_username,'test_moderator');assert.ok(mark.reviewed_at);
});
test('trainees cannot mark listings or mutate reviews',async()=>{
 const api=load('app/api/admin/manage/route.ts',{role:'Стажёр',userId:123});
 assert.equal((await api.POST(post({action:'mark_listing_reviewed',payload:{listingId:'123'}}))).status,403);
 assert.equal((await api.POST(post({action:'review_decision',payload:{id:'r',decision:'approve'}}))).status,403);
});
test('moderators can load pending reviews with author and target data',async()=>{
 const api=load('app/api/admin/manage/route.ts',{role:'Модератор',userId:123,db:async url=>url.startsWith('marketplace_reviews?')?[{id:'r1',author_telegram_id:111,target_type:'profile',target_telegram_id:222,stars:4,status:'pending',description:'review'}]:url.startsWith('marketplace_users?')?[{telegram_id:111,username:'author'},{telegram_id:222,username:'seller'}]:[]});
 const response=await api.POST(post({action:'list_reviews'}));const data=await response.json();assert.equal(response.status,200);assert.equal(data.result[0].author,'@author');assert.equal(data.result[0].seller,'@seller');assert.equal(data.result[0].status,'pending');
});
test('approved-only public reviews and fixed platform-owner rating',async()=>{
 const queries=[];const api=load('app/api/marketplace/reviews/route.ts',{db:async url=>{queries.push(url);return []}});
 const result=await api.GET(get('type=profile&target=123456789'));assert.equal(result.status,200);assert.ok(queries.some(q=>q.includes('status=eq.approved')));assert.ok(queries.every(q=>!q.includes('status=in.')));
 const owner=await (await api.GET(get('type=profile&target=998579758'))).json();assert.equal(owner.rating,5);assert.equal(owner.canReview,false);
 const blocked=await api.POST(post({targetType:'profile',targetTelegramId:998579758,stars:1,description:'test'}));assert.equal(blocked.status,403);
});
test('hidden reviews cannot be opened through a direct detail link',async()=>{
 const api=load('app/api/marketplace/reviews/route.ts',{db:async()=>[{id:'r',status:'hidden',description:'hidden content'}]});
 const response=await api.GET(get('review=r'));assert.equal(response.status,404);assert.ok(!(await response.text()).includes('hidden content'));
});
test('claiming a report is atomic and conflicts when someone else claimed it',async()=>{
 let query;const api=load('app/api/admin/manage/route.ts',{role:'Модератор',userId:123,db:async url=>{query=url;return []}});
 const response=await api.POST(post({action:'claim_report',payload:{reportId:'report-id'}}));assert.equal(response.status,409);assert.ok(query.includes('reviewer_telegram_id=is.null'));
});
test('FAQ visibility is filtered server-side, not just hidden in the UI',async()=>{
 const db=async url=>url.startsWith('marketplace_faq_entries?')?[{id:'public',visible_roles:['all']},{id:'secret',answer:'owner-only',visible_roles:['Владелец']},{id:'member',visible_roles:['Участник']}]:[];
 const data=await (await load('app/api/marketplace/config/route.ts',{db}).GET(get())).json();assert.deepEqual(data.faq.map(x=>x.id),['public']);assert.equal(data.faqAdmin.length,0);assert.ok(!JSON.stringify(data).includes('owner-only'));
});
test('shop ownership transfer uses one transactional RPC and is owner-only',async()=>{
 let rpc;const db=async(url,init)=>{if(url.startsWith('marketplace_shops?owner_telegram_id'))return [];if(url.startsWith('marketplace_shops?id='))return [{id:'s1',owner_telegram_id:111}];if(url.startsWith('rpc/')){rpc={url,body:JSON.parse(init.body)};return [{id:'s1'}]}return []};
 const payload={id:'s1',name:'New name',description:'Description',ownerTelegramId:222,logoUrl:null};
 const response=await load('app/api/admin/manage/route.ts',{db}).POST(post({action:'edit_shop',payload}));assert.equal(response.status,200);assert.equal(rpc.url,'rpc/marketplace_transfer_shop');assert.equal(rpc.body.p_owner_id,222);
 assert.equal((await load('app/api/admin/manage/route.ts',{role:'Администратор',userId:333,db}).POST(post({action:'edit_shop',payload}))).status,403);
});
test('bot callback uses clicking user and store buttons open Telegram Web Apps',async()=>{
 const sent=[];const api=load('app/api/telegram/bot/route.ts',{db:async()=>[{id:'shop-id',name:'Store'}],fetch:async(url,init)=>{sent.push({url,body:JSON.parse(init.body)});return new Response(JSON.stringify({ok:true,result:{}}))}});
 const response=await api.POST(post({callback_query:{id:'cb',data:'shops',from:{id:123},message:{chat:{id:123},from:{id:999}}}}));assert.equal(response.status,200);
 const photo=sent.find(x=>x.url.endsWith('/sendPhoto'));assert.equal(photo.body.chat_id,123);assert.equal(photo.body.reply_markup.inline_keyboard[0][0].web_app.url,'https://market-ptz.vercel.app/?shop=shop-id');assert.ok(sent.some(x=>x.url.endsWith('/answerCallbackQuery')));
});
test('notification links work through the bot without a configured Mini App short name',()=>{
 const actual=load('lib/telegram-links.ts');
 assert.equal(actual.telegramMiniAppLink('ad','1234567890000'),'https://t.me/baraxolka_ptzbot?start=ad_1234567890000');
 assert.equal(actual.telegramNotificationLink('https://market-ptz.vercel.app/?shop=abc'),'https://t.me/baraxolka_ptzbot?start=shop_abc');
});
test('bot start links produce an inline Web App button for the intended listing',async()=>{
 const sent=[];const api=load('app/api/telegram/bot/route.ts',{db:async()=>[],fetch:async(url,init)=>{sent.push({url,body:JSON.parse(init.body)});return new Response(JSON.stringify({ok:true,result:{}}))}});
 const response=await api.POST(post({message:{from:{id:123,username:'fixture_user'},chat:{id:123},text:'/start ad_1234567890000'}}));assert.equal(response.status,200);
 const photo=sent.find(x=>x.url.endsWith('/sendPhoto'));assert.equal(photo.body.reply_markup.inline_keyboard[0][0].web_app.url,'https://market-ptz.vercel.app/?ad=1234567890000');
});


test('start repairs message-only webhooks without dropping pending updates or changing endpoint',async()=>{
 const calls=[];
 const api=load('app/api/telegram/bot/route.ts',{fetch:async(url,init)=>{
   const method=url.split('/').pop(),body=JSON.parse(init.body);calls.push({method,body});
   return new Response(JSON.stringify({ok:true,result:method==='getWebhookInfo'?{url:'https://market-ptz.vercel.app/api/telegram/bot',allowed_updates:['message'],max_connections:40}:{}}));
 }});
 assert.equal((await api.POST(post({message:{text:'/start',from:{id:123},chat:{id:123}}}))).status,200);
 const repair=calls.find(c=>c.method==='setWebhook');assert.ok(repair);
 assert.deepEqual(Array.from(repair.body.allowed_updates),['message','callback_query']);
 assert.equal(repair.body.url,'https://market-ptz.vercel.app/api/telegram/bot');
 assert.equal(repair.body.secret_token,'test-secret');assert.equal(repair.body.drop_pending_updates,undefined);
});

test('every inline menu callback answers the click and sends its section',async()=>{
 for(const data of ['shops','subscriptions','ref','stats','moderators','complaint','menu']){
   const calls=[];
   const api=load('app/api/telegram/bot/route.ts',{fetch:async(url,init)=>{calls.push({method:url.split('/').pop(),body:JSON.parse(init.body)});return new Response(JSON.stringify({ok:true,result:{}}));}});
   assert.equal((await api.POST(post({callback_query:{id:'click',data,from:{id:123},message:{chat:{id:123}}}}))).status,200);
   assert.ok(calls.some(c=>c.method==='answerCallbackQuery'),data);
   assert.ok(calls.some(c=>c.method==='sendPhoto'||c.method==='sendMessage'),data);
 }
});


test('analytics is owner-only and does not count its own reads as staff work',async()=>{
 for(const role of ['Участник','Магазин','Стажёр','Модератор','Администратор','Заместитель владельца']){const denied=load('app/api/admin/manage/route.ts',{role,userId:123});assert.equal((await denied.POST(post({action:'analytics',payload:{days:30}}))).status,403,role);}
 const queries=[];const api=load('app/api/admin/manage/route.ts',{db:async(url,init)=>{queries.push(url);assert.equal(JSON.parse(init.body).p_days,30);return {series:[],totals:{}};}});
 assert.equal((await api.POST(post({action:'analytics',payload:{days:30}}))).status,200);assert.deepEqual(queries,['rpc/marketplace_analytics']);
 assert.equal((await api.POST(post({action:'analytics',payload:{days:100000}}))).status,400);
});

test('broadcast stores uploaded photo and passes it to Telegram delivery',async()=>{
 const writes=[],sends=[];const image='https://fixture.supabase.co/storage/v1/object/public/marketplace-media/notifications/test.jpg';
 const api=load('app/api/admin/manage/route.ts',{db:async(url,init)=>{if(url.startsWith('marketplace_users?'))return [{telegram_id:123,bot_started_at:'2026-10-16'}];if(init?.body)writes.push({url,body:JSON.parse(init.body)});return [];},send:async(...args)=>{sends.push(args);return true;}});
 assert.equal((await api.POST(post({action:'broadcast',payload:{title:'News',message:'Hello',imageUrl:image}}))).status,200);
 assert.equal(writes.find(w=>w.url==='marketplace_notifications').body.image_url,image);assert.equal(sends[0][3],image);
 assert.equal((await api.POST(post({action:'broadcast',payload:{message:'Hello',imageUrl:'https://external.example/photo.jpg'}}))).status,400);
});

test('Telegram photo delivery preserves long notification text and Mini App button',async()=>{
 const calls=[],module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(base,'lib/telegram-auth.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:n=>n==='node:crypto'?require(n):n.includes('telegram-links')?links:{supabaseConfig:()=>({}),supabaseRequest:async()=>[]},URL,Buffer,process:{env:{TELEGRAM_BOT_TOKEN:'fixture-token'}},fetch:async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return new Response(JSON.stringify({ok:true}));}});
 const text='Д'.repeat(1400),photo='https://fixture.supabase.co/image.jpg';
 assert.equal(await module.exports.sendTelegramMessage(123,text,[[{text:'Open',url:links.APP_URL+'/?page=profile'}]],photo),true);
 assert.ok(calls[0].url.endsWith('/sendPhoto'));assert.equal(calls[0].body.photo,photo);assert.equal(calls[0].body.caption+calls[1].body.text,text);
 assert.equal(calls[0].body.reply_markup.inline_keyboard[0][0].web_app.url,links.APP_URL+'/?page=profile');
});
