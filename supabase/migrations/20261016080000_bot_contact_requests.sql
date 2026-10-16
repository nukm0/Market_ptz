create table if not exists public.marketplace_contact_requests (
 telegram_update_id bigint primary key,
 telegram_id bigint not null,
 username text,
 display_name text not null default '',
 topic text not null check(topic in ('shop','banner','verified','team')),
 message text not null check(char_length(message) between 1 and 3000),
 status text not null default 'pending' check(status in ('pending','sent','failed')),
 created_at timestamptz not null default now(),
 delivered_at timestamptz
);
alter table public.marketplace_contact_requests enable row level security;
revoke all on public.marketplace_contact_requests from anon,authenticated;
grant all on public.marketplace_contact_requests to service_role;
create index if not exists marketplace_contact_sender_idx on public.marketplace_contact_requests(telegram_id,created_at desc);
