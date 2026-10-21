-- Role-checked management API. Private tables remain inaccessible to browser roles.
create or replace function public.vmall_my_profile()
returns table(role text, store_id uuid, store_name text)
language plpgsql security definer set search_path = pg_catalog
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  insert into v_mall.profiles(user_id) values (v_user) on conflict (user_id) do nothing;
  return query
    select p.role, s.id, s.name_en
    from v_mall.profiles p left join v_mall.stores s on s.owner_id = p.user_id and s.is_active
    where p.user_id = v_user;
end;
$$;

create or replace function public.vmall_vendor_products()
returns table(id uuid, slug text, name_en text, name_ar text, description_en text,
  description_ar text, wholesale_price numeric, retail_price numeric, stock integer,
  variants jsonb, model_path text, image_path text, status text)
language plpgsql stable security definer set search_path = pg_catalog
as $$
declare v_user uuid := auth.uid(); v_store uuid;
begin
  select s.id into v_store from v_mall.profiles p join v_mall.stores s on s.owner_id = p.user_id
  where p.user_id = v_user and p.role = 'vendor' and s.is_active;
  if v_store is null then raise exception 'vendor_store_not_found'; end if;
  return query select p.id,p.slug,p.name_en,p.name_ar,p.description_en,p.description_ar,
    p.wholesale_price,p.retail_price,p.stock,p.variants,p.model_path,p.image_path,p.status
    from v_mall.products p where p.store_id = v_store order by p.created_at desc;
end;
$$;

create or replace function public.vmall_vendor_save_product(
  p_id uuid, p_slug text, p_name_en text, p_name_ar text, p_description_en text,
  p_description_ar text, p_wholesale_price numeric, p_stock integer,
  p_variants jsonb default '[]'::jsonb, p_model_path text default null, p_image_path text default null
) returns uuid
language plpgsql security definer set search_path = pg_catalog
as $$
declare v_user uuid := auth.uid(); v_store uuid; v_id uuid;
begin
  select s.id into v_store from v_mall.profiles p join v_mall.stores s on s.owner_id = p.user_id
  where p.user_id = v_user and p.role = 'vendor' and s.is_active;
  if v_store is null then raise exception 'vendor_store_not_found'; end if;
  if length(trim(coalesce(p_slug,''))) not between 3 and 80
     or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or length(trim(coalesce(p_name_en,''))) not between 2 and 160
     or coalesce(p_stock,-1) < 0 or p_stock > 100000
     or coalesce(p_wholesale_price,-1) < 0
     or jsonb_typeof(coalesce(p_variants,'[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_variants,'[]'::jsonb)) > 100 then
    raise exception 'invalid_product';
  end if;
  if p_id is null then
    insert into v_mall.products(store_id,slug,name_en,name_ar,description_en,description_ar,
      wholesale_price,stock,variants,model_path,image_path,status)
    values(v_store,trim(p_slug),trim(p_name_en),nullif(trim(p_name_ar),''),left(p_description_en,4000),
      left(p_description_ar,4000),p_wholesale_price,p_stock,coalesce(p_variants,'[]'::jsonb),
      nullif(left(p_model_path,500),''),nullif(left(p_image_path,500),''),'pending') returning id into v_id;
  else
    update v_mall.products set slug=trim(p_slug),name_en=trim(p_name_en),name_ar=nullif(trim(p_name_ar),''),
      description_en=left(p_description_en,4000),description_ar=left(p_description_ar,4000),
      wholesale_price=p_wholesale_price,stock=p_stock,variants=coalesce(p_variants,'[]'::jsonb),
      model_path=nullif(left(p_model_path,500),''),image_path=nullif(left(p_image_path,500),''),status='pending'
    where id=p_id and store_id=v_store returning id into v_id;
    if v_id is null then raise exception 'product_not_owned'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.vmall_admin_products()
returns table(id uuid, store_id uuid, store_name text, slug text, name_en text, name_ar text,
  wholesale_price numeric, retail_price numeric, stock integer, status text, image_path text)
language plpgsql stable security definer set search_path = pg_catalog
as $$
begin
  if not exists(select 1 from v_mall.profiles where user_id=auth.uid() and role='super_admin') then
    raise exception 'admin_required';
  end if;
  return query select p.id,s.id,s.name_en,p.slug,p.name_en,p.name_ar,p.wholesale_price,
    p.retail_price,p.stock,p.status,p.image_path from v_mall.products p join v_mall.stores s on s.id=p.store_id
    order by p.created_at desc;
end;
$$;

create or replace function public.vmall_admin_review_product(p_id uuid,p_approve boolean,p_retail_price numeric default null)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if not exists(select 1 from v_mall.profiles where user_id=auth.uid() and role='super_admin') then
    raise exception 'admin_required';
  end if;
  if p_approve and (p_retail_price is null or p_retail_price < 0) then raise exception 'valid_retail_price_required'; end if;
  update v_mall.products set status=case when p_approve then 'approved' else 'rejected' end,
    retail_price=case when p_approve then p_retail_price else retail_price end
  where id=p_id;
  if not found then raise exception 'product_not_found'; end if;
end;
$$;

create or replace function public.vmall_admin_create_store(p_slug text,p_name_en text,p_name_ar text,p_owner uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare v_id uuid;
begin
  if not exists(select 1 from v_mall.profiles where user_id=auth.uid() and role='super_admin') then
    raise exception 'admin_required';
  end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(trim(coalesce(p_name_en,''))) not between 2 and 100
     or not exists(select 1 from v_mall.profiles where user_id=p_owner and role='vendor') then
    raise exception 'invalid_store_or_vendor';
  end if;
  insert into v_mall.stores(slug,name_en,name_ar,owner_id,is_active)
    values(trim(p_slug),trim(p_name_en),nullif(trim(p_name_ar),''),p_owner,true) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.vmall_admin_users()
returns table(user_id uuid,email text,role text)
language plpgsql stable security definer set search_path = pg_catalog
as $$
begin
  if not exists(select 1 from v_mall.profiles where user_id=auth.uid() and role='super_admin') then
    raise exception 'admin_required';
  end if;
  return query select u.id,u.email,coalesce(p.role,'customer')
    from auth.users u left join v_mall.profiles p on p.user_id=u.id
    order by u.created_at desc limit 200;
end;
$$;

create or replace function public.vmall_admin_set_user_role(p_user uuid,p_role text)
returns void language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if not exists(select 1 from v_mall.profiles where user_id=auth.uid() and role='super_admin') then
    raise exception 'admin_required';
  end if;
  if p_role not in ('customer','vendor','super_admin') or p_user=auth.uid() then
    raise exception 'invalid_role_change';
  end if;
  if not exists(select 1 from auth.users where id=p_user) then raise exception 'user_not_found'; end if;
  insert into v_mall.profiles(user_id,role) values(p_user,p_role)
    on conflict(user_id) do update set role=excluded.role;
end;
$$;

revoke all on function public.vmall_my_profile() from public, anon;
revoke all on function public.vmall_vendor_products() from public, anon;
revoke all on function public.vmall_vendor_save_product(uuid,text,text,text,text,text,numeric,integer,jsonb,text,text) from public, anon;
revoke all on function public.vmall_admin_products() from public, anon;
revoke all on function public.vmall_admin_review_product(uuid,boolean,numeric) from public, anon;
revoke all on function public.vmall_admin_create_store(text,text,text,uuid) from public, anon;
revoke all on function public.vmall_admin_users() from public, anon;
revoke all on function public.vmall_admin_set_user_role(uuid,text) from public, anon;
grant execute on function public.vmall_my_profile() to authenticated;
grant execute on function public.vmall_vendor_products() to authenticated;
grant execute on function public.vmall_vendor_save_product(uuid,text,text,text,text,text,numeric,integer,jsonb,text,text) to authenticated;
grant execute on function public.vmall_admin_products() to authenticated;
grant execute on function public.vmall_admin_review_product(uuid,boolean,numeric) to authenticated;
grant execute on function public.vmall_admin_create_store(text,text,text,uuid) to authenticated;
grant execute on function public.vmall_admin_users() to authenticated;
grant execute on function public.vmall_admin_set_user_role(uuid,text) to authenticated;
