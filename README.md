# Rental Platform

Landlords manage properties and leases; tenants message their landlord and pay rent online.
One Expo app runs on iOS, Android and the web, backed by Supabase.

## Layout

| Path | What it is |
| --- | --- |
| `apps/mobile` | Expo (React Native) app with Expo Router, for iOS, Android and web |
| `packages/shared` | Types, validation (Zod) and rent and money helpers shared by the app and server code |
| `supabase/migrations` | Database schema, row-level security policies, triggers |
| `supabase/tests` | Row-level security checks that run on plain Postgres |

## Getting started

Requires Node 22 and pnpm 10.

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env   # then add your Supabase URL and anon key
pnpm --filter @rental/mobile dev                # press w for web, or scan the QR code with Expo Go
```

### Database

Use either a hosted Supabase project or a local one:

- **Hosted:** create a project at supabase.com, then `pnpm supabase link --project-ref <ref>` and `pnpm supabase db push`.
- **Local (needs Docker):** `pnpm supabase start` runs everything and applies the migrations; it prints the URL and anon key for `.env`.

## Checks

```bash
pnpm typecheck   # TypeScript across the workspace
pnpm test        # unit tests
pnpm db:test     # applies migrations to Postgres and checks access rules (set PGHOST, PGUSER, etc.)
```

## How access works

Every table has row-level security. A landlord sees only their own properties, units and leases.
A tenant sees a lease once they accept its invite, which happens automatically when they sign up
or sign in with the invited email. Payments, rent charges and Stripe account state are written only by
server functions using the service role, never by the app.

## Roadmap

1. Scaffold: monorepo, app shell, schema, sign-up and sign-in by role (done)
2. Properties, units, leases and tenant invites (done)
3. Messaging with realtime updates, attachments and push notifications
4. Rent payments with Stripe Connect: onboarding, charges, autopay, receipts
5. Reminders, late fees, store release
