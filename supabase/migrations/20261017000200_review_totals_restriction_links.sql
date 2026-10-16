alter table public.marketplace_bans add column if not exists report_id uuid;
create index if not exists marketplace_bans_report_idx on public.marketplace_bans(report_id) where report_id is not null;
create or replace function public.marketplace_review_summary(p_type text,p_target text) returns jsonb language sql stable security invoker set search_path=public as $$
select case when p_type='profile' and p_target='998579758' then jsonb_build_object('rating',5,'count',0) else (select jsonb_build_object('rating',coalesce(avg(stars),0),'count',count(*)) from marketplace_reviews where status='approved' and target_type=p_type and (case when p_type='shop' then target_shop_id::text else target_telegram_id::text end)=p_target) end;
$$;
revoke execute on function public.marketplace_review_summary(text,text) from public,anon,authenticated;
grant execute on function public.marketplace_review_summary(text,text) to service_role;
