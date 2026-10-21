# JOUMERA V-MALL

Walkable first-person 3D mall built with Three.js, Vite, TypeScript and Supabase.
Read [STATUS.md](STATUS.md) before using it: this is a review preview, not a live multi-vendor store.

## Run locally

```bash
npm install
cp .env.example .env
npm run lint
npm test
npm run dev
```

Without Vite Supabase environment variables, the app uses the visible demo catalog and keeps checkout disabled. Demo products and prices are not real offers.

## Supabase isolation

The existing HOCO database has its own production storefront tables. V-Mall uses a separate `v_mall` schema and the `vmall_*` RPC names; do not connect it to HOCO's `catalog`, `products`, `orders` or `place_order` interfaces.

`supabase/migrations/001_schema.sql` is a deprecated, colliding draft and intentionally contains no executable schema. The timestamped migrations create isolated tables and role-checked management RPCs. They have been applied to the HOCO database without importing products or changing HOCO records. The catalog is empty, checkout is disabled in `v_mall.settings`, and the order RPC is not executable by public API roles. The `/admin-vmall.html` page uses Supabase Auth; a verified existing account must be explicitly assigned `super_admin` before it is usable. Vendor accounts can only manage products belonging to their active store, and cannot set customer retail prices.

Do not enable checkout until vendors, stock, verified retail prices, delivery fees, order operations, abuse controls and admin/vendor management have been implemented and tested.

## Safe deployment

Use a Vercel Preview deployment on a development branch. The Supabase URL and publishable key, if configured, belong in Preview only. Do not promote this app to `main` or Production while `STATUS.md` lists release blockers.

## Project layout

- `src/world`: mall architecture, optimized licensed GLB furnishings and PBR material maps
- `src/controls`: walking, collision and pathfinding
- `src/ui`: HUD, cart, settings and product viewer
- `src/data`: demo catalog and bilingual search
- `src/api/backend.ts`: V-Mall-only catalog and order RPC adapter
- `admin-vmall.html`: V-Mall-only administrator and vendor workspace
- `supabase/migrations`: isolated schema and role-checked management migrations

## Current asset-first candidate

Read `STATUS.md` for the launch blockers and `public/assets/LICENSES.md` for the seven integrated CC0 models. The source assets are included; no runtime dependency on Poly Haven exists. `public/assets/PROVENANCE.json` records downloads, checksums and the pinned optimization pipeline. Production promotion is blocked until actual visual, Android, commerce and authorization acceptance passes.
