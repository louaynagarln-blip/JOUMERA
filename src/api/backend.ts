import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/** True only when both Supabase env vars are present. Otherwise the app runs in demo mode. */
export const isLive = Boolean(url && key);
const sb: SupabaseClient | null = isLive ? createClient(url!, key!) : null;

export interface CatalogRow { slug: string; store_slug: string; name_en: string; name_ar: string | null; retail_price: number; in_stock: boolean; description_en?: string | null; description_ar?: string | null; variants?: import('../data/catalog').Variant[]; model_path?: string | null; image_path?: string | null }
export interface CustomerInfo { name: string; phone: string; address: string; notes: string }

export async function fetchLiveCatalog(): Promise<CatalogRow[]> {
  if (!sb) return [];
  const { data, error } = await sb.rpc('vmall_catalog');
  if (error) throw error;
  return (data ?? []) as CatalogRow[];
}

/** Sends only slug/variant/qty. The server looks up prices and computes the total. */
export async function placeOrder(items: Array<{ slug: string; variant: string; qty: number }>, c: CustomerInfo): Promise<string> {
  if (!sb) throw new Error('demo-mode');
  const { data, error } = await sb.rpc('vmall_place_order', {
    p_items: items, p_name: c.name, p_phone: c.phone, p_address: c.address, p_notes: c.notes,
  });
  if (error) throw error;
  return String(data);
}
