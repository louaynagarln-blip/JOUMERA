export const escapeHTML=(value:unknown):string=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function nextOrderStates(status:string):string[]{
 return ({new:['confirmed','cancelled'],confirmed:['out_for_delivery','cancelled'],out_for_delivery:['delivered','cancelled']} as Record<string,string[]>)[status]??[];
}
