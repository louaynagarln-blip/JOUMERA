# JOUMERA V-MALL 3D — implementation status

## Built on development branch
- Interactive Three.js 3D mall with four sample vendor stands.
- Touch/keyboard navigation and local demo cart.
- Separate interactive 360° product studio at `product.html` with rotation, zoom and selectable colors.
- Sample geometry and catalog are illustrative, not real supplier products.

## Security and launch gates
- **Not a live store.** No real payment, order processing, authentication or supplier data.
- Vendor costs and admin retail pricing must be stored server-side with row-level permissions, not in browser code.
- Never use client-supplied prices to create orders. Calculate total and supplier settlements in a trusted backend.
- Existing main branch remains untouched; new branch has no legacy storefront files.
- Validate WebGL/mobile performance and hosting preview before publishing to production.

## Next
Implement verified catalog backend, admin/vendor auth, checkout, supplier settlements, real GLB upload/validation, and performance tests.
