-- Atomic receiving and close-of-day controls.
create or replace function public.aqan_receive_stock(p_product_id uuid, p_quantity integer, p_batch_number text default null, p_expiry_date date default null, p_cost_per_unit numeric default 0, p_supplier_id uuid default null, p_warehouse_id uuid default null, p_supplier_invoice_number text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_grn uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  select organization_id into v_org from public.aqan_products where id=p_product_id for update;
  if v_org is null or not private.aqan_has_role(v_org,array['owner','admin','sales','service']) then raise exception 'Not permitted'; end if;
  if p_supplier_id is not null and not exists(select 1 from public.aqan_suppliers where id=p_supplier_id and organization_id=v_org) then raise exception 'Supplier does not belong to this workspace'; end if;
  if p_warehouse_id is not null and not exists(select 1 from public.aqan_warehouses where id=p_warehouse_id and organization_id=v_org) then raise exception 'Warehouse does not belong to this workspace'; end if;
  insert into public.aqan_goods_receipts(organization_id,supplier_id,warehouse_id,supplier_invoice_number,received_by,notes) values(v_org,p_supplier_id,p_warehouse_id,nullif(trim(p_supplier_invoice_number),''),(select auth.uid()),nullif(trim(p_notes),'')) returning id into v_grn;
  insert into public.aqan_stock_batches(organization_id,product_id,warehouse_id,batch_number,expiry_date,quantity_on_hand,cost_per_unit) values(v_org,p_product_id,p_warehouse_id,nullif(trim(p_batch_number),''),p_expiry_date,p_quantity,coalesce(p_cost_per_unit,0));
  update public.aqan_products set stock=stock+p_quantity, cost=case when p_cost_per_unit > 0 then p_cost_per_unit else cost end where id=p_product_id;
  return v_grn;
end; $$;
revoke all on function public.aqan_receive_stock(uuid,integer,text,date,numeric,uuid,uuid,text,text) from public,anon;
grant execute on function public.aqan_receive_stock(uuid,integer,text,date,numeric,uuid,uuid,text,text) to authenticated;

create or replace function public.aqan_close_cash_session(p_session_id uuid, p_counted_cash numeric, p_notes text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_expected numeric;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select organization_id, opening_float + coalesce((select sum(p.amount) from public.aqan_payments p join public.aqan_sales s on s.id=p.sale_id where s.organization_id=aqan_cash_sessions.organization_id and p.method='cash' and p.received_at >= aqan_cash_sessions.opened_at),0) into v_org,v_expected from public.aqan_cash_sessions where id=p_session_id and status='open' for update;
  if v_org is null or not private.aqan_has_role(v_org,array['owner','admin','sales']) then raise exception 'Not permitted'; end if;
  update public.aqan_cash_sessions set expected_cash=v_expected,counted_cash=p_counted_cash,variance=p_counted_cash-v_expected,status=case when abs(p_counted_cash-v_expected)>0.01 then 'review' else 'closed' end,closed_by=(select auth.uid()),closed_at=now(),notes=coalesce(nullif(trim(p_notes),''),notes) where id=p_session_id;
end; $$;
revoke all on function public.aqan_close_cash_session(uuid,numeric,text) from public,anon;
grant execute on function public.aqan_close_cash_session(uuid,numeric,text) to authenticated;
