# JOUMERA V-MALL — release candidate

This branch deploys a **development preview**. It is not ready to replace the live HOCO storefront or accept commercial orders.

## Implemented

- Three.js mall shell with generated marble/wood/tile material maps, warm lighting, glass storefronts, a vaulted roof and store-specific fixture layouts. The arrival foyer now has a wide, clear sliding-door opening, illuminated portal signage, stone inlay and a lightweight ring chandelier; the reduced-motion option also removes the idle entrance sway.
- Five walkable interiors: TECH STUDIO, HOME GALLERY, STYLE LAB, SMART LIVING and BEAUTY ATELIER.
- First-person mobile movement with eased acceleration/turning, touch-ID-separated joystick and look controls, auto-walk cancellation, collision resolution and reduced-motion support.
- Bilingual store/product search, product viewer, cart, DEMO price marking and catalog fallback when WebGL cannot start.
- Unit coverage for movement, collision, pathfinding, cart calculations and Arabic/English search.
- An isolated `v_mall` schema added to the active HOCO Supabase database. Its tables have RLS enabled and no direct `anon`/`authenticated` table privileges. `vmall_catalog` returns only approved, priced products; no V-Mall products were seeded. `vmall_place_order` checks a server-side checkout flag and is not executable by public API roles.
- A separate `/admin-vmall.html` sign-in and management workspace, plus database role-checked RPCs for vendor product submissions, administrator price approval, account role assignment and store creation. Vendor writes cannot set retail prices. RPC privileges/search paths were read back from HOCO after migration. The workspace has not been exercised with real administrator or vendor sessions.

## Not ready for commercial launch

- The 20 products and prices shown in fallback mode are **demo data**, not vendor inventory. The live V-Mall catalog currently returns no items.
- Checkout remains disabled. No real V-Mall order has been accepted or tested. Verified supplier stock/prices, delivery fees, fulfillment policy and anti-abuse controls are missing.
- No V-Mall super-admin has been assigned. Initial privilege bootstrapping requires an explicitly verified Auth account; the project owner email was not assumed to be a V-Mall identity. No vendor accounts, stores or products exist yet, and role-isolation behavior has not been end-to-end tested with two real accounts. HOCO's existing `/admin` page remains separate.
- The existing HOCO tables and records were left unchanged, but V-Mall schema installation added a new private schema and two RPC functions to that active Supabase project.
- No licensed GLB mall/store/product pack or external PBR texture pack is bundled. Geometry and materials remain procedural; the environment is a stylized preview, not photorealistic.
- No final Android device run or measured FPS/latency run is available. The attached recording shows an earlier preview. The cloud browser does not provide WebGL, so it cannot verify the final 3D scene.

## Verification

```text
npm install       passed
npm run lint      passed
npm test          14 passed
npm run build     passed
Vercel Preview    READY; page returned HTTP 200
Supabase          v_mall schema/RLS and management/order RPC privileges verified; catalog empty; checkout disabled
```

Keep Vercel Production on the existing `main` deployment until the missing catalogue, vendor/admin controls, commerce policy and Android device QA are complete.
