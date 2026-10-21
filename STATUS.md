# JOUMERA V-MALL — launch gate: BLOCKED

Updated 2026-10-21. This is a development candidate, not a finished commercial launch. Production/main remain unchanged.

## Delivered in this revision

- Seven downloaded, checksum-verified CC0 Poly Haven models, included as optimized GLB: chair, sofa, coffee table, vase, plant, ceiling lamp and classic laptop. Three actual marble PBR maps replace generated marble. See `public/assets/LICENSES.md` and `PROVENANCE.json`.
- Shared decoded resources, spatial architecture batching, near-distance detailed furniture, 512px embedded WebP, Meshopt geometry, anisotropic marble and capped adaptive pixel ratio. WebP is download compression, not GPU compression.
- HOME GALLERY now has a real sofa/chair/table vignette. Licensed seating, plants, ceiling fixtures and ceramic displays are integrated across the other stores/atrium. Repetitive primitive shelf merchandise, capsule garments and rotating products are removed. Missing product models are honest labelled cards, not claimed as realistic stock.
- Accurate bounding-box collisions for imported floor furnishings; corrected oversized display-island collision and open glass portals. The entrance has a bounded floor edge.
- Fixed-step walking at 120Hz simulation, up to 250ms delayed-frame recovery, substepped collision movement, eased velocity, segment-following auto-walk, immediate joystick cancel, bounded pitch, gentler look, pointer-capture/blur/orientation reset, optional head motion off by default, touch tap-to-walk.
- Actual approved catalog records can populate matching flagship stores, including image/model/variant fields. Empty results keep demos labelled. Catalogue fetching works before WebGL fallback. Real checkout stays disabled.
- Vendor edits preserve existing variants. Admin approval rejects a blank/zero client price. Product viewing uses actual GLB when supplied, photographs when supplied, otherwise an explicit unavailable-model status.

## Verified

- npm install, TypeScript lint, 24 Vitest cases, Vite production build: passed (see automated test log).
- Source GLBs have valid glTF headers, embedded resources, Meshopt extension and recorded triangle counts. No rendered visual quality claim follows from this check.
- HOCO database: private v_mall tables have RLS; no direct browser table access. 0 mall products, 0 mall orders, 0 mall super-admins. Existing HOCO data remained 64 products / 1 order.
- Authenticated role without a V-Mall profile was denied admin read, vendor read, price changes and checkout in live database tests.
- Server price lookup ignored a fabricated client price; stock deduction, invalid quantity, overselling rejection and transaction atomicity passed in a transaction rolled back completely. Confirmed 0 persisted fixtures/orders and checkout still disabled afterward. This is not an end-to-end customer order test.

## Release blockers / incomplete features

- Cloud browser cannot create WebGL. No final entrance/atrium/corridor/store rendered screenshots, visual acceptance, real multi-touch run or device FPS measurements. Attached 350319.mp4 is the old Android baseline only.
- Architecture is still code-built, with no baked lighting, authored complete mall GLB, KTX2 textures or verified architectural art direction. Seven real props improve content but do NOT establish photorealism or the requested world-class visual standard.
- Most product categories lack supplier imagery/models and verified stock/prices. Cards intentionally replace false product geometry. The classic laptop is a heritage decorative sample.
- No verified initial administrator account or vendor sessions; authentication bootstrap and two-vendor isolation acceptance remain blocked. No temporary account/password was created.
- Management supports sign-in, role checks, store creation, product submission and price review. It is not a complete platform: order operations/tracking, rentals, advertisements, sales analytics, media uploads and fully bilingual management remain incomplete.
- Checkout remains disabled in UI, database flag and public RPC permissions. Delivery fees, business policies, abuse prevention, variant validation, idempotency and full customer order acceptance need completion before enabling.
- Only the five fixed flagship store slugs map into the 3D layout. Arbitrary additional stores are not automatically given architecture.
- The development candidate must not replace the official production deployment while these gates fail.

## Rollback reference

Production baseline commit: ab9d9cb53b56da824b06ee8dac51a98de59448cf.
Production deployment: dpl_8RZ57zrUDQMcMUxBU9XcNFX1X1Rr.
Prior development commit: a04534910b1dbc9f8582efe1da8c09b9795b22f0.
No production promotion was performed. No database migration was applied by this revision.
