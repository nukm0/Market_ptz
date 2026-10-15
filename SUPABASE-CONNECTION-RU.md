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
