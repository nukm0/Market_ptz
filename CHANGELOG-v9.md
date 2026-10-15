# Marketplace v9 — fixes, notifications, analytics and admin queue

## Fixed
- Store storefront listing matching no longer rejects an owner-matching listing just because an older/local copy has a stale `shopId`. Store counts and the owner's shop cabinet use the same matching rule.
- Notification rendering accepts the server's `message` field and displays title, body, date and unread state consistently.
- Notification read actions update the authenticated user's rows on the server; the top bell shows an unread count and a full Notifications menu is available from navigation.
- Admin review list loads automatically when its page is opened and uses batched user/shop lookups instead of per-review queries.
- Admin listing deletion removes the listing from `marketplace_listings` and cleans its view/moderation rows; listing moderation now separates new and reviewed IDs in the admin UI.
- Public shop listing count uses the same ID/owner fallback logic as the storefront.

## Changed
- Shop directory cards use the same shop logo photo as a full-card cover and a smaller thumbnail.
- Expanded light theme styling for admin drawers, tables, forms, review/complaint panels and notification surfaces.
- Added unique profile/shop view tables, aggregate subscription-count views and indexes supporting listing, notification, review and subscription queries.
- Added `app/api/marketplace/engagement` to track unique Telegram-authenticated profile/shop views.
- Review and shop configuration API lookups are batched to reduce round trips.

## Supabase
Run the complete `supabase/schema.sql` in the Supabase SQL Editor. Statements use `IF NOT EXISTS`/`CREATE OR REPLACE` for repeatable setup. Back up production before applying schema changes. Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code.

## Notes
- Unique profile/store views count one authenticated Telegram account per target, not every repeat visit.
- Pre-existing listings saved only in a browser's localStorage do not become server-persistent automatically. They must be republished through the app or migrated into `marketplace_listings`.
- Contact prefilled text works with public Telegram usernames; for accounts without a username Telegram may open a profile deep link without a prefilled message, due to Telegram client limitations.
