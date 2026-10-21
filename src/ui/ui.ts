import { t, pick, getLang, setLang, onLang, applyI18n } from '../i18n';
import { STORES, ALL_PRODUCTS, findProduct, type Product, type StoreDef } from '../data/catalog';
import { cart } from '../state';
import { totalCents } from '../cart';
import { ProductViewer, type ViewerStatus } from './viewer';
import { searchProducts, searchStores } from '../data/search';
import { isLive, placeOrder } from '../api/backend';
import type { Settings } from '../settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const priceOf = (slug: string): number | null => { const p = findProduct(slug); return p && p.available ? p.priceUSD : null; };

export const hooks = {
  onModal: (_open: boolean) => {},
  onWalkTo: (_storeId: string) => {},
  onSettings: (_s: Settings) => {},
  onEnter: () => {},
  onTutorialStart: () => {},
};

let settings: Settings;
let checkoutReady = false;
let fallbackReason: string | null = null;
let viewer: ProductViewer | null = null;
let interactTarget: Product | null = null;
const openOverlays = new Set<string>();

function show(id: string) { $(id).classList.remove('hidden'); if (!openOverlays.size) hooks.onModal(true); openOverlays.add(id); }
function hide(id: string) {
  $(id).classList.add('hidden');
  openOverlays.delete(id);
  if (id === 'modal') { viewer?.dispose(); viewer = null; }
  if (!openOverlays.size) hooks.onModal(false);
}

export function toast(msg: string): void {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  window.clearTimeout((toast as unknown as { h?: number }).h);
  (toast as unknown as { h?: number }).h = window.setTimeout(() => el.classList.remove('show'), 3200);
}

export function setProgress(f: number, label: string): void {
  $('bar').style.width = `${Math.round(f * 100)}%`;
  $('load-label').textContent = label;
}
export function setCheckoutReady(ready: boolean): void {
  checkoutReady = isLive && ready;
  renderCart();
}
export function showEnter(): void {
  $('load-label').textContent = '';
  $('enter').classList.remove('hidden');
}
export function hideLoading(): void { $('loading').classList.add('hidden'); $('hud').classList.remove('hidden'); }

export function maybeTutorial(): boolean {
  if (settings.tutorialDone) return false;
  show('tutorial');
  return true;
}

export function setBanner(st: StoreDef | null): void {
  const el = $('banner');
  if (!st) { el.classList.remove('show'); return; }
  el.innerHTML = `<b>${esc(st.name)}</b><span>${esc(pick(st.tagline))}</span>`;
  el.classList.add('show');
}

export function setInteract(p: Product | null): void {
  interactTarget = p;
  const b = $('interact');
  if (!p) { b.classList.add('hidden'); return; }
  b.textContent = `${t('interact')} · ${pick(p.name)}`;
  b.classList.remove('hidden');
}
export const triggerInteract = () => { if (interactTarget) openProduct(interactTarget); };

function statusText(s: ViewerStatus): string {
  return s === 'loading' ? t('modelLoading') : s === 'placeholder' ? t('modelPlaceholder') : s === 'error' ? t('modelError') : '';
}

function renderSearchResults(query: string): string {
  const products = searchProducts(query);
  const stores = searchStores(query);
  if (!query.trim()) return `<p class="search-hint">${t('searchHint')}</p>`;
  const productRows = products.map(({ product, store }) => `<button class="menu-item" data-search-product="${esc(product.slug)}"><span><b>${esc(pick(product.name))}</b><small>${esc(store.name)} · ${product.demo ? t('demoPrice') : product.priceUSD == null ? t('priceUnavailable') : money(Math.round(product.priceUSD * 100))}</small></span><span>›</span></button>`).join('');
  const storeRows = stores.map((store) => `<button class="menu-item" data-search-store="${esc(store.id)}"><span><b>${esc(store.name)}</b><small>${esc(pick(store.tagline))}</small></span><span>${t('walkTo')} ›</span></button>`).join('');
  return `${products.length ? `<h3>${t('searchProducts')}</h3>${productRows}` : ''}${stores.length ? `<h3>${t('searchStores')}</h3>${storeRows}` : ''}${products.length || stores.length ? '' : `<p>${t('noResults')}</p>`}`;
}

export function openSearch(): void {
  const el = $('search-modal');
  el.innerHTML = `<div class="card search-card"><button class="x" data-close aria-label="${t('close')}">&times;</button><h2>${t('search')}</h2><input id="search-input" type="search" autocomplete="off" placeholder="${t('searchPlaceholder')}" aria-label="${t('searchPlaceholder')}"><div id="search-results" aria-live="polite">${renderSearchResults('')}</div></div>`;
  show('search-modal');
  const input = $('search-input') as HTMLInputElement;
  input.addEventListener('input', () => { $('search-results').innerHTML = renderSearchResults(input.value); });
  requestAnimationFrame(() => input.focus());
  el.onclick = (event) => {
    const target = event.target as HTMLElement;
    if (target === el || target.hasAttribute('data-close')) { hide('search-modal'); return; }
    const productButton = target.closest<HTMLElement>('[data-search-product]');
    if (productButton) {
      const product = findProduct(productButton.dataset.searchProduct!);
      hide('search-modal'); if (product) openProduct(product); return;
    }
    const storeButton = target.closest<HTMLElement>('[data-search-store]');
    if (storeButton) {
      const id = storeButton.dataset.searchStore!;
      hide('search-modal');
      if ($('fallback').classList.contains('hidden')) hooks.onWalkTo(id);
      else {
        const storeName = STORES.find((store) => store.id === id)?.name;
        $('fallback').querySelectorAll('h3').forEach((heading) => {
          if (heading.textContent === storeName) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  };
}

export function openProduct(p: Product): void {
  const el = $('modal');
  let variant = p.variants[0]?.id ?? '';
  const canBuy = p.available && p.priceUSD != null;
  const price = canBuy ? `${money(Math.round(p.priceUSD! * 100))} ${p.demo ? `<span class="badge">${t('demoPrice')}</span>` : ''}` : t('priceUnavailable');
  el.innerHTML = `<div class="card" role="dialog" aria-modal="true">
    <button class="x" data-close aria-label="${t('close')}">&times;</button>
    <div class="viewer" id="viewer">${p.image ? `<img src="${esc(p.image)}" alt="${esc(pick(p.name))}" style="width:100%;height:100%;object-fit:contain" />` : ''}</div><div class="vstat" id="vstat"></div>
    <h3>${esc(pick(p.name))}</h3><p>${esc(pick(p.desc))}</p>
    <div class="price">${price}</div>
    <div class="chips">${p.variants.map((v, i) => `<button class="chip${i ? '' : ' on'}" data-v="${esc(v.id)}">${esc(pick(v.label))}</button>`).join('')}</div>
    <button id="add" class="primary" ${canBuy ? '' : 'disabled'}>${t('addToCart')}</button></div>`;
  show('modal');
  viewer?.dispose();
  if (p.glb) {
    $('viewer').replaceChildren();
    viewer = new ProductViewer($('viewer'), p, (s) => { $('vstat').textContent = statusText(s); });
    viewer.setTint(p.variants[0]?.color);
  } else { viewer = null; $('vstat').textContent = statusText('placeholder'); }
  el.onclick = (e) => {
    const tg = e.target as HTMLElement;
    if (tg === el || tg.hasAttribute('data-close')) { hide('modal'); return; }
    const chip = tg.closest<HTMLElement>('.chip');
    if (chip) {
      variant = chip.dataset.v!;
      el.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === chip));
      viewer?.setTint(p.variants.find((v) => v.id === variant)?.color);
    }
    if (tg.id === 'add' && canBuy) { cart.getState().add(p.slug, variant, 1); toast(`${pick(p.name)} +1`); }
  };
}

function renderCart(): void {
  const lines = cart.getState().lines;
  $('cart-count').textContent = String(lines.reduce((n, l) => n + l.qty, 0));
  if ($('drawer').classList.contains('hidden')) return;
  const body = lines.length
    ? lines.map((l) => {
        const p = findProduct(l.slug);
        const v = p?.variants.find((x) => x.id === l.variant);
        const pr = priceOf(l.slug);
        return `<div class="line"><div><b>${esc(p ? pick(p.name) : l.slug)}</b><br><small>${esc(v ? pick(v.label) : l.variant)} · ${pr == null ? t('priceUnavailable') : money(Math.round(pr * 100))}</small></div>
        <div class="qty"><button data-q="-1" data-s="${esc(l.slug)}" data-v="${esc(l.variant)}">−</button><span>${l.qty}</span><button data-q="1" data-s="${esc(l.slug)}" data-v="${esc(l.variant)}">+</button></div></div>`;
      }).join('')
    : `<p>${t('emptyCart')}</p>`;
  const form = lines.length ? `
    <h3 style="margin-top:1rem">${t('checkout')}</h3>
    <div class="row"><span>${t('total')}</span><b>${money(totalCents(lines, priceOf))}</b></div>
    ${checkoutReady ? '' : `<div class="note">${t('demoCheckout')}</div>`}
    <input id="c-name" autocomplete="name" placeholder="${t('name')}" />
    <input id="c-phone" autocomplete="tel" inputmode="tel" placeholder="${t('phone')}" />
    <textarea id="c-addr" rows="2" placeholder="${t('address')}"></textarea>
    <textarea id="c-notes" rows="2" placeholder="${t('notes')}"></textarea>
    <button id="c-go" class="primary" style="width:100%;margin-top:.6rem" ${checkoutReady ? '' : 'disabled'}>${t('placeOrder')}</button>` : '';
  const d = $('drawer');
  // preserve typed values across re-render
  const keep = ['c-name', 'c-phone', 'c-addr', 'c-notes'].map((id) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '');
  d.innerHTML = `<button class="x" data-close aria-label="${t('close')}">&times;</button><h2 style="font-family:Georgia,serif;font-weight:500">${t('cart')}</h2>${body}${form}`;
  ['c-name', 'c-phone', 'c-addr', 'c-notes'].forEach((id, i) => { const e = document.getElementById(id) as HTMLInputElement | null; if (e) e.value = keep[i]; });
}

function wireDrawer(): void {
  const d = $('drawer');
  d.onclick = async (e) => {
    const tg = e.target as HTMLElement;
    if (tg.hasAttribute('data-close')) { hide('drawer'); return; }
    if (tg.dataset.q) {
      const l = cart.getState().lines.find((x) => x.slug === tg.dataset.s && x.variant === tg.dataset.v);
      if (l) cart.getState().setQty(l.slug, l.variant, l.qty + Number(tg.dataset.q));
      return;
    }
    if (tg.id === 'c-go') {
      const v = (id: string) => (document.getElementById(id) as HTMLInputElement).value.trim();
      if (!v('c-name') || !v('c-phone') || !v('c-addr')) { toast(t('needFields')); return; }
      (tg as HTMLButtonElement).disabled = true;
      try {
        const lines = cart.getState().lines.map((l) => ({ slug: l.slug, variant: l.variant, qty: l.qty }));
        const id = await placeOrder(lines, { name: v('c-name'), phone: v('c-phone'), address: v('c-addr'), notes: v('c-notes') });
        cart.getState().clear();
        hide('drawer');
        toast(`${t('orderOk')} ${id.slice(0, 8)}`);
      } catch (err) {
        toast((err as Error).message || 'Error');
        (tg as HTMLButtonElement).disabled = false;
      }
    }
  };
}
export function openCart(): void { show('drawer'); renderCart(); }

export function openStores(): void {
  const el = $('menu-stores');
  el.innerHTML = `<div class="card"><button class="x" data-close aria-label="${t('close')}">&times;</button><h2>${t('stores')}</h2>
    ${STORES.map((s) => `<button class="menu-item" data-store="${s.id}"><span><b>${esc(s.name)}</b><small>${esc(pick(s.tagline))}</small></span><span>${t('walkTo')} ›</span></button>`).join('')}</div>`;
  show('menu-stores');
  el.onclick = (e) => {
    const tg = e.target as HTMLElement;
    const item = tg.closest<HTMLElement>('[data-store]');
    if (tg === el || tg.hasAttribute('data-close')) hide('menu-stores');
    else if (item) { hide('menu-stores'); hooks.onWalkTo(item.dataset.store!); }
  };
}

export function openSettings(): void {
  const el = $('settings');
  const q = (v: string) => `<option value="${v}" ${settings.quality === v ? 'selected' : ''}>${t(v)}</option>`;
  el.innerHTML = `<div class="card"><button class="x" data-close aria-label="${t('close')}">&times;</button><h2>${t('settings')}</h2>
    <div class="row"><label for="s-sens">${t('sens')}</label><input id="s-sens" type="range" min="0.4" max="2" step="0.1" value="${settings.sens}"></div>
    <div class="row"><label for="s-bob">${t('bob')}</label><input id="s-bob" type="checkbox" ${settings.bob ? 'checked' : ''}></div>
    <div class="row"><label for="s-red">${t('reduced')}</label><input id="s-red" type="checkbox" ${settings.reduced ? 'checked' : ''}></div>
    <div class="row"><label for="s-q">${t('quality')}</label><select id="s-q">${q('auto')}${q('low')}${q('medium')}${q('high')}</select></div>
    <div class="row"><span>${t('language')}</span><span><button class="ghost" data-lang="en">English</button> <button class="ghost" data-lang="ar">العربية</button></span></div></div>`;
  show('settings');
  const apply = () => {
    settings.sens = Number((document.getElementById('s-sens') as HTMLInputElement).value);
    settings.bob = (document.getElementById('s-bob') as HTMLInputElement).checked;
    settings.reduced = (document.getElementById('s-red') as HTMLInputElement).checked;
    settings.quality = (document.getElementById('s-q') as HTMLSelectElement).value as Settings['quality'];
    hooks.onSettings(settings);
  };
  el.oninput = apply;
  el.onchange = apply;
  el.onclick = (e) => {
    const tg = e.target as HTMLElement;
    if (tg === el || tg.hasAttribute('data-close')) hide('settings');
    if (tg.dataset.lang) { setLang(tg.dataset.lang as 'en' | 'ar'); openSettings(); }
  };
}

export function showFallback(reason: string): void {
  fallbackReason = reason;
  hideLoading();
  $('hud').classList.add('hidden');
  const f = $('fallback');
  f.classList.remove('hidden');
  f.innerHTML = `<div class="logo" style="font-size:1.6rem;text-align:center">JOUMERA</div>
    <h2 style="font-family:Georgia,serif;font-weight:500">${t('fallbackTitle')}</h2><p>${t('fallbackBody')}</p><p><small>${esc(reason)}</small></p>
    <p><button class="ghost" id="fb-search">${t('search')}</button> <button class="ghost" id="fb-cart">${t('cart')}</button> <button class="ghost" id="fb-set">${t('settings')}</button></p>
    ${STORES.map((s) => `<h3 style="font-family:Georgia,serif;letter-spacing:.15em;color:var(--champ)">${esc(s.name)}</h3><div class="grid">${s.products.map((p) => `<div class="pcard"><b>${esc(pick(p.name))}</b><br><small>${p.demo ? t('demoPrice') : p.priceUSD != null && p.available ? money(Math.round(p.priceUSD * 100)) : t('priceUnavailable')}</small><br><button class="ghost" data-p="${p.slug}" style="margin-top:.5rem">${t('interact')}</button></div>`).join('')}</div>`).join('')}`;
  f.onclick = (e) => {
    const tg = e.target as HTMLElement;
    if (tg.id === 'fb-search') openSearch();
    if (tg.id === 'fb-cart') openCart();
    if (tg.id === 'fb-set') openSettings();
    if (tg.dataset.p) { const p = findProduct(tg.dataset.p); if (p) openProduct(p); }
  };
}

export function showContextLost(): void {
  const el = $('modal');
  el.innerHTML = `<div class="card"><p>${t('ctxLost')}</p><button class="primary" id="reload">${t('reload')}</button></div>`;
  el.classList.remove('hidden');
  el.onclick = (e) => { if ((e.target as HTMLElement).id === 'reload') location.reload(); };
}

export function initUI(s: Settings): void {
  settings = s;
  document.documentElement.lang = getLang();
  document.documentElement.dir = getLang() === 'ar' ? 'rtl' : 'ltr';
  applyI18n();
  $('enter').onclick = () => hooks.onEnter();
  $('lang-intro').onclick = () => setLang(getLang() === 'ar' ? 'en' : 'ar');
  $('btn-stores').onclick = openStores;
  $('btn-search').onclick = openSearch;
  $('btn-cart').onclick = openCart;
  $('btn-settings').onclick = openSettings;
  $('interact').onclick = triggerInteract;
  $('tut-go').onclick = () => {
    if (($('tut-never') as HTMLInputElement).checked) { settings.tutorialDone = true; hooks.onSettings(settings); }
    hide('tutorial');
    hooks.onTutorialStart();
  };
  wireDrawer();
  cart.subscribe(renderCart);
  onLang(() => { renderCart(); if (fallbackReason !== null) showFallback(fallbackReason); });
  renderCart();
  void ALL_PRODUCTS;
}
