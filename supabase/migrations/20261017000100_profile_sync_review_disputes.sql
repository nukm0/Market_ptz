alter table public.marketplace_users add column if not exists profile_personal_background_url text;
alter table public.marketplace_users add column if not exists profile_updated_at timestamptz not null default now();
alter table public.marketplace_users add column if not exists verified_vk_url text;
alter table public.marketplace_reviews add column if not exists dispute_state text not null default 'none';
alter table public.marketplace_reviews add column if not exists dispute_materials jsonb not null default '[]';
alter table public.marketplace_reviews add column if not exists dispute_report_id uuid;
alter table public.marketplace_reviews add column if not exists dispute_comment text;
alter table public.marketplace_reviews add column if not exists approval_notified_at timestamptz;
create index if not exists marketplace_reviews_target_approved_idx on public.marketplace_reviews(target_telegram_id,created_at desc) where status='approved';
create index if not exists marketplace_reports_reporter_idx on public.marketplace_reports(reporter_telegram_id,created_at desc);
create or replace function public.marketplace_dispute_review(p_user bigint,p_review uuid,p_reason text,p_materials jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare r marketplace_reviews; target_id bigint; report_id uuid;
begin
 select * into r from marketplace_reviews where id=p_review for update;
 if not found or r.status<>'approved' then raise exception 'Отзыв недоступен для оспаривания';end if;
 if r.dispute_state<>'none' then raise exception 'Этот отзыв уже был оспорен';end if;
 target_id:=r.target_telegram_id;
 if r.target_type='shop' then select owner_telegram_id into target_id from marketplace_shops where id=r.target_shop_id;end if;
 if target_id is distinct from p_user then raise exception 'Оспорить отзыв может только его получатель';end if;
 insert into marketplace_reports(reporter_telegram_id,object_type,object_id,object_title,object_owner_telegram_id,reason,details,materials,status)
 values(p_user,'review',r.id::text,'Отзыв '||r.stars||'★',p_user,'Оспаривание отзыва','Отзыв: '||r.description||E'\n\nОспаривание: '||p_reason,p_materials,'new') returning id into report_id;
 update marketplace_reviews set dispute_state='pending',dispute_text=p_reason,dispute_materials=p_materials,dispute_report_id=report_id where id=r.id;
 return jsonb_build_object('reportId',report_id,'reviewId',r.id);
end $$;
revoke execute on function public.marketplace_dispute_review(bigint,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.marketplace_dispute_review(bigint,uuid,text,jsonb) to service_role;
create or replace function public.marketplace_resolve_review_dispute(p_actor bigint,p_report uuid,p_accept boolean,p_comment text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare report marketplace_reports; r marketplace_reviews; actor_role text;
begin
 select role into actor_role from marketplace_staff_roles where telegram_id=p_actor;
 if p_actor<>998579758 and coalesce(actor_role,'') not in ('Заместитель владельца','Администратор','Модератор') then raise exception 'Недостаточно прав';end if;
 select * into report from marketplace_reports where id=p_report for update;
 if not found or report.object_type<>'review' or report.status='resolved' then raise exception 'Оспаривание уже закрыто или не найдено';end if;
 if p_actor<>998579758 and actor_role<>'Заместитель владельца' and report.reviewer_telegram_id is distinct from p_actor then raise exception 'Сначала возьмите обращение в работу';end if;
 select * into r from marketplace_reviews where id=report.object_id::uuid for update;
 if r.dispute_state<>'pending' then raise exception 'Оспаривание уже рассмотрено';end if;
 update marketplace_reviews set status=case when p_accept then 'hidden' else 'approved' end,dispute_state=case when p_accept then 'accepted' else 'rejected' end,dispute_comment=p_comment,reviewed_by=p_actor,reviewed_at=now() where id=r.id;
 update marketplace_reports set status='resolved',owner_decision=case when p_accept then 'accept_dispute' else 'reject_dispute' end,owner_comment=p_comment,owner_telegram_id=p_actor,resolved_at=now() where id=report.id;
 return jsonb_build_object('recipientId',report.reporter_telegram_id,'accepted',p_accept,'reviewId',r.id);
end $$;
revoke execute on function public.marketplace_resolve_review_dispute(bigint,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.marketplace_resolve_review_dispute(bigint,uuid,boolean,text) to service_role;
-- Keep formerly disputed published reviews visible while reviewing the dispute.
do $$ declare r marketplace_reviews; report_id uuid; target_id bigint; begin
 for r in select * from marketplace_reviews where status='disputed' loop
 target_id:=r.target_telegram_id;if r.target_type='shop' then select owner_telegram_id into target_id from marketplace_shops where id=r.target_shop_id;end if;
 insert into marketplace_reports(reporter_telegram_id,object_type,object_id,object_title,object_owner_telegram_id,reason,details,materials,status) values(target_id,'review',r.id::text,'Отзыв '||r.stars||'★',target_id,'Оспаривание отзыва',r.dispute_text,'[]','new') returning id into report_id;
 update marketplace_reviews set status='approved',dispute_state='pending',dispute_report_id=report_id where id=r.id;
 end loop;end $$;
