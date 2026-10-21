export type Lang = 'en' | 'ar';
export interface L10n { en: string; ar: string }
export interface Variant { id: string; label: L10n; color?: number }
export type Shape = 'laptop' | 'speaker' | 'vase' | 'bottle' | 'bag' | 'lamp';

export interface Product {
  slug: string;
  storeId: string;
  name: L10n;
  desc: L10n;
  /** null = no real price available. Demo prices are flagged with demo:true. */
  priceUSD: number | null;
  demo: boolean;
  available: boolean;
  variants: Variant[];
  shape: Shape;
  color: number;
  /** Path under /public, e.g. /assets/models/x.glb. Only use a model that matches the displayed item. */
  glb?: string;
  image?: string;
  images?: string[];
}

export interface StoreDef {
  id: string;
  side: -1 | 1;
  zc: number;
  name: string;
  tagline: L10n;
  accent: number;
  floor: number;
  products: Product[];
}

const V = (id: string, en: string, ar: string, color?: number): Variant => ({ id, label: { en, ar }, color });
const COLORS = [V('black', 'Black', 'أسود', 0x1b1b1d), V('silver', 'Silver', 'فضي', 0xb9bcc2), V('champagne', 'Champagne', 'شامبانيا', 0xc9ad7e)];
const DESC: L10n = {
  en: 'Demo item. Real details and pricing are supplied by the vendor once the store is live.',
  ar: 'منتج تجريبي. تُضاف التفاصيل والأسعار الحقيقية من البائع عند تشغيل المتجر.',
};

function P(storeId: string, slug: string, en: string, ar: string, price: number, shape: Shape, color: number): Product {
  return { slug, storeId, name: { en, ar }, desc: DESC, priceUSD: price, demo: true, available: true, variants: COLORS, shape, color };
}

export const STORES: StoreDef[] = [
  {
    id: 'tech-studio', side: -1, zc: -2, name: 'TECH STUDIO', accent: 0x2b3a4a, floor: 0x2a2c30,
    tagline: { en: 'Electronics & accessories', ar: 'إلكترونيات وإكسسوارات' },
    products: [
      P('tech-studio', 'demo-laptop-14', 'Slim Laptop 14"', 'حاسوب محمول 14 بوصة', 1299, 'laptop', 0xb9bcc2),
      P('tech-studio', 'demo-speaker-portable', 'Portable Speaker', 'مكبر صوت محمول', 149, 'speaker', 0x1b1b1d),
      P('tech-studio', 'demo-speaker-studio', 'Studio Speaker', 'مكبر صوت استوديو', 289, 'speaker', 0xc9ad7e),
      P('tech-studio', 'demo-laptop-16', 'Creator Laptop 16"', 'حاسوب للمبدعين 16 بوصة', 1899, 'laptop', 0x1b1b1d),
    ],
  },
  {
    id: 'home-gallery', side: -1, zc: -14, name: 'HOME GALLERY', accent: 0x8c6f4e, floor: 0x6b5238,
    tagline: { en: 'Home products & decor', ar: 'منتجات ومستلزمات المنزل' },
    products: [
      P('home-gallery', 'demo-vase-ceramic', 'Ceramic Vase', 'مزهرية سيراميك', 79, 'vase', 0xe9e4da),
      P('home-gallery', 'demo-vase-sculpted', 'Sculpted Vase', 'مزهرية منحوتة', 110, 'vase', 0x8c6f4e),
      P('home-gallery', 'demo-lamp-table', 'Table Lamp', 'مصباح طاولة', 95, 'lamp', 0xc9ad7e),
      P('home-gallery', 'demo-lamp-reading', 'Reading Lamp', 'مصباح قراءة', 120, 'lamp', 0x1b1b1d),
    ],
  },
  {
    id: 'style-lab', side: -1, zc: -26, name: 'STYLE LAB', accent: 0x5a2e3a, floor: 0x3a2a2d,
    tagline: { en: 'Fashion & accessories', ar: 'أزياء وإكسسوارات' },
    products: [
      P('style-lab', 'demo-tote', 'Leather Tote', 'حقيبة جلدية', 240, 'bag', 0x5a2e3a),
      P('style-lab', 'demo-crossbody', 'Crossbody Bag', 'حقيبة كتف', 180, 'bag', 0x1b1b1d),
      P('style-lab', 'demo-weekender', 'Weekend Bag', 'حقيبة سفر', 320, 'bag', 0x8c6f4e),
      P('style-lab', 'demo-clutch', 'Evening Clutch', 'حقيبة سهرة', 130, 'bag', 0xc9ad7e),
    ],
  },
  {
    id: 'smart-living', side: 1, zc: -8, name: 'SMART LIVING', accent: 0x3f6b5d, floor: 0x2c3a35,
    tagline: { en: 'Innovative lifestyle products', ar: 'منتجات عصرية لنمط حياة ذكي' },
    products: [
      P('smart-living', 'demo-smart-lamp', 'Smart Lamp', 'مصباح ذكي', 69, 'lamp', 0xe9e4da),
      P('smart-living', 'demo-smart-speaker', 'Smart Speaker', 'مكبر صوت ذكي', 99, 'speaker', 0x3f6b5d),
      P('smart-living', 'demo-bottle-insulated', 'Insulated Bottle', 'قارورة عازلة', 35, 'bottle', 0xb9bcc2),
      P('smart-living', 'demo-mood-light', 'Mood Light', 'إضاءة أجواء', 55, 'lamp', 0xc9ad7e),
    ],
  },
  {
    id: 'beauty-atelier', side: 1, zc: -20, name: 'BEAUTY ATELIER', accent: 0xb58b82, floor: 0x4a3a38,
    tagline: { en: 'Beauty & fragrances', ar: 'جمال وعطور' },
    products: [
      P('beauty-atelier', 'demo-parfum', 'Eau de Parfum', 'ماء عطر', 150, 'bottle', 0xc9ad7e),
      P('beauty-atelier', 'demo-serum', 'Night Serum', 'سيروم ليلي', 85, 'bottle', 0xb58b82),
      P('beauty-atelier', 'demo-face-oil', 'Face Oil', 'زيت للوجه', 60, 'bottle', 0x3f6b5d),
      P('beauty-atelier', 'demo-hand-cream', 'Hand Cream', 'كريم لليدين', 28, 'bottle', 0xe9e4da),
    ],
  },
  {
    id: 'hoco', side: 1, zc: 4, name: 'HOCO', accent: 0x28564c, floor: 0x7a684e,
    tagline: { en: 'Home, textiles & living', ar: 'المنزل والمفروشات ونمط الحياة' },
    // This item is from the connected HOCO catalogue. Its image and $24 price are read from Supabase;
    // checkout stays disabled until the commercial launch gate is explicitly enabled.
    products: [{ slug: 'hoco-sherpa-double-220x240', storeId: 'hoco', name: { en: 'Sherpa Blanket Double 220×240 cm', ar: 'حرام شيربا مجوز 220×240 سم' }, desc: { en: 'Sherpa blanket, double size 220×240 cm.', ar: 'حرام شيربا مقاس مجوز 220×240 سم.' }, priceUSD: 24, demo: false, available: true, variants: [], shape: 'vase', color: 0xe9e4da, image: 'https://aiizdgxutredbzcrkkjq.supabase.co/storage/v1/object/public/hoco-media/1790599815430-c7266745-e794-441f-8e84-a63dfb8c5b2a.jpg', images: ['https://aiizdgxutredbzcrkkjq.supabase.co/storage/v1/object/public/hoco-media/1790599815430-c7266745-e794-441f-8e84-a63dfb8c5b2a.jpg','https://aiizdgxutredbzcrkkjq.supabase.co/storage/v1/object/public/hoco-media/1790599818441-9ae4ce31-fa2b-431e-b6cf-ef18e5a67448.jpg','https://aiizdgxutredbzcrkkjq.supabase.co/storage/v1/object/public/hoco-media/1790599821565-5f88a851-a684-498f-9f50-b290c7d5bd89.jpg','https://aiizdgxutredbzcrkkjq.supabase.co/storage/v1/object/public/hoco-media/1790599824646-34a3b051-2415-4492-a43b-43fe1a09400a.jpg','https://aiizdgxutredbzcrkkjq.supabase.co/storage/v1/object/public/hoco-media/1790599828358-52dadc52-f3f4-4bb4-8801-b4e19604e630.jpg','https://aiizdgxutredbzcrkkjq.supabase.co/storage/v1/object/public/hoco-media/1790599832196-ff3768d9-04b7-4927-88c5-ebb49998c7d8.jpg'] }],
  },
];

// Licensed decorative samples remain DEMO; they are not verified vendor inventory.
for (const store of STORES) for (const product of store.products) {
  if (product.slug === 'demo-laptop-14') {
    product.glb = '/assets/models/classic_laptop.glb';
    product.name = {en:'Classic Laptop — Display Asset', ar:'حاسوب كلاسيكي — مجسم عرض'};
    product.variants = [];
  }
  if (product.slug === 'demo-vase-ceramic') {
    product.glb = '/assets/models/ceramic_vase_03.glb';
    product.variants = [];
    product.desc = { en: 'CC0 ceramic display asset by Poly Haven. Demonstration only, not available for real orders.', ar: 'مجسم سيراميك مرخّص CC0 من Poly Haven للعرض التجريبي فقط، وليس منتجاً متاحاً للطلب الحقيقي.' };
  }
}

export const ALL_PRODUCTS: Product[] = STORES.flatMap((s) => s.products);
export const findProduct = (slug: string): Product | undefined => ALL_PRODUCTS.find((p) => p.slug === slug);

/** Interior rectangle of a store (inside the 0.25 m partition wall). */
export function storeRect(s: StoreDef) {
  return {
    minX: s.side > 0 ? 8.25 : -20,
    maxX: s.side > 0 ? 20 : -8.25,
    minZ: s.zc - 5,
    maxZ: s.zc + 5,
  };
}
