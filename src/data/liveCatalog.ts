import { ALL_PRODUCTS, STORES, type Product, type Variant } from './catalog';
import type { CatalogRow } from '../api/backend';

export function publicAsset(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('/assets/') && !value.includes('..')) return value;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : undefined; } catch { return undefined; }
}

/** Approved RPC records replace samples per flagship store. An empty response never relabels demo stock as real. */
export function applyLiveCatalog(rows: CatalogRow[]): number {
  let count = 0;
  for (const store of STORES) {
    // HOCO display imagery is verified, but its sales prices/stock have not been matched to the connected bedding feed.
    // Keep the owner-supplied electronics display rather than relabel unrelated feed rows as HOCO inventory.
    if (store.id === 'hoco') continue;
    const products: Product[] = rows.filter(r => r.store_slug === store.id && r.slug && Number.isFinite(Number(r.retail_price)) && Number(r.retail_price) > 0).map(r => {
      const variants: Variant[] = Array.isArray(r.variants) ? r.variants.filter((v): v is Variant => Boolean(v && typeof v === 'object' && typeof v.id === 'string' && v.label && typeof v.label.en === 'string' && typeof v.label.ar === 'string')) : [];
      return {
        slug: r.slug, storeId: store.id, name: {en:r.name_en, ar:r.name_ar || r.name_en},
        desc: {en:r.description_en || '', ar:r.description_ar || r.description_en || ''},
        priceUSD:Number(r.retail_price), demo:false, available:r.in_stock === true, variants,
        shape:'vase', color:0xffffff, glb:publicAsset(r.model_path), image:publicAsset(r.image_path),
      };
    });
    if (products.length) { store.products = products; count += products.length; }
  }
  ALL_PRODUCTS.splice(0, ALL_PRODUCTS.length, ...STORES.flatMap(s => s.products));
  return count;
}
