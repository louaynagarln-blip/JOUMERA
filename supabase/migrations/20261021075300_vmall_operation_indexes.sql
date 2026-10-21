create index if not exists vmall_order_items_order_idx on v_mall.order_items(order_id);
create index if not exists vmall_order_items_product_idx on v_mall.order_items(product_id);
create index if not exists vmall_orders_user_idx on v_mall.orders(user_id);
create index if not exists vmall_stores_owner_idx on v_mall.stores(owner_id);
create index if not exists vmall_orders_created_idx on v_mall.orders(created_at desc);
