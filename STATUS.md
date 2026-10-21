# JOUMERA — development candidate, not cleared for Production

Updated 2026-10-21.

## Implemented and verified

- Nine actual licensed CC0 Poly Haven GLBs: chair, sofa, coffee table, vase, plant, ceiling lamp, classic laptop, wooden cabinet and framed mirror. Included in repository with embedded WebP, Meshopt, source hashes and provenance. Marble PBR maps included.
- Replaced identical shelf displays with actual cabinets; framed mirrors in STYLE LAB and BEAUTY ATELIER. Distinct rounded technology pods, fashion plinths and beauty bar replace the repeated elliptical islands. HOME GALLERY has a sofa/table/chair vignette. Shop tray ceilings and shadow gaps; horizontal arrival chandelier; inexpensive floor contact-shadow proxies under furnishings.
- Fixed-step first-person movement, collision subdivision, touch pointer separation, manual auto-walk override, pitch limits, reduced motion, tap navigation and bounded floor. Navigation and furniture clearance have unit tests.
- Existing verified owner Auth account assigned V-Mall super_admin after explicit user authorization. Password sign-in and administrator RPC access succeeded through the real Auth API. No password change was needed and no password was stored in source. Browser UI sign-in was not performed.
- Working management APIs/UI for product submission/review, retail approval, role assignment, store creation, store activation, scoped order listing/search, order status progression and delivered-sales summaries for the latest 200 orders.
- Vendor order output filters foreign-store items and totals. Vendors cannot change order status or store activation. Cancellation restores stock once under a row lock; completed orders cannot be cancelled. Verified with rolled-back database fixtures. No real orders or products seeded.
- HOCO V-Mall schema has RLS and no direct browser table access. Added role-checked RPCs and query indexes only within V-Mall. HOCO data remains 64 products / 1 order. V-Mall: 1 administrator / 0 products / 0 orders; checkout remains disabled.

## Verification

npm install, TypeScript lint, 27 unit cases, production build passed. See docs/automated-tests.txt.

Real API tests: owner password sign-in, profile role, admin product read, management operations; unknown-user denial; vendor item/price isolation; status lifecycle; terminal-state rejection; cancellation restocks exactly once. All database fixtures were rolled back.

## Remaining launch gates

- No WebGL rendering or Android hardware is available in the cloud browser. No actual scene screenshots, visual acceptance, touch-device acceptance or measured FPS. Unit simulation at different frame rates is not a GPU benchmark.
- The building remains code-authored architecture. No professionally authored complete mall shell, baked lighting or KTX2 pipeline. Nine assets and custom fixtures do not establish photorealism. Many products still lack matching models/photos and are labelled DEMO cards.
- No verified supplier catalog, prices, stock, delivery policy or fees. Real checkout is disabled in UI/database/RPC privileges.
- Vendor sessions have not been tested end to end with two real accounts. Initial owner API authentication is now verified.
- Rentals, advertisement operations, media upload workflow, customer order tracking, complete bilingual management, abuse controls, checkout idempotency and variant validation remain incomplete.
- Only five fixed flagship slugs map into the 3D layout.

## Deployment safety

Continue on codex/joumera-v-mall-final-candidate. Production/main baseline remains ab9d9cb53b56da824b06ee8dac51a98de59448cf, deployment dpl_8RZ57zrUDQMcMUxBU9XcNFX1X1Rr. Do not promote while these gates remain.
