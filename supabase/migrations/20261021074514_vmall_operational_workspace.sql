-- Isolated operational APIs; no change to HOCO tables or live checkout grants.
create or replace function public.vmall_operations()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare u uuid:=auth.uid(); r text; result jsonb;
begin
 select role into r from v_mall.profiles where user_id=u;
 if r is null or r not in ('super_admin','vendor') then raise exception 'management_required'; end if;
 select coalesce(jsonb_agg(row_data order by created desc),'[]'::jsonb) into result from (
  select o.created_at created,jsonb_build_object('id',o.id,'created_at',o.created_at,'status',o.status,
   'customer_name',o.customer_name,'phone',o.phone,'address',o.address,
   'total',case when r='super_admin' then o.total else (select sum(i.qty*i.unit_price) from v_mall.order_items i join v_mall.stores s on s.id=i.store_id where i.order_id=o.id and s.owner_id=u) end,
   'items',(select coalesce(jsonb_agg(jsonb_build_object('name',i.product_name,'qty',i.qty,'variant',i.variant,'unit_price',i.unit_price,'store_id',i.store_id)),'[]'::jsonb) from v_mall.order_items i join v_mall.stores s on s.id=i.store_id where i.order_id=o.id and (r='super_admin' or s.owner_id=u))) row_data
  from v_mall.orders o where r='super_admin' or exists(select 1 from v_mall.order_items i join v_mall.stores s on s.id=i.store_id where i.order_id=o.id and s.owner_id=u)
  order by o.created_at desc limit 200
 ) q;
 return jsonb_build_object('orders',result,'stores',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'name_en',s.name_en,'name_ar',s.name_ar,'owner_id',s.owner_id,'active',s.is_active)),'[]'::jsonb) from v_mall.stores s where r='super_admin' or s.owner_id=u),
 'stats',jsonb_build_object('orders',jsonb_array_length(result),'delivered_revenue',(select coalesce(sum((j->>'total')::numeric),0) from jsonb_array_elements(result) j where j->>'status'='delivered'),'checkout_enabled',false));
end $$;

create or replace function public.vmall_set_order_status(p_order uuid,p_status text)
returns void language plpgsql security definer set search_path=pg_catalog
as $$
declare old_status text;
begin
 if not exists(select 1 from v_mall.profiles where user_id=auth.uid() and role='super_admin') then raise exception 'admin_required'; end if;
 select status into old_status from v_mall.orders where id=p_order for update;
 if not found then raise exception 'order_not_found'; end if;
 if p_status=old_status then return; end if;
 if not ((old_status='new' and p_status in ('confirmed','cancelled')) or (old_status='confirmed' and p_status in ('out_for_delivery','cancelled')) or (old_status='out_for_delivery' and p_status in ('delivered','cancelled'))) then raise exception 'invalid_status_transition'; end if;
 -- Restore stock once on cancellation under the same transaction/row lock.
 if p_status='cancelled' then
  update v_mall.products p set stock=p.stock+q.qty from (select product_id,sum(qty)::integer qty from v_mall.order_items where order_id=p_order group by product_id) q where p.id=q.product_id;
 end if;
 update v_mall.orders set status=p_status where id=p_order;
end $$;

create or replace function public.vmall_set_store_active(p_store uuid,p_active boolean)
returns void language plpgsql security definer set search_path=pg_catalog
as $$ begin
 if not exists(select 1 from v_mall.profiles where user_id=auth.uid() and role='super_admin') then raise exception 'admin_required'; end if;
 if p_active is null then raise exception 'invalid_active_state'; end if;
 update v_mall.stores set is_active=p_active where id=p_store;
 if not found then raise exception 'store_not_found'; end if;
end $$;

revoke all on function public.vmall_operations() from public,anon;
revoke all on function public.vmall_set_order_status(uuid,text) from public,anon;
revoke all on function public.vmall_set_store_active(uuid,boolean) from public,anon;
grant execute on function public.vmall_operations() to authenticated;
grant execute on function public.vmall_set_order_status(uuid,text) to authenticated;
grant execute on function public.vmall_set_store_active(uuid,boolean) to authenticated;
