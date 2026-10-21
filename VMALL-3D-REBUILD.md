# JOUMERA V-MALL 3D — Rebuild

This is the safe development branch for the new immersive 3D mall. Production remains untouched until tested.

## Scope
- Mobile-first interactive 3D mall with navigable aisles and vendor stands.
- Product selection, 360-degree model viewer (glTF/GLB), add-to-cart and checkout.
- Vendor portals: product catalog, wholesale cost, proposed retail, stock, stand management.
- Admin: approve products, set final retail price, allocate stands, orders, supplier settlements.
- Customer never sees wholesale cost; all prices are enforced server-side.
- Preserve existing Supabase credentials/configuration, live domains and existing records pending migration review.
- Preview deployment and end-to-end tests before production release.

## Milestones
1. Build 3D mall shell and mobile movement controls, plus fallback 2D browsing.
2. Wire demo products to a functional cart with local persistence.
3. Connect validated Supabase schema, authentication, and role-based authorization.
4. Implement vendor onboarding, product approvals, supplier ledger, checkout.
5. Test mobile performance and deploy preview; production only after review.

## Technical plan
Static JOUMERA currently uses root index.html with inline CSS. The initial prototype can be built as a standalone Three.js experience without changing deployment settings. Production commerce requires server-verified pricing, secure auth, and transactional order creation; no checkout claims before integration tests.

## Safety
No deletion of the current site, orders, product records, or database. This branch serves as a reversible working copy.
