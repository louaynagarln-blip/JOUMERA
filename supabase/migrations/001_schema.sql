-- JOUMERA V-MALL schema. Run in the Supabase SQL editor of a NEW/DEV project first (never production).
-- NOT executed against a real database by the author: review and test in a dev project before use.

create extension if not exists pgcrypto;

create type user_role      as enum ('customer', 'vendor', 'super_admin');
create type product_status as enum ('draft', 'pending', 'approved', 'rejected');
create type order_status   as enum ('new', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled');

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       user_role not null default 'customer',
  full_name  text,
  phone      text,
  created_at timestamptz not null default now()
);

create table public.stores (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name_en         text not null,
  name_ar         text,
  owner_id        uuid references public.profiles(id),
  rental_plan     text,
  rent_expires_at date,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  store_id        uuid not null references public.stores(id),
  name_en         text not null,
  name_ar         text,
  description_en  text,
  description_ar  text,
  wholesale_price numeric(12,2) check (wholesale_price >= 0),
  retail_price    numeric(12,2) check (retail_price >= 0),   -- set by super admin only (trigger below)
  stock           integer not null default 0 check (stock >= 0),
  variants        jsonb not null default '[]',
  model_path      text,
  image_path      text,
  status          product_status not null default 'draft',
  created_at      timestamptz not null default now()
);

create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id),
  customer_name  text not null,
  phone          text not null,
  address        text not null,
  notes          text,
  payment_method text not null default 'cod' check (payment_method = 'cod'),
  status         order_status not null default 'new',
  subtotal       numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  currency       text not null default 'USD',
  created_at     timestamptz not null default now()
);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid not null references public.products(id),
  store_id     uuid not null references public.stores(id),
  product_name text not null,
  variant      text,
  qty          integer not null check (qty > 0),
  unit_price   numeric(12,2) not null
);

-- wholesale snapshot kept apart so customers can never read it
create table public.order_item_costs (
  order_item_id        uuid primary key references public.order_items(id) on delete cascade,
  wholesale_unit_price numeric(12,2)
);

-- ---------- helpers (security definer so policies never recurse) ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.owns_store(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stores where id = sid and owner_id = auth.uid())
$$;

create or replace function public.owns_order(oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where id = oid and user_id = auth.uid())
$$;

create or replace function public.can_view_order(oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.owns_order(oid) or exists (
    select 1 from public.order_items oi join public.stores s on s.id = oi.store_id
    where oi.order_id = oid and s.owner_id = auth.uid())
$$;

-- ---------- new users are always customers ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role) values (new.id, 'customer');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- guards ----------
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'only a super admin can change roles';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- Vendors can never set retail_price or approve their own products.
create or replace function public.guard_product() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.retail_price := null;
    if new.status not in ('draft', 'pending') then new.status := 'pending'; end if;
  else
    new.retail_price := old.retail_price;
    if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
      raise exception 'only a super admin can approve or reject products';
    end if;
    -- any vendor edit other than stock/status sends an approved product back to review
    if (to_jsonb(new) - 'stock' - 'status') is distinct from (to_jsonb(old) - 'stock' - 'status') then
      new.status := 'pending';
    end if;
  end if;
  return new;
end $$;
create trigger products_guard before insert or update on public.products
  for each row execute function public.guard_product();

-- ---------- row level security ----------
alter table public.profiles         enable row level security;
alter table public.stores           enable row level security;
alter table public.products         enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.order_item_costs enable row level security;

create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy stores_select on public.stores for select using (is_active or owner_id = auth.uid() or public.is_admin());
create policy stores_admin  on public.stores for all    using (public.is_admin()) with check (public.is_admin());

create policy products_select on public.products for select using (public.is_admin() or public.owns_store(store_id));
create policy products_insert on public.products for insert with check (public.is_admin() or public.owns_store(store_id));
create policy products_update on public.products for update using (public.is_admin() or public.owns_store(store_id)) with check (public.is_admin() or public.owns_store(store_id));
create policy products_delete on public.products for delete using (public.is_admin() or (public.owns_store(store_id) and status <> 'approved'));

-- No insert policy on orders/order_items: orders are created only through place_order().
create policy orders_select      on public.orders      for select using (public.can_view_order(id));
create policy orders_admin_write on public.orders      for update using (public.is_admin()) with check (public.is_admin());
create policy items_select       on public.order_items for select using (public.is_admin() or public.owns_store(store_id) or public.owns_order(order_id));
create policy costs_select       on public.order_item_costs for select using (
  public.is_admin() or exists (select 1 from public.order_items oi where oi.id = order_item_id and public.owns_store(oi.store_id)));

-- ---------- public catalogue: no wholesale price, approved + priced items only ----------
-- The view runs with its owner's rights, so it bypasses RLS on purpose and only exposes these columns.
create view public.catalog as
  select p.slug, s.slug as store_slug, p.name_en, p.name_ar, p.description_en, p.description_ar,
         p.retail_price, (p.stock > 0) as in_stock, p.variants, p.model_path, p.image_path
  from public.products p join public.stores s on s.id = p.store_id
  where p.status = 'approved' and p.retail_price is not null and s.is_active;
grant select on public.catalog to anon, authenticated;

-- ---------- server-side checkout (cash on delivery). Client totals are never trusted. ----------
create or replace function public.place_order(
  p_items jsonb, p_name text, p_phone text, p_address text, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order uuid; v_item jsonb; v_prod public.products%rowtype; v_qty int; v_sub numeric := 0; v_item_id uuid;
begin
  if coalesce(length(trim(p_name)), 0) < 2 or coalesce(length(trim(p_phone)), 0) < 6 or coalesce(length(trim(p_address)), 0) < 5 then
    raise exception 'invalid customer details';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid items';
  end if;

  insert into public.orders (user_id, customer_name, phone, address, notes)
  values (auth.uid(), trim(p_name), trim(p_phone), trim(p_address), left(p_notes, 500))
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'invalid quantity'; end if;

    select p.* into v_prod
    from public.products p join public.stores s on s.id = p.store_id
    where p.slug = v_item ->> 'slug' and p.status = 'approved' and p.retail_price is not null and s.is_active
    for update of p;
    if not found then raise exception 'product unavailable: %', v_item ->> 'slug'; end if;
    if v_prod.stock < v_qty then raise exception 'insufficient stock: %', v_prod.slug; end if;

    update public.products set stock = stock - v_qty where id = v_prod.id;
    insert into public.order_items (order_id, product_id, store_id, product_name, variant, qty, unit_price)
    values (v_order, v_prod.id, v_prod.store_id, v_prod.name_en, left(v_item ->> 'variant', 60), v_qty, v_prod.retail_price)
    returning id into v_item_id;
    insert into public.order_item_costs values (v_item_id, v_prod.wholesale_price);
    v_sub := v_sub + v_prod.retail_price * v_qty;
  end loop;

  update public.orders set subtotal = v_sub, total = v_sub where id = v_order;
  return v_order;
end $$;
revoke all on function public.place_order(jsonb, text, text, text, text) from public;
grant execute on function public.place_order(jsonb, text, text, text, text) to anon, authenticated;

-- ---------- storage buckets: vendors write only under <their store uuid>/ ----------
insert into storage.buckets (id, name, public) values ('product-models', 'product-models', true), ('product-images', 'product-images', true)
  on conflict (id) do nothing;
create policy "public read product assets" on storage.objects for select using (bucket_id in ('product-models', 'product-images'));
create policy "vendor write own store folder" on storage.objects for insert with check (
  bucket_id in ('product-models', 'product-images') and (public.is_admin() or public.owns_store(((storage.foldername(name))[1])::uuid)));
create policy "vendor update own store folder" on storage.objects for update using (
  bucket_id in ('product-models', 'product-images') and (public.is_admin() or public.owns_store(((storage.foldername(name))[1])::uuid)));
create policy "vendor delete own store folder" on storage.objects for delete using (
  bucket_id in ('product-models', 'product-images') and (public.is_admin() or public.owns_store(((storage.foldername(name))[1])::uuid)));

-- First super admin: sign up normally, then run in the SQL editor (service role):
--   update public.profiles set role = 'super_admin' where id = '<your auth.users id>';
