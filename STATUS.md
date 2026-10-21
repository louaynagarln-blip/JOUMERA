# Implementation status (honest)

## Implemented in code
- Vite + TypeScript + Three.js project, Zustand (vanilla) cart state, Supabase client, Vercel config.
- Procedural luxury-style mall: marble hall, columns (instanced), skylight panels, 5 stores with glass storefronts,
  signage, shelving (instanced decor), display tables, counters, plants, benches, PBR materials, image-based lighting,
  fog, ACES tone mapping, a sun light with shadows on the "high" tier (hall ceiling acts as a skylight, store ceilings shade).
- First-person walker: 1.65 m eye height, 1.4 m/s walk (2.1 m/s shift-run), exponential accel/decel, frame-rate independent,
  smoothed look, optional head bob, reduced-motion mode, sensitivity setting, circle-vs-AABB collision with wall sliding.
- Mobile: left virtual joystick + right-side drag look, pointer-ID tracking per control, joystick instantly cancels auto-walk.
- Desktop: WASD/arrows, shift run, pointer lock, Esc release, E/F to interact.
- Auto-walk to any store using grid A* with line-of-sight smoothing and stuck detection.
- Product interaction (proximity + view cone), product modal with orbit / pinch / wheel viewer, variants (tint), add to cart,
  GLB loading (Meshopt) with placeholder fallback when no model exists.
- Cart (persisted), cart drawer, cash-on-delivery checkout form wired to `place_order` RPC.
- English/Arabic with RTL, quality tiers (auto/low/medium/high), automatic degradation, WebGL context-loss handling,
  2D catalogue fallback when WebGL fails, error toasts.
- Supabase SQL: tables, roles, triggers (vendors cannot set retail price or approve), RLS, public `catalog` view without
  wholesale price, server-side `place_order`, storage policies.
- Unit tests for collision, pathfinding and cart maths (tests/logic.test.ts).

## NOT done / needs real input
- **Photorealism is not achieved.** Geometry and textures are procedural stand-ins. Real PBR textures, GLB architecture/fixtures,
  and baked lightmaps are required (see public/assets/manifest.json).
- Product models: none supplied. All 20 products are labelled DEMO with demo prices and are not real inventory.
- No admin or vendor dashboard UI exists yet; only the database model, RLS and triggers. Admin/vendor work currently
  happens in the Supabase dashboard.
- Live catalogue only overrides price/stock for products whose `slug` matches a row in `catalog`; creating stores/products
  from the DB (instead of src/data/catalog.ts) is not built.
- Not implemented: click-to-move, Draco, KTX2 texture loading, LOD, lazy loading of stores, lightmaps, product search UI,
  login UI, rate limiting / abuse protection for guest orders (add Supabase edge protection or CAPTCHA before launch).
- Not performance-tested on any device. No FPS claims are made.

## Verification actually performed (in the build sandbox, which had no network)
- Collision, pathfinding and cart logic executed with Node and produced the expected results.
- Syntax-level TypeScript check of all source files passed. A full `tsc` type-check and `vite build` could NOT be run
  because npm packages could not be installed. **Run `npm install && npm run lint && npm test && npm run build` first;
  expect to fix a few type errors in the Three.js files.**
- The SQL has not been run against a database.
