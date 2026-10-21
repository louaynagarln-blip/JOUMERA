-- V-Mall data is isolated from the existing HOCO storefront tables.
-- This additive migration creates no products and keeps checkout disabled.

create schema if not exists v_mall;
revoke all on schema v_mall from public, anon, authenticated;

create table v_mall.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'vendor', 'super_admin')),
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table v_mall.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_ar text,
  owner_id uuid references v_mall.profiles(user_id),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table v_mall.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  store_id uuid not null references v_mall.stores(id) on delete cascade,
  name_en text not null,
  name_ar text,
  description_en text,
  description_ar text,
  wholesale_price numeric(12,2) check (wholesale_price is null or wholesale_price >= 0),
  retail_price numeric(12,2) check (retail_price is null or retail_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  model_path text,
  image_path text,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index products_store_status_idx on v_mall.products (store_id, status);

create table v_mall.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  phone text not null,
  address text not null,
  notes text,
  payment_method text not null default 'cod' check (payment_method = 'cod'),
  status text not null default 'new' check (status in ('new', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  created_at timestamptz not null default now()
);

create table v_mall.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references v_mall.orders(id) on delete cascade,
  product_id uuid not null references v_mall.products(id),
  store_id uuid not null references v_mall.stores(id),
  product_name text not null,
  variant text,
  qty integer not null check (qty between 1 and 20),
  unit_price numeric(12,2) not null check (unit_price >= 0)
);
create index order_items_store_idx on v_mall.order_items (store_id, order_id);

create table v_mall.settings (
  id boolean primary key default true check (id),
  checkout_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into v_mall.settings (id, checkout_enabled) values (true, false)
on conflict (id) do nothing;

alter table v_mall.profiles enable row level security;
alter table v_mall.stores enable row level security;
alter table v_mall.products enable row level security;
alter table v_mall.orders enable row level security;
alter table v_mall.order_items enable row level security;
alter table v_mall.settings enable row level security;
revoke all on all tables in schema v_mall from public, anon, authenticated;

create or replace function public.vmall_catalog()
returns table (
  slug text, store_slug text, name_en text, name_ar text,
  description_en text, description_ar text, retail_price numeric,
  in_stock boolean, variants jsonb, model_path text, image_path text
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select p.slug, s.slug, p.name_en, p.name_ar,
         p.description_en, p.description_ar, p.retail_price,
         (p.stock > 0), p.variants, p.model_path, p.image_path
  from v_mall.products p
  join v_mall.stores s on s.id = p.store_id
  where p.status = 'approved'
    and p.retail_price is not null
    and s.is_active
  order by s.slug, p.name_en;
$$;
revoke all on function public.vmall_catalog() from public;
grant execute on function public.vmall_catalog() to anon, authenticated;

create or replace function public.vmall_place_order(
  p_items jsonb, p_name text, p_phone text, p_address text, p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_order uuid;
  v_item jsonb;
  v_product v_mall.products%rowtype;
  v_qty integer;
  v_subtotal numeric(12,2) := 0;
  v_item_id uuid;
begin
  if not coalesce((select checkout_enabled from v_mall.settings where id), false) then
    raise exception 'checkout_disabled';
  end if;
  if coalesce(length(trim(p_name)), 0) < 2
     or coalesce(length(trim(p_phone)), 0) < 6
     or coalesce(length(trim(p_address)), 0) < 5 then
    raise exception 'invalid_customer_details';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_items';
  end if;

  insert into v_mall.orders (user_id, customer_name, phone, address, notes)
  values (auth.uid(), trim(p_name), trim(p_phone), trim(p_address), left(p_notes, 500))
  returning id into v_order;

  for v_item in select value from jsonb_array_elements(p_items) as items(value) loop
    if coalesce(v_item ->> 'slug', '') = '' then raise exception 'invalid_product'; end if;
    v_qty := (v_item ->> 'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'invalid_quantity'; end if;

    select p.* into v_product
    from v_mall.products p
    join v_mall.stores s on s.id = p.store_id
    where p.slug = v_item ->> 'slug'
      and p.status = 'approved'
      and p.retail_price is not null
      and s.is_active
    for update of p;
    if not found then raise exception 'product_unavailable'; end if;
    if v_product.stock < v_qty then raise exception 'insufficient_stock'; end if;

    update v_mall.products set stock = stock - v_qty where id = v_product.id;
    insert into v_mall.order_items (order_id, product_id, store_id, product_name, variant, qty, unit_price)
    values (v_order, v_product.id, v_product.store_id, v_product.name_en,
            left(v_item ->> 'variant', 60), v_qty, v_product.retail_price)
    returning id into v_item_id;
    v_subtotal := v_subtotal + v_product.retail_price * v_qty;
  end loop;

  update v_mall.orders set subtotal = v_subtotal, total = v_subtotal where id = v_order;
  return v_order;
end;
$$;
-- Public access is intentionally withheld until verified vendor catalogue, prices,
-- delivery charges and abuse controls are in place.
revoke all on function public.vmall_place_order(jsonb, text, text, text, text) from public, anon, authenticated;
