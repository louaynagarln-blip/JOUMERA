import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import './admin.css';
import { renderOperations } from './adminOperations';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const root = document.querySelector<HTMLElement>('#admin-app')!;
const authCard = document.querySelector<HTMLElement>('#auth-card')!;
const workspace = document.querySelector<HTMLElement>('#workspace')!;
const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
let client: SupabaseClient | null = url && key ? createClient(url, key) : null;
let currentRole = '';
let editingVariants: unknown[] = [];
let rows: Product[] = [];

interface Profile { role: string; store_id: string | null; store_name: string | null }
interface Product { id: string; store_id: string; store_name: string; slug: string; name_en: string; name_ar: string | null; wholesale_price: number | null; retail_price: number | null; stock: number; status: string; image_path: string | null }
interface VendorProduct { id: string; slug: string; name_en: string; name_ar: string | null; description_en: string; description_ar: string; wholesale_price: number; retail_price: number | null; stock: number; variants: unknown[]; model_path: string | null; image_path: string | null; status: string }

function message(id: string, text: string, error = false) {
  const el = $(id); el.textContent = text; el.classList.toggle('error', error);
}
function setHidden(id: string, hidden: boolean) { $(id).classList.toggle('hidden', hidden); }
function needClient(): SupabaseClient {
  if (!client) throw new Error('Supabase is not configured for this deployment.');
  return client;
}
function roleError(error: { message: string }) {
  if (error.message.includes('admin_required') || error.message.includes('vendor_store_not_found')) return 'This account has no approved V-Mall management role or active store.';
  return error.message;
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); message('auth-message', 'Signing in…');
  try {
    const { error } = await needClient().auth.signInWithPassword({ email: $('login-email').value.trim(), password: $('login-password').value });
    if (error) throw error;
    await loadWorkspace();
  } catch (error) { message('auth-message', error instanceof Error ? error.message : 'Sign in failed', true); }
});

async function loadWorkspace() {
  const sb = needClient(); const { data: session } = await sb.auth.getSession();
  if (!session.session) { authCard.classList.remove('hidden'); workspace.classList.add('hidden'); return; }
  authCard.classList.add('hidden'); workspace.classList.remove('hidden');
  $('session-slot').innerHTML = `<span class="signed-in">${escape(session.session.user.email)}</span> <button id="logout" class="text-button">Sign out</button>`;
  $('logout').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });
  const { data, error } = await sb.rpc('vmall_my_profile');
  if (error) { message('workspace-message', error.message, true); return; }
  const profile = (data?.[0] ?? {}) as Profile; currentRole = profile.role ?? 'customer';
  document.getElementById('operations-view')?.remove();
  if (currentRole === 'vendor' || currentRole === 'super_admin') {
    const operations=document.createElement('section');operations.id='operations-view';workspace.appendChild(operations);
    await renderOperations(sb,operations,currentRole);
  }
  if (currentRole === 'vendor') {
    $('workspace-message').textContent = profile.store_name ? `Store: ${profile.store_name}` : 'Vendor access';
    setHidden('vendor-view', false); setHidden('admin-view', true); await loadVendorProducts();
  } else if (currentRole === 'super_admin') {
    $('workspace-message').textContent = 'Administrator access'; setHidden('admin-view', false); setHidden('vendor-view', true); await loadAdmin();
  } else {
    setHidden('vendor-view', true); setHidden('admin-view', true);
    message('workspace-message', 'This account is not assigned a V-Mall vendor or administrator role. Ask the project administrator to verify and grant access.', true);
  }
}

async function loadVendorProducts() {
  const { data, error } = await needClient().rpc('vmall_vendor_products');
  if (error) { message('workspace-message', roleError(error), true); return; }
  const list = (data ?? []) as VendorProduct[];
  $('vendor-products').innerHTML = list.length ? list.map((p) => `<article class="product-row"><div><strong>${escape(p.name_en)}</strong><span>${escape(p.slug)} · ${escape(p.status)} · ${p.stock} in stock</span><small>Wholesale ${Number(p.wholesale_price).toFixed(2)} · Retail ${p.retail_price == null ? 'not set' : Number(p.retail_price).toFixed(2)}</small></div><button class="admin-button edit-product" data-id="${escape(p.id)}">Edit</button></article>`).join('') : '<p class="empty">No products submitted yet.</p>';
  $('vendor-products').querySelectorAll<HTMLButtonElement>('.edit-product').forEach((button) => button.addEventListener('click', () => editProduct(list.find((p) => p.id === button.dataset.id)!)));
}

function editProduct(p?: VendorProduct) {
  editingVariants = p?.variants ?? [];
  $('product-form').classList.remove('hidden');
  const vals: Record<string, string> = {
      'product-id': p?.id ?? '', 'product-slug': p?.slug ?? '', 'product-name': p?.name_en ?? '',
    'product-name-ar': p?.name_ar ?? '', 'product-wholesale': String(p?.wholesale_price ?? ''),
    'product-stock': String(p?.stock ?? 0), 'product-image': p?.image_path ?? '', 'product-model': p?.model_path ?? '',
    'product-description': p?.description_en ?? '', 'product-description-ar': p?.description_ar ?? '',
  };
  for (const [id, value] of Object.entries(vals)) ($(id) as HTMLInputElement).value = value;
  $('product-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('new-product').addEventListener('click', () => editProduct());
$('cancel-product').addEventListener('click', () => $('product-form').classList.add('hidden'));
$('product-form').addEventListener('submit', async (event) => {
  event.preventDefault(); message('product-message', 'Submitting…');
  try {
    const { error } = await needClient().rpc('vmall_vendor_save_product', {
      p_id: $('product-id').value || null, p_slug: $('product-slug').value.trim(), p_name_en: $('product-name').value.trim(),
      p_name_ar: $('product-name-ar').value.trim() || null, p_description_en: $('product-description').value.trim() || null,
      p_description_ar: $('product-description-ar').value.trim() || null, p_wholesale_price: Number($('product-wholesale').value),
      p_stock: Number($('product-stock').value), p_variants: editingVariants, p_model_path: $('product-model').value.trim() || null,
      p_image_path: $('product-image').value.trim() || null,
    });
    if (error) throw error;
    message('product-message', 'Submitted for review. Retail price remains under administrator control.');
    $('product-form').classList.add('hidden'); await loadVendorProducts();
  } catch (error) { message('product-message', error instanceof Error ? error.message : 'Submission failed', true); }
});

async function loadAdmin() {
  const sb = needClient();
  const [productResult, userResult] = await Promise.all([sb.rpc('vmall_admin_products'), sb.rpc('vmall_admin_users')]);
  if (productResult.error || userResult.error) { message('workspace-message', (productResult.error ?? userResult.error)!.message, true); return; }
  rows = (productResult.data ?? []) as Product[];
  $('admin-products').innerHTML = rows.length ? `<table><thead><tr><th>Product</th><th>Store</th><th>Status</th><th>Wholesale</th><th>Retail price / review</th></tr></thead><tbody>${rows.map((p) => `<tr><td>${escape(p.name_en)}<small>${escape(p.slug)}</small></td><td>${escape(p.store_name)}</td><td>${escape(p.status)}</td><td>${p.wholesale_price == null ? '—' : Number(p.wholesale_price).toFixed(2)}</td><td><div class="price-cell"><input class="retail-input" aria-label="Retail price" type="number" min="0" step="0.01" value="${p.retail_price == null ? '' : escape(p.retail_price)}" /><button class="admin-button approve" data-id="${escape(p.id)}">Approve</button><button class="admin-button reject" data-id="${escape(p.id)}">Reject</button></div></td></tr>`).join('')}</tbody></table>` : '<p class="empty">No product submissions yet.</p>';
  $('admin-products').querySelectorAll<HTMLButtonElement>('.approve').forEach((b) => b.addEventListener('click', () => review(b.dataset.id!, true, b.parentElement!.querySelector('input')!.value.trim() === '' ? null : Number(b.parentElement!.querySelector('input')!.value))));
  $('admin-products').querySelectorAll<HTMLButtonElement>('.reject').forEach((b) => b.addEventListener('click', () => review(b.dataset.id!, false, null)));
  const users = (userResult.data ?? []) as Array<{user_id:string;email:string;role:string}>;
  $('admin-users').innerHTML = users.length ? `<table><thead><tr><th>Verified account</th><th>Role</th><th>Assign access</th></tr></thead><tbody>${users.map((u) => `<tr><td>${escape(u.email)}<small class="uuid">${escape(u.user_id)}</small></td><td>${escape(u.role)}</td><td><div class="role-cell"><select aria-label="Role for ${escape(u.email)}" data-user="${escape(u.user_id)}"><option value="customer" ${u.role==='customer'?'selected':''}>Customer</option><option value="vendor" ${u.role==='vendor'?'selected':''}>Vendor</option><option value="super_admin" ${u.role==='super_admin'?'selected':''}>Super admin</option></select><button class="admin-button assign-role" data-user="${escape(u.user_id)}">Save</button></div></td></tr>`).join('')}</tbody></table>` : '<p class="empty">No authenticated accounts exist yet.</p>';
  $('admin-users').querySelectorAll<HTMLButtonElement>('.assign-role').forEach((b) => b.addEventListener('click', () => assignRole(b.dataset.user!)));
}

async function review(id: string, approve: boolean, price: number | null) {
  if (approve && (price === null || !Number.isFinite(price) || price <= 0)) { message('workspace-message', 'Enter a valid retail price before approval.', true); return; }
  const { error } = await needClient().rpc('vmall_admin_review_product', { p_id: id, p_approve: approve, p_retail_price: price });
  if (error) message('workspace-message', error.message, true); else { message('workspace-message', approve ? 'Approved with administrator price.' : 'Product rejected.'); await loadAdmin(); }
}
async function assignRole(userId: string) {
  const select = $('admin-users').querySelector<HTMLSelectElement>(`select[data-user="${CSS.escape(userId)}"]`);
  if (!select) return;
  const { error } = await needClient().rpc('vmall_admin_set_user_role', { p_user: userId, p_role: select.value });
  if (error) message('workspace-message', error.message, true); else { message('workspace-message', 'Role updated for the selected account.'); await loadAdmin(); }
}
$('refresh-admin').addEventListener('click', () => void loadAdmin());
$('store-form').addEventListener('submit', async (event) => {
  event.preventDefault(); message('store-message', 'Creating store…');
  const { error } = await needClient().rpc('vmall_admin_create_store', {
    p_slug: $('store-slug').value.trim(), p_name_en: $('store-name').value.trim(), p_name_ar: $('store-name-ar').value.trim() || null,
    p_owner: $('store-owner').value.trim(),
  });
  if (error) message('store-message', error.message, true); else { message('store-message', 'Store created for the selected vendor.'); $('store-form').querySelectorAll('input').forEach((input) => { input.value = ''; }); }
});

if (!url || !key) message('auth-message', 'Management sign-in is unavailable: preview Supabase settings are missing.', true);
else void loadWorkspace().catch((error) => { authCard.classList.remove('hidden'); message('auth-message', error instanceof Error ? error.message : 'Could not load management workspace.', true); });
