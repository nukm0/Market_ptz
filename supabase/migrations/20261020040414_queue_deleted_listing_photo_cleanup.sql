create table public.marketplace_listing_photo_cleanup (
 id uuid primary key default gen_random_uuid(),
 photo_url text not null unique,
 created_at timestamptz not null default now()
);
alter table public.marketplace_listing_photo_cleanup enable row level security;
revoke all on public.marketplace_listing_photo_cleanup from public, anon, authenticated;
grant select,insert,update,delete on public.marketplace_listing_photo_cleanup to service_role;
create function public.marketplace_queue_deleted_listing_photos()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.marketplace_listing_photo_cleanup(photo_url)
 select distinct value from jsonb_array_elements_text(
 case when jsonb_typeof(old.photo_urls)='array' then old.photo_urls else '[]'::jsonb end)
 where length(value) between 1 and 2000
 on conflict(photo_url) do nothing;
 return old;
end;
$$;
revoke all on function public.marketplace_queue_deleted_listing_photos() from public,anon,authenticated;
grant execute on function public.marketplace_queue_deleted_listing_photos() to service_role;
create trigger marketplace_queue_deleted_listing_photos
 after delete on public.marketplace_listings
 for each row execute function public.marketplace_queue_deleted_listing_photos();
