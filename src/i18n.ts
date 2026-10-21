import type { Lang, L10n } from './data/catalog';

const D: Record<Lang, Record<string, string>> = {
  en: {
    loading: 'Preparing the mall', enter: 'ENTER JOUMERA', stores: 'Stores', cart: 'Cart', settings: 'Settings', close: 'Close',
    search: 'Search', searchPlaceholder: 'Search products or stores', searchHint: 'Search by product or store name', searchProducts: 'Products', searchStores: 'Stores', noResults: 'No matching products or stores.',
    tutTitle: 'Welcome to JOUMERA',
    tutBody: 'Touch: drag the left pad to walk, drag anywhere on the right to look. Desktop: click to look around, WASD to walk, E to interact, Esc to release the mouse.',
    dontShow: "Don't show again", start: 'Start exploring', interact: 'View product', addToCart: 'Add to cart',
    emptyCart: 'Your cart is empty.', total: 'Estimated total', checkout: 'Checkout (cash on delivery)',
    name: 'Full name', phone: 'Phone', address: 'Delivery address (Lebanon)', notes: 'Notes (optional)', placeOrder: 'Place order',
    demoCheckout: 'Orders are currently disabled. Products, prices and stock must be verified before checkout.',
    demo: 'DEMO', demoPrice: 'Demo price', priceUnavailable: 'Price unavailable', unverifiedListing: 'Display only · price/stock unverified', modelPlaceholder: 'Placeholder model (real 3D model not supplied yet)',
    modelError: '3D view unavailable', modelLoading: 'Loading 3D model…', walkTo: 'Walk here', sens: 'Look sensitivity', bob: 'Head bobbing',
    reduced: 'Reduced motion', quality: 'Graphics quality', auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High', language: 'Language',
    orderOk: 'Order received. Reference:', needFields: 'Please fill in name, phone and address.', lowFps: 'Graphics lowered to keep movement smooth.',
    ctxLost: 'Graphics were interrupted. Reload to continue.', reload: 'Reload', fallbackTitle: 'Catalogue view',
    fallbackBody: 'The 3D mall could not start on this device. You can still browse and shop here.', stuck: 'Navigation stopped.',
    liveFail: 'Live catalogue unavailable; showing demo mode.', soldOut: 'Out of stock', stopWalk: 'Stop walking',
  },
  ar: {
    loading: 'جارٍ تجهيز المول', enter: 'ادخل إلى جوميرا', stores: 'المتاجر', cart: 'السلة', settings: 'الإعدادات', close: 'إغلاق',
    search: 'بحث', searchPlaceholder: 'ابحث عن منتج أو متجر', searchHint: 'اكتب اسم المنتج أو المتجر', searchProducts: 'المنتجات', searchStores: 'المتاجر', noResults: 'لا توجد منتجات أو متاجر مطابقة.',
    tutTitle: 'أهلاً بك في جوميرا',
    tutBody: 'باللمس: اسحب اللوحة اليسرى للمشي واسحب في أي مكان على اليمين للنظر. على الحاسوب: انقر للنظر، WASD للمشي، E للتفاعل، Esc لتحرير الماوس.',
    dontShow: 'لا تُظهر مجدداً', start: 'ابدأ الاستكشاف', interact: 'عرض المنتج', addToCart: 'أضف إلى السلة',
    emptyCart: 'سلتك فارغة.', total: 'المجموع التقديري', checkout: 'إتمام الطلب (الدفع عند الاستلام)',
    name: 'الاسم الكامل', phone: 'الهاتف', address: 'عنوان التوصيل (لبنان)', notes: 'ملاحظات (اختياري)', placeOrder: 'إرسال الطلب',
    demoCheckout: 'الطلبات معطّلة حالياً. يجب اعتماد المنتجات والأسعار والمخزون قبل تفعيل الشراء.',
    demo: 'تجريبي', demoPrice: 'سعر تجريبي', priceUnavailable: 'السعر غير متوفر', unverifiedListing: 'للعرض فقط · السعر والمخزون غير معتمدين', modelPlaceholder: 'نموذج مؤقت (لم يتم توفير نموذج ثلاثي الأبعاد حقيقي بعد)',
    modelError: 'العرض ثلاثي الأبعاد غير متاح', modelLoading: 'جارٍ تحميل النموذج…', walkTo: 'امشِ إلى هنا', sens: 'حساسية النظر', bob: 'اهتزاز الرأس',
    reduced: 'تقليل الحركة', quality: 'جودة الرسومات', auto: 'تلقائي', low: 'منخفضة', medium: 'متوسطة', high: 'عالية', language: 'اللغة',
    orderOk: 'تم استلام الطلب. المرجع:', needFields: 'يرجى إدخال الاسم والهاتف والعنوان.', lowFps: 'تم خفض الرسومات للحفاظ على سلاسة الحركة.',
    ctxLost: 'توقفت الرسومات. أعد التحميل للمتابعة.', reload: 'إعادة التحميل', fallbackTitle: 'عرض الكتالوج',
    fallbackBody: 'تعذّر تشغيل المول ثلاثي الأبعاد على هذا الجهاز. يمكنك التصفح والتسوق من هنا.', stuck: 'توقف التنقل.',
    liveFail: 'تعذّر تحميل الكتالوج المباشر؛ يتم عرض الوضع التجريبي.', soldOut: 'نفدت الكمية', stopWalk: 'إيقاف المشي',
  },
};

const listeners: Array<() => void> = [];
let lang: Lang = 'en';
try {
  const saved = localStorage.getItem('jm.lang');
  lang = saved === 'ar' || saved === 'en' ? saved : navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
} catch { /* storage unavailable */ }

export const getLang = (): Lang => lang;
export const t = (k: string): string => D[lang][k] ?? D.en[k] ?? k;
export const pick = (l: L10n): string => l[lang] || l.en;
export const onLang = (f: () => void) => { listeners.push(f); };

export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n!); });
}

export function setLang(l: Lang): void {
  lang = l;
  try { localStorage.setItem('jm.lang', l); } catch { /* ignore */ }
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  applyI18n();
  listeners.forEach((f) => f());
}
