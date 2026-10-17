create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('marketplace-listing-reminders','*/10 * * * *',$job$select net.http_post(url:='https://market-ptz.vercel.app/api/internal/listing-reminders',headers:=jsonb_build_object('Content-Type','application/json','x-reminder-key',(select secret from public.marketplace_reminder_key where singleton)),body:='{}'::jsonb,timeout_milliseconds:=60000);$job$);
select cron.schedule('marketplace-bot-draft-cleanup','30 3 * * *',$job$delete from public.marketplace_bot_drafts where updated_at<now()-interval '7 days'; delete from public.marketplace_bot_update_receipts where created_at<now()-interval '7 days';$job$);
