alter table public.marketplace_listing_moderation add column if not exists reviewed_by bigint;
alter table public.marketplace_listing_moderation add column if not exists reviewed_username text;
alter table public.marketplace_listing_moderation add column if not exists reviewed_name text;
alter table public.marketplace_listing_moderation add column if not exists reviewed_at timestamptz;
update public.marketplace_listing_moderation m set reviewed_by=m.updated_by, reviewed_at=m.updated_at, reviewed_username=u.username, reviewed_name=u.first_name from public.marketplace_users u where m.admin_queue_hidden and m.reviewed_by is null and u.telegram_id=m.updated_by;
update public.marketplace_listing_moderation set reviewed_by=updated_by,reviewed_at=updated_at where admin_queue_hidden and reviewed_by is null;
alter table public.marketplace_faq_entries add column if not exists visible_roles text[] not null default array['all'];

create or replace function public.marketplace_transfer_shop(p_shop_id uuid,p_name text,p_description text,p_logo_url text,p_owner_id bigint,p_actor_id bigint) returns setof public.marketplace_shops
language plpgsql security definer set search_path=public as $$
declare old_shop public.marketplace_shops; new_username text;
begin
  if p_actor_id <> 998579758 then raise exception 'Only platform owner can transfer shops'; end if;
  select * into old_shop from marketplace_shops where id=p_shop_id for update;
  if not found then raise exception 'Shop not found'; end if;
  if not exists(select 1 from marketplace_users where telegram_id=p_owner_id) then raise exception 'New owner must first open Mini App'; end if;
  if exists(select 1 from marketplace_shops where owner_telegram_id=p_owner_id and id<>p_shop_id) then raise exception 'New owner already has a shop'; end if;
  select username into new_username from marketplace_users where telegram_id=p_owner_id;
  update marketplace_listings set seller_telegram_id=p_owner_id,seller_username=coalesce(nullif(new_username,''),p_owner_id::text) where shop_id=p_shop_id;
  update marketplace_reports set object_owner_telegram_id=p_owner_id,object_owner_username=new_username where (object_type='shop' and object_id=p_shop_id::text) or (object_type='listing' and object_id in(select listing_id from marketplace_listings where shop_id=p_shop_id));
  return query update marketplace_shops set name=p_name,description=p_description,logo_url=p_logo_url,owner_telegram_id=p_owner_id where id=p_shop_id returning *;
end; $$;
revoke all on function public.marketplace_transfer_shop(uuid,text,text,text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.marketplace_transfer_shop(uuid,text,text,text,bigint,bigint) to service_role;

create or replace function public.marketplace_delete_shop(p_shop_id uuid,p_actor_id bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.marketplace_shops; ids text[];
begin
  if p_actor_id<>998579758 and not exists(select 1 from marketplace_staff_roles where telegram_id=p_actor_id and role in('Заместитель владельца','Администратор')) then raise exception 'Not allowed'; end if;
  select * into s from marketplace_shops where id=p_shop_id for update;
  if not found then raise exception 'Shop not found'; end if;
  select array_agg(listing_id) into ids from marketplace_listings where shop_id=p_shop_id;
  insert into marketplace_deleted_shop_subscriptions(shop_id,telegram_id,shop_name,deleted_at) select p_shop_id,telegram_id,s.name,now() from marketplace_shop_subscriptions where shop_id=p_shop_id on conflict(shop_id,telegram_id) do update set shop_name=excluded.shop_name,deleted_at=excluded.deleted_at;
  delete from marketplace_reports where (object_type='shop' and object_id=p_shop_id::text) or (object_type='listing' and object_id=any(coalesce(ids,array[]::text[])));
  delete from marketplace_listing_moderation where (object_type='shop' and object_id=p_shop_id::text) or (object_type='listing' and object_id=any(coalesce(ids,array[]::text[])));
  delete from marketplace_listing_views where listing_id=any(coalesce(ids,array[]::text[]));
  delete from marketplace_listings where shop_id=p_shop_id;
  delete from marketplace_shops where id=p_shop_id;
  return jsonb_build_object('id',p_shop_id,'name',s.name,'deletedListings',coalesce(array_length(ids,1),0));
end; $$;
revoke all on function public.marketplace_delete_shop(uuid,bigint) from public,anon,authenticated;
grant execute on function public.marketplace_delete_shop(uuid,bigint) to service_role;

create or replace function public.marketplace_guard_owner_reviews() returns trigger
language plpgsql set search_path=public as $$ begin
  if new.target_type='profile' and new.target_telegram_id=998579758 then raise exception 'Platform owner cannot receive reviews'; end if;
  return new;
end; $$;
drop trigger if exists marketplace_owner_review_guard on public.marketplace_reviews;
create trigger marketplace_owner_review_guard before insert or update on public.marketplace_reviews for each row execute function public.marketplace_guard_owner_reviews();
notify pgrst, 'reload schema';
