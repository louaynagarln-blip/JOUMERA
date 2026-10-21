# JOUMERA V-MALL — Release-candidate status

This is a **development preview**, not a production-ready commerce release. The official domain remains on the existing `main` deployment.

## Implemented in this branch

- Three.js mall shell with a barrel-vault roof, warm architectural lighting, instanced stone columns and foliage, generated marble/wood/tile maps, glass storefronts and store-specific fixtures.
- Five navigable store interiors: TECH STUDIO, HOME GALLERY, STYLE LAB, SMART LIVING and BEAUTY ATELIER.
- First-person mobile controls, softened acceleration and turning, dead-zone joystick, touch-ID separation, auto-walk routing, collision resolution, reduced-motion and quality settings.
- Bilingual product/store search, product viewer, cart UI, demo-price badges and a catalog fallback when WebGL cannot start.
- Unit coverage for movement response, collision resolution, pathfinding, cart math and bilingual catalog search.

## Commercial release blockers

- The twenty listed V-Mall products and all shown prices are **demo data**. They are not vendor inventory and checkout stays disabled unless a live catalog loads.
- The migration in `supabase/migrations/001_schema.sql` is only a proposal; it has not been applied or verified against a dedicated JOUMERA marketplace database.
- The connected, active Supabase project is the existing HOCO store database. It contains the production store's product/order system and does not have the V-Mall store/vendor schema. Do not apply this migration there.
- This branch has no JOUMERA vendor-management/admin application. The repository's root `/admin` page is the existing HOCO administration surface, served by its current backend; it is not the V-Mall vendor portal.
- No production GLB product/architecture pack or external PBR texture pack is bundled. Current geometry and maps are procedural stand-ins; they do not constitute photorealistic mall assets.
- No final-build Android device test or measured FPS/latency run is recorded. The supplied Android recording is a reference of an earlier preview. The available cloud browser has WebGL disabled and displays the catalog fallback.

## Current verification

The latest local source checks completed successfully:

```text
npm install       passed
npm run lint      passed
npm test          14 tests passed
npm run build     passed
```

The Vercel preview is suitable for review only. Production remains on the pre-existing `main` deployment until real V-Mall catalog data, a separate compatible backend, functional vendor/admin flows and device QA are available.
