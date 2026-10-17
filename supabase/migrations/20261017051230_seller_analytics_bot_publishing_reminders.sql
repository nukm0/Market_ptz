alter table public.marketplace_listings add column publication_status text not null default 'active';
alter table public.marketplace_listings add column last_confirmed_at timestamptz not null default now();
alter table public.marketplace_listings add column reminder_sent_at timestamptz;
alter table public.marketplace_listings add column reminder_claimed_at timestamptz;

create table public.marketplace_listing_events(listing_id text not null,actor_id bigint not null,seller_id bigint not null,kind text not null check(kind in ('view','favorite','contact')),day date not null default (now() at time zone 'Europe/Moscow')::date,created_at timestamptz not null default now(),primary key(listing_id,actor_id,kind,day));
alter table public.marketplace_listing_events enable row level security;
revoke all on public.marketplace_listing_events from anon,authenticated;
grant all on public.marketplace_listing_events to service_role;
create index on public.marketplace_listing_events(seller_id,day);
insert into public.marketplace_listing_events(listing_id,actor_id,seller_id,kind,day,created_at) select v.listing_id,v.viewer_telegram_id,l.seller_telegram_id,'view',(v.created_at at time zone 'Europe/Moscow')::date,v.created_at from marketplace_listing_views v join marketplace_listings l using(listing_id) where v.viewer_telegram_id<>l.seller_telegram_id on conflict do nothing;
create function public.marketplace_track_listing(p_actor bigint,p_listing text,p_kind text) returns boolean language plpgsql security invoker set search_path=public as $$ declare seller bigint;begin
 if p_kind not in ('view','favorite','contact') then raise exception 'Неверный тип события';end if;
 select seller_telegram_id into seller from marketplace_listings where listing_id=p_listing;if not found or seller=p_actor then return false;end if;
 insert into marketplace_listing_events(listing_id,actor_id,seller_id,kind) values(p_listing,p_actor,seller,p_kind) on conflict do nothing;return true;end $$;
revoke execute on function public.marketplace_track_listing(bigint,text,text) from public,anon,authenticated;grant execute on function public.marketplace_track_listing(bigint,text,text) to service_role;
create function public.marketplace_seller_analytics(p_actor bigint,p_target bigint,p_days integer) returns jsonb language plpgsql security invoker set search_path=public as $$ declare answer jsonb;begin
 if p_actor<>998579758 and not exists(select 1 from marketplace_staff_roles where telegram_id=p_actor and role='Заместитель владельца') then raise exception 'Недостаточно прав';end if;
 if p_days not in (7,30,90) then raise exception 'Неверный период';end if;
 with bounds as(select (now() at time zone 'Europe/Moscow')::date as today), e as(select * from marketplace_listing_events,bounds where seller_id=p_target and day between today-p_days+1 and today), daily as(select d::date as day,count(*) filter(where kind='view') as views,count(*) filter(where kind='favorite') as favorites,count(*) filter(where kind='contact') as contacts from bounds cross join lateral generate_series(today-p_days+1,today,'1 day') d left join e on e.day=d::date group by d), listings as(select l.listing_id,l.title,l.photo_urls->>0 as photo,l.price,l.created_at,l.publication_status,count(e.*) filter(where e.kind='view') as views,count(e.*) filter(where e.kind='favorite') as favorites,count(e.*) filter(where e.kind='contact') as contacts from marketplace_listings l left join e using(listing_id) where l.seller_telegram_id=p_target group by l.listing_id)
 select jsonb_build_object('days',p_days,'views',(select count(*) from e where kind='view'),'favorites',(select count(*) from e where kind='favorite'),'contacts',(select count(*) from e where kind='contact'),'listingCount',(select count(*) from listings),'series',coalesce((select jsonb_agg(to_jsonb(daily) order by day) from daily),'[]'),'listings',coalesce((select jsonb_agg(to_jsonb(listings) order by created_at desc) from listings),'[]'),'trackingSince',(select min(created_at) from marketplace_listing_events where kind<>'view')) into answer;return answer;end $$;

revoke execute on function public.marketplace_seller_analytics(bigint,bigint,integer) from public,anon,authenticated;grant execute on function public.marketplace_seller_analytics(bigint,bigint,integer) to service_role;
create table public.marketplace_bot_drafts(telegram_id bigint primary key,id uuid not null default gen_random_uuid(),stage text not null default 'title',data jsonb not null default '{}',revision integer not null default 0,last_photo_at timestamptz,updated_at timestamptz not null default now());
create table public.marketplace_bot_update_receipts(update_id bigint primary key,created_at timestamptz not null default now());
alter table public.marketplace_bot_drafts enable row level security;alter table public.marketplace_bot_update_receipts enable row level security;
revoke all on public.marketplace_bot_drafts,public.marketplace_bot_update_receipts from anon,authenticated;grant all on public.marketplace_bot_drafts,public.marketplace_bot_update_receipts to service_role;
create function public.marketplace_bot_step(p_user bigint,p_update bigint,p_action text,p_value jsonb,p_draft uuid default null) returns jsonb language plpgsql security invoker set search_path=public as $$
declare d marketplace_bot_drafts;v text;photos jsonb;warning text;shop uuid;
begin
 if exists(select 1 from marketplace_bans where telegram_id=p_user and active and (permanent or expires_at>now())) and p_user<>998579758 then return jsonb_build_object('error','Аккаунт заблокирован. Подать апелляцию можно в личном кабинете.');end if;
 insert into marketplace_bot_update_receipts(update_id) values(p_update) on conflict do nothing;if not found then return jsonb_build_object('duplicate',true);end if;
 if p_action='begin' then insert into marketplace_bot_drafts(telegram_id) values(p_user) on conflict(telegram_id) do update set id=gen_random_uuid(),stage='title',data='{}',revision=0,last_photo_at=null;end if;
 select * into d from marketplace_bot_drafts where telegram_id=p_user for update;if not found then return jsonb_build_object('missing',true);end if;
 if p_draft is not null and p_draft<>d.id then return jsonb_build_object('error','Эта кнопка относится к старому черновику. Используйте последнее сообщение бота.');end if;
 if p_action='cancel' then delete from marketplace_bot_drafts where telegram_id=p_user;return jsonb_build_object('cancelled',true);end if;
 v:=p_value#>>'{}';
 if p_action='photo' and d.stage in ('photos','target','review') then
 photos:=coalesce(d.data->'photos','[]');if not photos @> jsonb_build_array(v) then photos:=photos||jsonb_build_array(v);end if;
 if jsonb_array_length(photos)>3 then photos:='[]';warning:='Получено больше 3 фото. Этот набор сброшен. Пожалуйста, отправьте заново от 1 до 3 фотографий.';end if;
 d.data:=jsonb_set(d.data,'{photos}',photos);d.stage:='photos';d.last_photo_at:=now();
 elsif p_action='answer' then
 case d.stage
 when 'title' then if char_length(trim(v)) not between 1 and 180 then warning:='Напишите название от 1 до 180 символов.';else d.data:=d.data||jsonb_build_object('title',trim(v));d.stage:='description';end if;
 when 'description' then if char_length(trim(v)) not between 1 and 4000 then warning:='Напишите описание от 1 до 4000 символов.';else d.data:=d.data||jsonb_build_object('description',trim(v));d.stage:='category';end if;
 when 'category' then if v not in ('Vape','Техника','Одежда','Дом и сад','Мебель','Авто','Спорт','Детское','Красота','Услуги','Другое') then warning:='Выберите категорию кнопкой.';else d.data:=d.data||jsonb_build_object('category',v);d.stage:=case when v='Vape' then 'subcategory' else 'price' end;end if;
 when 'subcategory' then if v not in ('Подики','Расходники','Услуги') then warning:='Выберите раздел кнопкой.';else d.data:=d.data||jsonb_build_object('subcategory',v);d.stage:='price';end if;
 when 'price' then if v !~ '^\d{1,9}([.,]\d{1,2})?$' then warning:='Введите цену числом. Для договорной цены отправьте 0.';else d.data:=d.data||jsonb_build_object('price',replace(v,',','.')::numeric);d.stage:='type';end if;
 when 'type' then if v not in ('Продажа','Покупка','Обмен') then warning:='Выберите тип кнопкой.';else d.data:=d.data||jsonb_build_object('type',v);d.stage:='photos';end if;
 else warning:='Сейчас нужно прислать фото или воспользоваться кнопками ниже.';end case;
 elsif p_action='photos_done' then
 if d.stage<>'photos' then warning:='Сначала завершите предыдущий шаг.';
 elsif jsonb_array_length(coalesce(d.data->'photos','[]')) not between 1 and 3 then warning:='Пришлите от 1 до 3 фото.';
 elsif d.last_photo_at>now()-interval '2 seconds' then warning:='Фото ещё обрабатываются. Через пару секунд снова нажмите «Фото загружены».';
 else select id into shop from marketplace_shops where owner_telegram_id=p_user limit 1;d.stage:=case when shop is null then 'review' else 'target' end;d.data:=d.data||jsonb_build_object('shopId',null);end if;
 elsif p_action in ('private','shop') and d.stage='target' then
 if p_action='shop' then select id into shop from marketplace_shops where owner_telegram_id=p_user limit 1;if shop is null then warning:='Магазин больше не закреплён за вашим аккаунтом.';else d.data:=d.data||jsonb_build_object('shopId',shop);d.stage:='review';end if;
 else d.data:=d.data||jsonb_build_object('shopId',null);d.stage:='review';end if;
 end if;
 update marketplace_bot_drafts set stage=d.stage,data=d.data,revision=revision+1,last_photo_at=d.last_photo_at,updated_at=now() where telegram_id=p_user returning * into d;
 return to_jsonb(d)||jsonb_build_object('warning',warning);
end $$;
revoke execute on function public.marketplace_bot_step(bigint,bigint,text,jsonb,uuid) from public,anon,authenticated;grant execute on function public.marketplace_bot_step(bigint,bigint,text,jsonb,uuid) to service_role;
create function public.marketplace_bot_publish(p_user bigint,p_draft uuid,p_revision integer,p_photos jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare d marketplace_bot_drafts;l marketplace_listings;sid uuid;lid text;
begin
 select * into d from marketplace_bot_drafts where telegram_id=p_user for update;
 if not found or d.id<>p_draft or d.revision<>p_revision or d.stage<>'review' then raise exception 'Черновик изменился или уже опубликован. Используйте последнюю кнопку подтверждения.';end if;
 if exists(select 1 from marketplace_bans where telegram_id=p_user and active and(permanent or expires_at>now())) and p_user<>998579758 then raise exception 'Аккаунт заблокирован';end if;
 if jsonb_array_length(p_photos) not between 1 and 3 then raise exception 'Добавьте от 1 до 3 фото';end if;
 sid:=(d.data->>'shopId')::uuid;if sid is not null and not exists(select 1 from marketplace_shops where id=sid and owner_telegram_id=p_user) then raise exception 'Магазин не принадлежит вашему аккаунту';end if;
 lid:=(floor(extract(epoch from clock_timestamp())*1000)::bigint*1000+floor(random()*1000)::bigint)::text;
 insert into marketplace_listings(listing_id,seller_telegram_id,seller_username,shop_id,title,category,subcategory,price,description,photo_urls,listing_type,listing_group)
 values(lid,p_user,(select username from marketplace_users where telegram_id=p_user),sid,d.data->>'title',d.data->>'category',coalesce(d.data->>'subcategory','Прочее'),(d.data->>'price')::numeric,d.data->>'description',p_photos,d.data->>'type',case when sid is null then 'частное' else 'магазина' end) returning * into l;
 delete from marketplace_bot_drafts where telegram_id=p_user;return to_jsonb(l);
end $$;
revoke execute on function public.marketplace_bot_publish(bigint,uuid,integer,jsonb) from public,anon,authenticated;grant execute on function public.marketplace_bot_publish(bigint,uuid,integer,jsonb) to service_role;
create function public.marketplace_listing_availability(p_user bigint,p_listing text,p_active boolean) returns boolean language plpgsql security invoker set search_path=public as $$ begin
 update marketplace_listings set publication_status=case when p_active then 'active' else 'withdrawn' end,last_confirmed_at=now(),reminder_sent_at=null,reminder_claimed_at=null where listing_id=p_listing and seller_telegram_id=p_user;if not found then raise exception 'Объявление не найдено или принадлежит другому аккаунту';end if;return true;end $$;
revoke execute on function public.marketplace_listing_availability(bigint,text,boolean) from public,anon,authenticated;grant execute on function public.marketplace_listing_availability(bigint,text,boolean) to service_role;
create table public.marketplace_reminder_key(singleton boolean primary key default true check(singleton),secret text not null default gen_random_uuid()::text||gen_random_uuid()::text);
alter table public.marketplace_reminder_key enable row level security;revoke all on public.marketplace_reminder_key from public,anon,authenticated;grant all on public.marketplace_reminder_key to service_role;
insert into marketplace_reminder_key(singleton) values(true);
create function public.marketplace_reminder_auth(p_secret text) returns boolean language sql stable security invoker set search_path=public as $$select exists(select 1 from marketplace_reminder_key where secret=p_secret)$$;
revoke execute on function public.marketplace_reminder_auth(text) from public,anon,authenticated;grant execute on function public.marketplace_reminder_auth(text) to service_role;
create function public.marketplace_claim_reminders() returns setof marketplace_listings language sql security invoker set search_path=public as $$
 update marketplace_listings set reminder_claimed_at=now() where listing_id in(select l.listing_id from marketplace_listings l join marketplace_users u on u.telegram_id=l.seller_telegram_id where u.bot_started_at is not null and l.publication_status='active' and not l.hidden and l.last_confirmed_at<now()-interval '7 days' and l.reminder_sent_at is null and(l.reminder_claimed_at is null or l.reminder_claimed_at<now()-interval '10 minutes') and (l.shop_id is null or exists(select 1 from marketplace_shops s where s.id=l.shop_id and not s.hidden)) and not exists(select 1 from marketplace_listing_moderation m where m.object_type='listing' and m.object_id=l.listing_id and m.public_hidden) order by l.last_confirmed_at limit 30 for update of l skip locked) returning *;
$$;
revoke execute on function public.marketplace_claim_reminders() from public,anon,authenticated;grant execute on function public.marketplace_claim_reminders() to service_role;
