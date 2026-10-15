-- Link legacy store publications before any ownership transfer; the owner is unique.
update public.marketplace_listings l set shop_id=s.id from public.marketplace_shops s where l.shop_id is null and l.listing_group='магазина' and l.seller_telegram_id=s.owner_telegram_id;
create or replace function public.marketplace_guard_owner_reviews() returns trigger
language plpgsql set search_path=public as $$ begin
 if new.target_type='profile' and new.target_telegram_id=998579758 and (tg_op='INSERT' or new.status<>'hidden') then raise exception 'Platform owner cannot receive reviews'; end if;
 return new;
end; $$;
update public.marketplace_reviews set status='hidden',reviewed_at=now(),moderator_comment='Рейтинг владельца платформы фиксирован: отзывы недоступны.' where target_type='profile' and target_telegram_id=998579758 and status<>'hidden';
