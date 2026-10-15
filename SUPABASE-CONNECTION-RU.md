# Подключение проекта Marketplace к Supabase и Vercel

## Уже внесено в код

- В `.env.example` указаны предоставленные `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Серверный Supabase REST-клиент сначала читает `SUPABASE_URL`, а при его отсутствии — `NEXT_PUBLIC_SUPABASE_URL`.
- Серверные запросы по-прежнему требуют `SUPABASE_SERVICE_ROLE_KEY`; publishable key его не заменяет.

## Что нужно сделать в Supabase

1. В Supabase Dashboard откройте **SQL Editor**.
2. Выполните содержимое `supabase/schema.sql`, чтобы создать таблицы и Storage bucket.
3. В настройках проекта найдите серверный secret/service role key. Не используйте `sb_publishable_...` вместо него.

## Что добавить в Vercel → Settings → Environment Variables

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mcrlvlxuyygimlgkbzvk.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | выданный вам `sb_publishable_...` |
| `SUPABASE_URL` | `https://mcrlvlxuyygimlgkbzvk.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | секретный ключ Supabase — вводить прямо в Vercel |
| `TELEGRAM_BOT_TOKEN` | токен вашего бота из BotFather — вводить прямо в Vercel |

Добавьте переменные в нужные среды (обычно Production, Preview и Development). После сохранения выполните **Redeploy**. Секретные ключи не отправляйте в чат и не добавляйте в репозиторий.

## Проверка

Для локальной разработки скопируйте `.env.example` в `.env.local` и заполните `SUPABASE_SERVICE_ROLE_KEY` и `TELEGRAM_BOT_TOKEN` настоящими секретными значениями. Не публикуйте `.env.local`. Затем выполните `npm install` и `npm run build`.

## Обновление v9 (уведомления, магазинные объявления и статистика)

1. Перед обновлением сделайте резервную копию таблиц в Supabase.
2. Откройте `supabase/schema.sql`, выделите весь файл и выполните в **SQL Editor**. Скрипт включает прежнюю схему и v9-обновления; большинство действий идемпотентны (`IF NOT EXISTS`, `CREATE OR REPLACE`).
3. Убедитесь, что созданы таблицы `marketplace_listings`, `marketplace_listing_views`, `marketplace_profile_views`, `marketplace_shop_views`, `marketplace_profile_subscriptions`, `marketplace_shop_subscriptions`, `marketplace_notifications` и `marketplace_reviews`.
4. Убедитесь, что у `marketplace_notifications` есть колонки `message`, `read`, `created_at`, `action_url`, `read_at`; у `marketplace_listings` — `listing_id`, `seller_telegram_id`, `shop_id`, `listing_group`, `hidden`, `photo_urls`.
5. В Vercel должны быть заданы серверные `SUPABASE_URL` (либо `NEXT_PUBLIC_SUPABASE_URL`) и `SUPABASE_SERVICE_ROLE_KEY`. Publishable key не заменяет service-role key.
6. После SQL обновите приложение и выполните Redeploy.

### Какие данные где учитываются

- `marketplace_listings` — серверные объявления, цена, фото, `shop_id`, тип/категория и видимость.
- `marketplace_listing_views` — уникальный просмотр объявления пользователем Telegram.
- `marketplace_profile_views`, `marketplace_shop_views` — уникальные просмотры профиля и витрины.
- `marketplace_profile_subscriptions`, `marketplace_shop_subscriptions` — подписки на профили/магазины.
- `marketplace_shop_subscription_counts`, `marketplace_profile_subscription_counts` — агрегированные счётчики для ускорения каталога.
- `marketplace_notifications` — текст, ссылка, дата и статус прочтения уведомления.
- `marketplace_users.referred_by`, `referral_attributed_at`, `bot_started_at` — реферал и первый запуск бота; `miniapp_started_at` — запуск Mini App.
- `marketplace_reviews` — отзывы, оценки, статусы и оспаривание.
- `marketplace_reports` — жалобы, решение и комментарии модерации.

Доступ на запись к таблицам выполняется через серверные API, использующие `SUPABASE_SERVICE_ROLE_KEY`. Не делайте service-role key публичным и не включайте его в `NEXT_PUBLIC_*`.
