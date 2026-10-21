import { STORES, type Product, type StoreDef } from './catalog';

const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase();

export function searchStores(query: string, stores: StoreDef[] = STORES): StoreDef[] {
  const q = normalize(query);
  if (!q) return [];
  return stores.filter((s) => normalize(`${s.name} ${s.tagline.en} ${s.tagline.ar} ${s.id}`).includes(q));
}

export function searchProducts(query: string, stores: StoreDef[] = STORES): Array<{ product: Product; store: StoreDef }> {
  const q = normalize(query);
  if (!q) return [];
  const matchingStores = new Set(searchStores(q, stores).map((s) => s.id));
  return stores.flatMap((store) => store.products
    .filter((product) => matchingStores.has(store.id) || normalize(`${product.name.en} ${product.name.ar} ${product.desc.en} ${product.desc.ar} ${product.slug}`).includes(q))
    .map((product) => ({ product, store })));
}
