import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeHTML, nextOrderStates } from './operations';

interface Order { id:string;created_at:string;status:string;customer_name:string;phone:string;address:string;total:number;items:Array<{name:string;qty:number;variant:string;unit_price:number}> }
interface Store {id:string;slug:string;name_en:string;active:boolean}
interface Operations {orders:Order[];stores:Store[];stats:{orders:number;delivered_revenue:number;checkout_enabled:boolean}}
const esc=escapeHTML;
const labels:Record<string,string>={new:'New / جديد',confirmed:'Confirmed / مؤكّد',out_for_delivery:'Out for delivery / قيد التوصيل',delivered:'Delivered / تم التسليم',cancelled:'Cancelled / ملغي'};

/** Every mutation is checked again by the server; vendor pages never offer admin actions. */
export async function renderOperations(sb:SupabaseClient,host:HTMLElement,role:string):Promise<void>{
 host.innerHTML='<p role="status">Loading operations…</p>';
 const {data,error}=await sb.rpc('vmall_operations');
 if(error){host.textContent=error.message;return;}
 const op=data as Operations; const admin=role==='super_admin';
 host.innerHTML=`<div class="section-head"><div><p class="eyebrow">OPERATIONS</p><h2>Orders & stores / الطلبات والمحلات</h2></div><button class="admin-button" data-refresh>Refresh</button></div>
 <div class="metrics"><article><small>Orders shown / الطلبات</small><strong>${op.stats.orders}</strong></article><article><small>Delivered sales / مبيعات مسلّمة</small><strong>$${Number(op.stats.delivered_revenue).toFixed(2)}</strong></article><article><small>Live checkout / الطلب الحقيقي</small><strong>Disabled / معطّل</strong></article></div>
 <div class="admin-card"><h3>${admin?'Stores / المحلات':'Your stores / محلاتك'}</h3>${op.stores.length?op.stores.map(s=>`<article class="product-row"><div><b>${esc(s.name_en)}</b><small>${esc(s.slug)} · ${s.active?'Active / فعّال':'Paused / متوقف'}</small></div>${admin?`<button class="admin-button" data-store="${esc(s.id)}" data-active="${!s.active}">${s.active?'Pause':'Activate'}</button>`:''}</article>`).join(''):'<p>No stores yet / لا توجد محلات مسجلة بعد</p>'}</div>
 <div class="admin-card"><h3>${admin?'Customer orders / طلبات الزبائن':'Assigned orders / الطلبات المخصصة لك'}</h3><input type="search" data-order-search aria-label="Search orders" placeholder="Search order, customer or phone / بحث" />
 <p class="hint">Latest 200 orders / آخر 200 طلب. Delivered sales refer to this list.</p><div class="orders-list">${op.orders.length?op.orders.map(o=>`<article class="order-card" data-order-card data-search="${esc(`${o.id} ${o.customer_name} ${o.phone}`.toLowerCase())}"><header><b>#${esc(o.id.slice(0,8))}</b><span>${esc(labels[o.status]||o.status)}</span><strong>$${Number(o.total).toFixed(2)}</strong></header><p>${esc(o.customer_name)} · ${esc(o.phone)}</p><p>${esc(o.address)}</p><small>${esc(new Date(o.created_at).toLocaleString())}</small><ul>${o.items.map(i=>`<li>${esc(i.name)} ${esc(i.variant||'')} × ${i.qty} — $${(i.qty*Number(i.unit_price)).toFixed(2)}</li>`).join('')}</ul>${admin&&nextOrderStates(o.status).length?`<div class="actions">${nextOrderStates(o.status).map(s=>`<button class="admin-button" data-order="${esc(o.id)}" data-status="${s}">${labels[s]}</button>`).join('')}</div>`:''}</article>`).join(''):'<p>No orders yet / لا توجد طلبات بعد</p>'}</div></div><p class="notice" role="status" data-op-message></p>`;
 const message=host.querySelector<HTMLElement>('[data-op-message]')!;
 host.querySelector<HTMLInputElement>('[data-order-search]')?.addEventListener('input',event=>{
  const q=(event.target as HTMLInputElement).value.toLowerCase().trim();
  host.querySelectorAll<HTMLElement>('[data-order-card]').forEach(card=>{card.hidden=!card.dataset.search?.includes(q);});
 });
 host.querySelector('[data-refresh]')?.addEventListener('click',()=>void renderOperations(sb,host,role));
 host.querySelectorAll<HTMLButtonElement>('[data-order],[data-store]').forEach(button=>button.addEventListener('click',async()=>{
  button.disabled=true; message.textContent='Saving…';
  const result=button.dataset.order?await sb.rpc('vmall_set_order_status',{p_order:button.dataset.order,p_status:button.dataset.status}):await sb.rpc('vmall_set_store_active',{p_store:button.dataset.store,p_active:button.dataset.active==='true'});
  if(result.error){message.textContent=result.error.message;button.disabled=false;return;}
  await renderOperations(sb,host,role);
 }));
}
