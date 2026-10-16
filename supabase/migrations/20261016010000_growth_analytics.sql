-- Immutable creation history keeps charts stable when listings or subscriptions are removed.
create table if not exists public.marketplace_growth_events (
 kind text not null, source_key text not null, occurred_at timestamptz not null,
 actor_id bigint, primary key(kind,source_key)
);
alter table public.marketplace_growth_events enable row level security;
revoke all on public.marketplace_growth_events from anon,authenticated;
grant all on public.marketplace_growth_events to service_role;
create index if not exists marketplace_growth_time_idx on public.marketplace_growth_events(occurred_at,kind);
alter table public.marketplace_notifications add column if not exists image_url text;
create or replace function public.marketplace_capture_growth() returns trigger language plpgsql security invoker set search_path=public as $$
declare j jsonb:=to_jsonb(new); k text:=tg_argv[0]; key text; stamp timestamptz;
begin
 stamp:=coalesce((j->>'created_at')::timestamptz,now());
 key:=coalesce(j->>'id',j->>'listing_id',j->>'telegram_id',j->>'target_telegram_id'||':'||(j->>'subscriber_telegram_id'),j->>'shop_id'||':'||(j->>'telegram_id'));
 if k='profile_subscriptions' then key:=(j->>'target_telegram_id')||':'||(j->>'subscriber_telegram_id')||':'||stamp::text; end if;
 if k='shop_subscriptions' then key:=(j->>'shop_id')||':'||(j->>'telegram_id')||':'||stamp::text; end if;
 if k='users' and tg_op='UPDATE' then
   if new.bot_started_at is not null and old.bot_started_at is null then insert into marketplace_growth_events values('bot',new.telegram_id::text,new.bot_started_at,null) on conflict do nothing; end if;
   return new;
 end if;
 insert into marketplace_growth_events values(k,key,stamp,(j->>'actor_telegram_id')::bigint) on conflict do nothing;
 if k='users' and (j->>'bot_started_at') is not null then insert into marketplace_growth_events values('bot',j->>'telegram_id',(j->>'bot_started_at')::timestamptz,null) on conflict do nothing; end if;
 return new;
end $$;
revoke execute on function public.marketplace_capture_growth() from public,anon,authenticated;
insert into public.marketplace_growth_events(kind,source_key,occurred_at) select 'users',telegram_id::text,created_at from public.marketplace_users on conflict do nothing;
drop trigger if exists capture_growth on public.marketplace_users;
create trigger capture_growth after insert or update on public.marketplace_users for each row execute function public.marketplace_capture_growth('users');
insert into public.marketplace_growth_events(kind,source_key,occurred_at) select 'listings',listing_id::text,created_at from public.marketplace_listings on conflict do nothing;
drop trigger if exists capture_growth on public.marketplace_listings;
create trigger capture_growth after insert  on public.marketplace_listings for each row execute function public.marketplace_capture_growth('listings');
insert into public.marketplace_growth_events(kind,source_key,occurred_at) select 'shops',id::text,created_at from public.marketplace_shops on conflict do nothing;
drop trigger if exists capture_growth on public.marketplace_shops;
create trigger capture_growth after insert  on public.marketplace_shops for each row execute function public.marketplace_capture_growth('shops');
insert into public.marketplace_growth_events(kind,source_key,occurred_at) select 'reviews',id::text,created_at from public.marketplace_reviews on conflict do nothing;
drop trigger if exists capture_growth on public.marketplace_reviews;
create trigger capture_growth after insert  on public.marketplace_reviews for each row execute function public.marketplace_capture_growth('reviews');
insert into public.marketplace_growth_events(kind,source_key,occurred_at) select 'reports',id::text,created_at from public.marketplace_reports on conflict do nothing;
drop trigger if exists capture_growth on public.marketplace_reports;
create trigger capture_growth after insert  on public.marketplace_reports for each row execute function public.marketplace_capture_growth('reports');
insert into public.marketplace_growth_events(kind,source_key,occurred_at) select 'views',id::text,created_at from public.marketplace_listing_views on conflict do nothing;
drop trigger if exists capture_growth on public.marketplace_listing_views;
create trigger capture_growth after insert  on public.marketplace_listing_views for each row execute function public.marketplace_capture_growth('views');
insert into public.marketplace_growth_events(kind,source_key,occurred_at) select 'profile_subscriptions',target_telegram_id::text||':'||subscriber_telegram_id::text||':'||created_at::text,created_at from public.marketplace_profile_subscriptions on conflict do nothing;
drop trigger if exists capture_growth on public.marketplace_profile_subscriptions;
create trigger capture_growth after insert  on public.marketplace_profile_subscriptions for each row execute function public.marketplace_capture_growth('profile_subscriptions');
insert into public.marketplace_growth_events(kind,source_key,occurred_at) select 'shop_subscriptions',shop_id::text||':'||telegram_id::text||':'||created_at::text,created_at from public.marketplace_shop_subscriptions on conflict do nothing;
drop trigger if exists capture_growth on public.marketplace_shop_subscriptions;
create trigger capture_growth after insert  on public.marketplace_shop_subscriptions for each row execute function public.marketplace_capture_growth('shop_subscriptions');
insert into public.marketplace_growth_events(kind,source_key,occurred_at) select 'bot',telegram_id::text,bot_started_at from public.marketplace_users where bot_started_at is not null on conflict do nothing;
create or replace function public.marketplace_analytics(p_days integer default 30) returns jsonb language sql stable security invoker set search_path=public as $$
with bounds as (select least(90,greatest(7,coalesce(p_days,30))) as n,(now() at time zone 'Europe/Moscow')::date as today),
activity as (
 select e.kind,e.occurred_at,null::bigint as actor from marketplace_growth_events e,bounds b where e.occurred_at>=((b.today-2*b.n+1)::timestamp at time zone 'Europe/Moscow')
 union all select 'staff',a.created_at,a.actor_telegram_id from marketplace_admin_audit a,bounds b where a.created_at>=((b.today-2*b.n+1)::timestamp at time zone 'Europe/Moscow') and a.action in ('assign_role','remove_role','create_shop','edit_shop','review_decision','broadcast','toggle_banner','delete_banner','toggle_shop','delete_shop','save_faq','delete_faq','create_banner','verify_user','delete_listing','hide_from_admin_queue','mark_listing_reviewed','claim_report','report_recommendation','reopen_report','owner_decision','set_shop_order','clear_bans','set_ban')
), daily as (select (occurred_at at time zone 'Europe/Moscow')::date as day,kind,count(*)::int as total from activity group by 1,2),
series as (select d::date as day from bounds b,lateral generate_series(b.today-b.n+1,b.today,'1 day') d),
rows as (select s.day,coalesce(jsonb_object_agg(d.kind,d.total) filter(where d.kind is not null),'{}') as counts from series s left join daily d using(day) group by s.day),
comparison as (select kind,sum(total) filter(where day>=b.today-b.n+1) as current,sum(total) filter(where day<b.today-b.n+1) as previous from daily,bounds b group by kind),
leaders as (select a.actor,count(*) as total,u.username,u.first_name from activity a cross join bounds b left join marketplace_users u on u.telegram_id=a.actor where kind='staff' and (a.occurred_at at time zone 'Europe/Moscow')::date>=b.today-b.n+1 group by a.actor,u.username,u.first_name order by total desc limit 20)
select jsonb_build_object('days',(select n from bounds),'timezone','Europe/Moscow','series',(select jsonb_agg(jsonb_build_object('day',day,'counts',counts) order by day) from rows),'comparison',coalesce((select jsonb_object_agg(kind,jsonb_build_object('current',coalesce(current,0),'previous',coalesce(previous,0))) from comparison),'{}'),'staff',coalesce((select jsonb_agg(jsonb_build_object('id',actor,'name',coalesce('@'||username,first_name,'ID '||actor::text),'total',total)) from leaders),'[]'),'totals',jsonb_build_object('users',(select count(*) from marketplace_users),'bot',(select count(*) from marketplace_users where bot_started_at is not null),'listings',(select count(*) from marketplace_listings where not hidden),'shops',(select count(*) from marketplace_shops where not hidden),'reviews',(select count(*) from marketplace_reviews where status='approved'),'pendingReports',(select count(*) from marketplace_reports where resolved_at is null)));
$$;
revoke execute on function public.marketplace_analytics(integer) from public,anon,authenticated;
grant execute on function public.marketplace_analytics(integer) to service_role;
