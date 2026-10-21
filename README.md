# JOUMERA V-MALL

Walkable first-person 3D mall (Three.js + Vite + TypeScript) with a multi-vendor Supabase backend design.
Read **STATUS.md** first: it lists exactly what is and is not done.

## Run locally
```bash
npm install
cp .env.example .env      # leave empty for demo mode
npm run lint && npm test
npm run dev
```
Demo mode (no env vars): everything works except checkout, which is disabled. Prices shown are flagged DEMO.

## Supabase (optional, use a DEV project)
1. Create a new Supabase project (not the production one).
2. Run `supabase/migrations/001_schema.sql` in the SQL editor.
3. Sign up once, then promote yourself: `update public.profiles set role='super_admin' where id='<your auth user id>';`
4. Create stores and products (slug must match `src/data/catalog.ts`, e.g. `demo-laptop-14`), set `retail_price` and
   `status='approved'` as super admin.
5. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. Checkout then calls `place_order`, which prices the
   order on the server (cash on delivery).

## Deploy safely (existing production site)
```bash
git checkout -b feature/v-mall      # never commit to the production branch
git add . && git commit -m "Add V-MALL" && git push -u origin feature/v-mall
```
In Vercel, import this as a NEW project (or use the branch preview of a separate repo). Add the two env vars to the
Preview environment only. Do not change the production domain or production branch until the preview is approved.

## Project layout
- `src/world` mall geometry + product stand-ins; `src/controls` walker, collision, A* navigation
- `src/ui` HUD, cart, settings, product viewer; `src/data/catalog.ts` stores + demo products
- `src/api/backend.ts` Supabase access; `supabase/migrations` schema + RLS; `public/assets/manifest.json` asset needs

## Adding real products
Put a Meshopt-compressed GLB in `public/assets/models/`, set `glb: '/assets/models/name.glb'` on the product.
