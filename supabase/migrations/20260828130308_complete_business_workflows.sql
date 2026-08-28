-- AQAN operational completeness: additive business workflows.
-- Existing identifiers/data are preserved. New objects are organization-scoped and RLS protected.

create sequence if not exists public.aqan_purchase_number_seq start 1001;
create sequence if not exists public.aqan_proforma_number_seq start 501;
create sequence if not exists public.aqan_return_number_seq start 201;
create sequence if not exists public.aqan_expense_number_seq start 101;

alter table public.aqan_memberships drop constraint if exists aqan_memberships_role_check;
alter table public.aqan_memberships add constraint aqan_memberships_role_check
  check (role in ('owner','admin','manager','cashier','sales','salesperson','inventory','service','accountant','viewer'));

alter table public.aqan_products
  add column if not exists barcode text,
  add column if not exists product_type text not null default 'product' check (product_type in ('product','service')),
  add column if not exists unit_of_measure text not null default 'piece',
  add column if not exists purchase_unit text,
  add column if not exists units_per_purchase numeric(14,3) not null default 1 check (units_per_purchase > 0),
  add column if not exists wholesale_price numeric(14,2),
  add column if not exists distributor_price numeric(14,2),
  add column if not exists custom_price numeric(14,2),
  add column if not exists minimum_selling_price numeric(14,2),
  add column if not exists tax_code text not null default 'vat18' check (tax_code in ('vat18','exempt','zero','custom')),
  add column if not exists tax_rate numeric(7,4) not null default 0.18 check (tax_rate between 0 and 1),
  add column if not exists tax_inclusive boolean not null default false,
  add column if not exists discount_eligible boolean not null default true,
  add column if not exists track_inventory boolean not null default true,
  add column if not exists allow_negative_stock boolean not null default false,
  add column if not exists reorder_quantity numeric(14,3),
  add column if not exists preferred_supplier_id uuid references public.aqan_suppliers(id) on delete set null,
  add column if not exists costing_method text not null default 'moving_average' check (costing_method in ('moving_average','last_purchase','manual')),
  add column if not exists average_cost numeric(14,2) not null default 0,
  add column if not exists updated_cost_at timestamptz;

update public.aqan_products set average_cost = cost where average_cost = 0 and cost > 0;
create unique index if not exists aqan_products_org_barcode_key on public.aqan_products(organization_id, barcode) where barcode is not null and barcode <> '';

alter table public.aqan_customers
  add column if not exists whatsapp text,
  add column if not exists billing_address text,
  add column if not exists delivery_address text,
  add column if not exists region text,
  add column if not exists country text not null default 'Tanzania',
  add column if not exists customer_category text,
  add column if not exists payment_terms text,
  add column if not exists credit_limit numeric(14,2) not null default 0,
  add column if not exists assigned_salesperson uuid references auth.users(id) on delete set null;

alter table public.aqan_suppliers
  add column if not exists whatsapp text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists outstanding_balance numeric(14,2) not null default 0,
  add column if not exists notes text;

alter table public.aqan_stock_batches
  add column if not exists supplier_id uuid references public.aqan_suppliers(id) on delete set null,
  add column if not exists goods_receipt_id uuid references public.aqan_goods_receipts(id) on delete set null,
  add column if not exists received_quantity numeric(14,3) not null default 0,
  add column if not exists manufacturing_date date,
  add column if not exists received_date date not null default current_date,
  add column if not exists status text not null default 'healthy' check (status in ('healthy','expiring','expired','depleted','written_off'));

update public.aqan_stock_batches set received_quantity = quantity_on_hand where received_quantity = 0 and quantity_on_hand > 0;

alter table public.aqan_goods_receipts
  add column if not exists purchase_number text,
  add column if not exists purchase_date date not null default current_date,
  add column if not exists due_date date,
  add column if not exists status text not null default 'received' check (status in ('draft','received','partially_paid','paid','void')),
  add column if not exists payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partially_paid','paid')),
  add column if not exists payment_method text,
  add column if not exists subtotal numeric(14,2) not null default 0,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists shipping_amount numeric(14,2) not null default 0,
  add column if not exists additional_costs numeric(14,2) not null default 0,
  add column if not exists total numeric(14,2) not null default 0,
  add column if not exists amount_paid numeric(14,2) not null default 0,
  add column if not exists balance_due numeric(14,2) not null default 0,
  add column if not exists due_updated_at timestamptz;

update public.aqan_goods_receipts
set purchase_number = 'AQN-PUR-' || to_char(received_at,'YYYYMM') || '-' || substr(id::text,1,6)
where purchase_number is null;
create unique index if not exists aqan_goods_receipts_purchase_number_key on public.aqan_goods_receipts(purchase_number);

create table if not exists public.aqan_goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  goods_receipt_id uuid not null references public.aqan_goods_receipts(id) on delete cascade,
  product_id uuid not null references public.aqan_products(id) on delete restrict,
  stock_batch_id uuid references public.aqan_stock_batches(id) on delete set null,
  quantity numeric(14,3) not null check (quantity > 0),
  purchase_unit text not null default 'piece',
  units_per_purchase numeric(14,3) not null default 1 check (units_per_purchase > 0),
  selling_units_received numeric(14,3) not null check (selling_units_received > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  discount_amount numeric(14,2) not null default 0,
  tax_rate numeric(7,4) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  batch_number text,
  manufacturing_date date,
  expiry_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.aqan_stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  product_id uuid not null references public.aqan_products(id) on delete restrict,
  batch_id uuid references public.aqan_stock_batches(id) on delete set null,
  warehouse_id uuid references public.aqan_warehouses(id) on delete set null,
  movement_type text not null check (movement_type in ('opening_balance','purchase','sale','customer_return','supplier_return','damaged','expired','lost','stock_count','internal_use','transfer','manual_adjustment','found_stock')),
  quantity_change numeric(14,3) not null check (quantity_change <> 0),
  unit_cost numeric(14,2),
  reference_type text,
  reference_id uuid,
  reference_number text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.aqan_sales
  add column if not exists document_type text not null default 'invoice' check (document_type in ('invoice','receipt')),
  add column if not exists due_date date,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists shipping_amount numeric(14,2) not null default 0,
  add column if not exists amount_paid numeric(14,2) not null default 0,
  add column if not exists balance_due numeric(14,2) not null default 0,
  add column if not exists salesperson_id uuid references auth.users(id) on delete set null,
  add column if not exists quotation_id uuid references public.aqan_quotations(id) on delete set null,
  add column if not exists price_level text not null default 'retail',
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists voided_at timestamptz;

update public.aqan_sales s set amount_paid = coalesce((select sum(p.amount) from public.aqan_payments p where p.sale_id=s.id and p.status='completed'),0);
update public.aqan_sales set balance_due = greatest(total-amount_paid,0), status = case when status='void' then status when amount_paid >= total then 'paid' when amount_paid > 0 then 'pending' else 'pending' end;

alter table public.aqan_sale_items
  add column if not exists batch_id uuid references public.aqan_stock_batches(id) on delete set null,
  add column if not exists unit text not null default 'piece',
  add column if not exists price_level text not null default 'retail',
  add column if not exists cost_price numeric(14,2) not null default 0,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists tax_rate numeric(7,4) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists returned_quantity numeric(14,3) not null default 0;

alter table public.aqan_payments drop constraint if exists aqan_payments_method_check;
alter table public.aqan_payments add constraint aqan_payments_method_check check (method in ('cash','card','mobile_money','bank_transfer','credit','other'));
alter table public.aqan_payments add column if not exists notes text;

alter table public.aqan_quotations drop constraint if exists aqan_quotations_status_check;
alter table public.aqan_quotations add constraint aqan_quotations_status_check check (status in ('draft','sent','viewed','accepted','rejected','declined','expired','converted'));
alter table public.aqan_quotations add column if not exists salesperson_id uuid references auth.users(id) on delete set null;
alter table public.aqan_quotations add column if not exists converted_sale_id uuid references public.aqan_sales(id) on delete set null;

create table if not exists public.aqan_proformas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  proforma_number text not null unique default ('AQN-PF-' || lpad(nextval('public.aqan_proforma_number_seq')::text,5,'0')),
  customer_id uuid not null references public.aqan_customers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired','converted')),
  issue_date date not null default current_date,
  valid_until date not null default (current_date + 14),
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  terms text,
  converted_sale_id uuid references public.aqan_sales(id) on delete set null,
  salesperson_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aqan_proforma_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  proforma_id uuid not null references public.aqan_proformas(id) on delete cascade, product_id uuid references public.aqan_products(id) on delete set null,
  description text not null, quantity numeric(14,3) not null check(quantity>0), unit text not null default 'piece', unit_price numeric(14,2) not null,
  discount_amount numeric(14,2) not null default 0, tax_rate numeric(7,4) not null default 0, tax_amount numeric(14,2) not null default 0, line_total numeric(14,2) not null
);

create table if not exists public.aqan_customer_payments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  customer_id uuid not null references public.aqan_customers(id) on delete restrict, amount numeric(14,2) not null check(amount>0), method text not null,
  reference text, notes text, received_by uuid references auth.users(id) on delete set null, received_at timestamptz not null default now(), reversed_at timestamptz, reversed_by uuid references auth.users(id) on delete set null
);
create table if not exists public.aqan_customer_payment_allocations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  customer_payment_id uuid not null references public.aqan_customer_payments(id) on delete cascade, sale_id uuid not null references public.aqan_sales(id) on delete restrict,
  amount numeric(14,2) not null check(amount>0), created_at timestamptz not null default now(), unique(customer_payment_id,sale_id)
);

create table if not exists public.aqan_supplier_payments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  supplier_id uuid not null references public.aqan_suppliers(id) on delete restrict, goods_receipt_id uuid references public.aqan_goods_receipts(id) on delete set null,
  amount numeric(14,2) not null check(amount>0), method text not null, reference text, notes text,
  paid_by uuid references auth.users(id) on delete set null, paid_at timestamptz not null default now(), reversed_at timestamptz
);

create table if not exists public.aqan_returns (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  return_number text not null unique default ('AQN-CR-' || lpad(nextval('public.aqan_return_number_seq')::text,5,'0')),
  sale_id uuid not null references public.aqan_sales(id) on delete restrict, customer_id uuid references public.aqan_customers(id) on delete set null,
  action text not null check(action in ('refund','customer_credit','replace','no_refund')), refund_method text, total numeric(14,2) not null default 0,
  notes text, status text not null default 'completed' check(status in ('draft','completed','void')), created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.aqan_return_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  return_id uuid not null references public.aqan_returns(id) on delete cascade, sale_item_id uuid not null references public.aqan_sale_items(id) on delete restrict,
  product_id uuid not null references public.aqan_products(id) on delete restrict, quantity numeric(14,3) not null check(quantity>0),
  reason text not null check(reason in ('damaged','expired','wrong_item','customer_return','defect','other')),
  inventory_action text not null check(inventory_action in ('sellable','damaged_writeoff','expired_writeoff','none')), unit_amount numeric(14,2) not null, line_total numeric(14,2) not null
);

create table if not exists public.aqan_expense_categories (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  name text not null, active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,name)
);
create table if not exists public.aqan_expenses (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  expense_number text not null unique default ('AQN-EXP-' || lpad(nextval('public.aqan_expense_number_seq')::text,5,'0')),
  expense_date date not null default current_date, category_id uuid references public.aqan_expense_categories(id) on delete set null, category_name text not null,
  description text not null, amount numeric(14,2) not null check(amount>0), tax_amount numeric(14,2) not null default 0,
  payment_method text not null, supplier_id uuid references public.aqan_suppliers(id) on delete set null, receipt_path text, notes text,
  status text not null default 'posted' check(status in ('draft','posted','void')), created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);

create table if not exists public.aqan_tax_rates (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  name text not null, code text not null, rate numeric(7,4) not null check(rate between 0 and 1), tax_type text not null default 'vat', active boolean not null default true, is_default boolean not null default false, unique(organization_id,code)
);

create table if not exists public.aqan_role_permissions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  role text not null, permission text not null, allowed boolean not null default true, updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now(), unique(organization_id,role,permission)
);

create table if not exists public.aqan_import_jobs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  entity_type text not null check(entity_type in ('products','customers','suppliers')), file_name text not null, status text not null default 'completed', total_rows integer not null default 0,
  imported_rows integer not null default 0, rejected_rows integer not null default 0, error_summary jsonb not null default '[]'::jsonb, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);

create table if not exists public.aqan_product_price_history (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  product_id uuid not null references public.aqan_products(id) on delete cascade, price_type text not null check(price_type in ('cost','retail','wholesale','distributor','custom')),
  old_price numeric(14,2), new_price numeric(14,2) not null, changed_by uuid references auth.users(id) on delete set null,
  reason text, changed_at timestamptz not null default now()
);

alter table public.aqan_business_settings
  add column if not exists whatsapp text,
  add column if not exists default_currency text not null default 'TZS',
  add column if not exists enabled_currencies text[] not null default array['TZS','USD'],
  add column if not exists invoice_prefix text not null default 'AQN',
  add column if not exists quotation_prefix text not null default 'AQN-QT',
  add column if not exists proforma_prefix text not null default 'AQN-PF',
  add column if not exists receipt_prefix text not null default 'AQN-RC',
  add column if not exists negative_stock_allowed boolean not null default false,
  add column if not exists expiry_alert_days integer not null default 90,
  add column if not exists inventory_costing_method text not null default 'moving_average',
  add column if not exists payment_methods jsonb not null default '["cash","mobile_money","card","bank_transfer","credit","other"]'::jsonb;

create index if not exists aqan_movements_product_date_idx on public.aqan_stock_movements(organization_id,product_id,created_at desc);
create index if not exists aqan_batches_expiry_status_idx on public.aqan_stock_batches(organization_id,expiry_date,status) where quantity_on_hand>0;
create index if not exists aqan_sales_customer_balance_idx on public.aqan_sales(organization_id,customer_id,balance_due,due_date) where balance_due>0;
create index if not exists aqan_purchases_supplier_balance_idx on public.aqan_goods_receipts(organization_id,supplier_id,balance_due,due_date) where balance_due>0;
create index if not exists aqan_expenses_org_date_idx on public.aqan_expenses(organization_id,expense_date desc);
create index if not exists aqan_returns_sale_idx on public.aqan_returns(organization_id,sale_id,created_at desc);

do $$ declare t text; begin
  foreach t in array array['aqan_goods_receipt_items','aqan_stock_movements','aqan_proformas','aqan_proforma_items','aqan_customer_payments','aqan_customer_payment_allocations','aqan_supplier_payments','aqan_returns','aqan_return_items','aqan_expense_categories','aqan_expenses','aqan_tax_rates','aqan_role_permissions','aqan_import_jobs','aqan_product_price_history']
  loop execute format('alter table public.%I enable row level security',t); end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['aqan_goods_receipt_items','aqan_stock_movements','aqan_proformas','aqan_proforma_items','aqan_customer_payments','aqan_customer_payment_allocations','aqan_supplier_payments','aqan_returns','aqan_return_items','aqan_expense_categories','aqan_expenses','aqan_tax_rates','aqan_role_permissions','aqan_import_jobs','aqan_product_price_history']
  loop
    execute format('drop policy if exists %I on public.%I','aqan_'||t||'_read',t);
    execute format('create policy %I on public.%I for select to authenticated using (private.aqan_has_role(organization_id,array[''owner'',''admin'',''manager'',''cashier'',''sales'',''salesperson'',''inventory'',''service'',''accountant'',''viewer'']))','aqan_'||t||'_read',t);
    execute format('drop policy if exists %I on public.%I','aqan_'||t||'_write',t);
    execute format('create policy %I on public.%I for all to authenticated using (private.aqan_has_role(organization_id,array[''owner'',''admin'',''manager'',''cashier'',''sales'',''salesperson'',''inventory'',''accountant''])) with check (private.aqan_has_role(organization_id,array[''owner'',''admin'',''manager'',''cashier'',''sales'',''salesperson'',''inventory'',''accountant'']))','aqan_'||t||'_write',t);
  end loop;
end $$;

grant select,insert,update,delete on public.aqan_goods_receipt_items, public.aqan_stock_movements, public.aqan_proformas, public.aqan_proforma_items,
  public.aqan_customer_payments, public.aqan_customer_payment_allocations, public.aqan_supplier_payments, public.aqan_returns, public.aqan_return_items,
  public.aqan_expense_categories, public.aqan_expenses, public.aqan_tax_rates, public.aqan_role_permissions, public.aqan_import_jobs, public.aqan_product_price_history to authenticated;

-- Older policies remain valid for the original roles. These additive policies make
-- the new operational roles usable without weakening organization isolation.
do $$ declare t text; begin
  foreach t in array array['aqan_products','aqan_customers','aqan_sales','aqan_sale_items','aqan_payments','aqan_quotations','aqan_quotation_items','aqan_suppliers','aqan_warehouses','aqan_purchase_orders','aqan_purchase_order_items','aqan_goods_receipts','aqan_stock_batches','aqan_stock_transfers','aqan_cash_sessions','aqan_business_settings','aqan_delivery_notes','aqan_delivery_note_items','aqan_gate_passes','aqan_activity_log']
  loop
    execute format('drop policy if exists %I on public.%I','aqan_operational_roles_read',t);
    execute format('create policy %I on public.%I for select to authenticated using (private.aqan_has_role(organization_id,array[''manager'',''cashier'',''salesperson'',''inventory'',''accountant'']))','aqan_operational_roles_read',t);
  end loop;
end $$;

create policy aqan_products_operational_write on public.aqan_products for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager','inventory'])) with check (private.aqan_has_role(organization_id,array['manager','inventory']));
create policy aqan_customers_operational_write on public.aqan_customers for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager','cashier','salesperson'])) with check (private.aqan_has_role(organization_id,array['manager','cashier','salesperson']));
create policy aqan_sales_operational_write on public.aqan_sales for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager','cashier','salesperson','accountant'])) with check (private.aqan_has_role(organization_id,array['manager','cashier','salesperson','accountant']));
create policy aqan_sale_items_operational_write on public.aqan_sale_items for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager','cashier','salesperson'])) with check (private.aqan_has_role(organization_id,array['manager','cashier','salesperson']));
create policy aqan_payments_operational_write on public.aqan_payments for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager','cashier','salesperson','accountant'])) with check (private.aqan_has_role(organization_id,array['manager','cashier','salesperson','accountant']));
create policy aqan_quotations_operational_write on public.aqan_quotations for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager','cashier','salesperson'])) with check (private.aqan_has_role(organization_id,array['manager','cashier','salesperson']));
create policy aqan_quotation_items_operational_write on public.aqan_quotation_items for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager','cashier','salesperson'])) with check (private.aqan_has_role(organization_id,array['manager','cashier','salesperson']));
create policy aqan_suppliers_operational_write on public.aqan_suppliers for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager','inventory','accountant'])) with check (private.aqan_has_role(organization_id,array['manager','inventory','accountant']));
create policy aqan_warehouses_operational_write on public.aqan_warehouses for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager','inventory'])) with check (private.aqan_has_role(organization_id,array['manager','inventory']));
create policy aqan_purchases_operational_write on public.aqan_goods_receipts for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager','inventory','accountant'])) with check (private.aqan_has_role(organization_id,array['manager','inventory','accountant']));
create policy aqan_batches_operational_write on public.aqan_stock_batches for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager','inventory'])) with check (private.aqan_has_role(organization_id,array['manager','inventory']));
create policy aqan_settings_manager_write on public.aqan_business_settings for all to authenticated
  using (private.aqan_has_role(organization_id,array['manager'])) with check (private.aqan_has_role(organization_id,array['manager']));

create or replace function private.aqan_audit(p_org uuid,p_action text,p_entity text,p_entity_id uuid,p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path='' as $$
  insert into public.aqan_activity_log(organization_id,actor_id,action,entity_type,entity_id,detail) values(p_org,(select auth.uid()),p_action,p_entity,p_entity_id,p_detail);
$$;
revoke all on function private.aqan_audit(uuid,text,text,uuid,jsonb) from public,anon,authenticated;

create or replace function public.aqan_set_member_role(p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_caller text; v_current text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_role not in ('admin','manager','cashier','sales','salesperson','inventory','service','accountant','viewer') then raise exception 'Unsupported role'; end if;
  select organization_id,role into v_org,v_caller from public.aqan_memberships where user_id=(select auth.uid()) order by created_at limit 1;
  if v_caller not in ('owner','admin') then raise exception 'Only owners and admins can manage staff'; end if;
  select role into v_current from public.aqan_memberships where organization_id=v_org and user_id=p_user_id for update;
  if v_current is null then raise exception 'Staff member is not in this workspace'; end if;
  if v_current='owner' then raise exception 'Owner access cannot be changed here'; end if;
  if v_caller='admin' and p_role in ('admin','manager') then raise exception 'Only the owner can assign administrative roles'; end if;
  update public.aqan_memberships set role=p_role where organization_id=v_org and user_id=p_user_id;
  perform private.aqan_audit(v_org,'staff.role_changed','membership',p_user_id,jsonb_build_object('old_role',v_current,'new_role',p_role));
end $$;
revoke all on function public.aqan_set_member_role(uuid,text) from public,anon,authenticated;
grant execute on function public.aqan_set_member_role(uuid,text) to authenticated;

create or replace function private.aqan_track_product_prices() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.cost is distinct from old.cost then insert into public.aqan_product_price_history(organization_id,product_id,price_type,old_price,new_price,changed_by) values(new.organization_id,new.id,'cost',old.cost,new.cost,(select auth.uid())); end if;
  if new.price is distinct from old.price then insert into public.aqan_product_price_history(organization_id,product_id,price_type,old_price,new_price,changed_by) values(new.organization_id,new.id,'retail',old.price,new.price,(select auth.uid())); end if;
  if new.wholesale_price is distinct from old.wholesale_price and new.wholesale_price is not null then insert into public.aqan_product_price_history(organization_id,product_id,price_type,old_price,new_price,changed_by) values(new.organization_id,new.id,'wholesale',old.wholesale_price,new.wholesale_price,(select auth.uid())); end if;
  return new;
end $$;
drop trigger if exists aqan_products_price_history on public.aqan_products;
create trigger aqan_products_price_history after update of cost,price,wholesale_price on public.aqan_products for each row execute function private.aqan_track_product_prices();

create or replace function public.aqan_create_product_with_opening_stock(p_product jsonb,p_purchase jsonb default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_product uuid; v_supplier uuid; v_grn uuid; v_batch uuid; v_qty numeric; v_cost numeric; v_old_qty numeric; v_sku text;
begin
  select organization_id into v_org from public.aqan_memberships where user_id=(select auth.uid()) order by created_at limit 1;
  if v_org is null or not private.aqan_has_role(v_org,array['owner','admin','manager','inventory']) then raise exception 'You do not have permission to add products'; end if;
  v_sku:=upper(coalesce(nullif(trim(p_product->>'sku'),''),left(regexp_replace(coalesce(p_product->>'category','PRD'),'[^A-Za-z0-9]','','g'),3)||'-'||upper(substr(gen_random_uuid()::text,1,6))));
  insert into public.aqan_products(organization_id,sku,barcode,name,product_type,category,description,unit_of_measure,purchase_unit,units_per_purchase,price,wholesale_price,distributor_price,custom_price,minimum_selling_price,cost,average_cost,tax_code,tax_rate,tax_inclusive,discount_eligible,track_inventory,allow_negative_stock,reorder_level,reorder_quantity,serial_tracked,active,preferred_supplier_id,color,created_by)
  values(v_org,v_sku,nullif(trim(p_product->>'barcode'),''),trim(p_product->>'name'),coalesce(p_product->>'product_type','product'),coalesce(nullif(trim(p_product->>'category'),''),'Uncategorized'),nullif(trim(p_product->>'description'),''),coalesce(nullif(trim(p_product->>'unit'),''),'piece'),nullif(trim(p_product->>'purchase_unit'),''),coalesce((p_product->>'units_per_purchase')::numeric,1),coalesce((p_product->>'retail_price')::numeric,0),nullif(p_product->>'wholesale_price','')::numeric,nullif(p_product->>'distributor_price','')::numeric,nullif(p_product->>'custom_price','')::numeric,nullif(p_product->>'minimum_price','')::numeric,coalesce((p_product->>'cost')::numeric,0),coalesce((p_product->>'cost')::numeric,0),coalesce(p_product->>'tax_code','vat18'),coalesce((p_product->>'tax_rate')::numeric,0.18),coalesce((p_product->>'tax_inclusive')::boolean,false),coalesce((p_product->>'discount_eligible')::boolean,true),coalesce((p_product->>'track_inventory')::boolean,true),coalesce((p_product->>'allow_negative_stock')::boolean,false),coalesce((p_product->>'reorder_level')::integer,0),nullif(p_product->>'reorder_quantity','')::numeric,coalesce((p_product->>'serial_tracked')::boolean,false),coalesce((p_product->>'active')::boolean,true),nullif(p_product->>'supplier_id','')::uuid,'#dff4ff',(select auth.uid())) returning id into v_product;
  if p_purchase is not null and coalesce((p_purchase->>'quantity')::numeric,0)>0 then
    v_qty:=(p_purchase->>'quantity')::numeric*coalesce(nullif(p_purchase->>'units_per_purchase','')::numeric,1); v_cost:=coalesce((p_purchase->>'cost_per_selling_unit')::numeric,(p_purchase->>'unit_cost')::numeric/coalesce(nullif(p_purchase->>'units_per_purchase','')::numeric,1),0); v_supplier:=nullif(p_purchase->>'supplier_id','')::uuid;
    insert into public.aqan_goods_receipts(organization_id,purchase_number,supplier_id,supplier_invoice_number,purchase_date,due_date,status,payment_status,payment_method,subtotal,total,amount_paid,balance_due,received_by,notes)
    values(v_org,'AQN-PUR-'||to_char(now(),'YYYYMM')||'-'||lpad(nextval('public.aqan_purchase_number_seq')::text,5,'0'),v_supplier,nullif(trim(p_purchase->>'reference'),''),coalesce((p_purchase->>'purchase_date')::date,current_date),nullif(p_purchase->>'due_date','')::date,'received',coalesce(p_purchase->>'payment_status','paid'),nullif(p_purchase->>'payment_method',''),v_qty*v_cost,v_qty*v_cost,case when coalesce(p_purchase->>'payment_status','paid')='paid' then v_qty*v_cost else coalesce((p_purchase->>'amount_paid')::numeric,0) end,case when coalesce(p_purchase->>'payment_status','paid')='paid' then 0 else greatest(v_qty*v_cost-coalesce((p_purchase->>'amount_paid')::numeric,0),0) end,(select auth.uid()),'Opening inventory recorded with product') returning id into v_grn;
    insert into public.aqan_stock_batches(organization_id,product_id,supplier_id,goods_receipt_id,batch_number,manufacturing_date,expiry_date,received_quantity,quantity_on_hand,cost_per_unit,received_date,status)
    values(v_org,v_product,v_supplier,v_grn,nullif(trim(p_purchase->>'batch_number'),''),nullif(p_purchase->>'manufacturing_date','')::date,nullif(p_purchase->>'expiry_date','')::date,v_qty,v_qty,v_cost,coalesce((p_purchase->>'purchase_date')::date,current_date),case when nullif(p_purchase->>'expiry_date','')::date < current_date then 'expired' else 'healthy' end) returning id into v_batch;
    insert into public.aqan_goods_receipt_items(organization_id,goods_receipt_id,product_id,stock_batch_id,quantity,purchase_unit,units_per_purchase,selling_units_received,unit_cost,line_total,batch_number,manufacturing_date,expiry_date)
    values(v_org,v_grn,v_product,v_batch,(p_purchase->>'quantity')::numeric,coalesce(nullif(p_purchase->>'purchase_unit',''),coalesce(nullif(p_product->>'purchase_unit',''),'piece')),coalesce(nullif(p_purchase->>'units_per_purchase','')::numeric,1),v_qty,v_cost,v_qty*v_cost,nullif(trim(p_purchase->>'batch_number'),''),nullif(p_purchase->>'manufacturing_date','')::date,nullif(p_purchase->>'expiry_date','')::date);
    update public.aqan_products set stock=v_qty::integer,cost=v_cost,average_cost=v_cost,updated_cost_at=now(),preferred_supplier_id=coalesce(v_supplier,preferred_supplier_id) where id=v_product;
    if v_supplier is not null then update public.aqan_suppliers set outstanding_balance=outstanding_balance+(select balance_due from public.aqan_goods_receipts where id=v_grn) where id=v_supplier; end if;
    insert into public.aqan_stock_movements(organization_id,product_id,batch_id,movement_type,quantity_change,unit_cost,reference_type,reference_id,reference_number,notes,created_by)
    values(v_org,v_product,v_batch,'opening_balance',v_qty,v_cost,'purchase',v_grn,(select purchase_number from public.aqan_goods_receipts where id=v_grn),'Opening stock',(select auth.uid()));
  end if;
  perform private.aqan_audit(v_org,'product.created','product',v_product,jsonb_build_object('sku',v_sku,'opening_quantity',coalesce(v_qty,0)));
  return v_product;
end $$;

create or replace function public.aqan_receive_purchase(p_header jsonb,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_grn uuid; v_item jsonb; v_product public.aqan_products%rowtype; v_batch uuid; v_qty numeric; v_cost numeric; v_old_value numeric; v_new_avg numeric; v_supplier uuid; v_total numeric:=0; v_paid numeric:=0;
begin
  select organization_id into v_org from public.aqan_memberships where user_id=(select auth.uid()) order by created_at limit 1;
  if v_org is null or not private.aqan_has_role(v_org,array['owner','admin','manager','inventory','accountant']) then raise exception 'You do not have permission to receive stock'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one purchase item'; end if;
  v_supplier:=nullif(p_header->>'supplier_id','')::uuid;
  if v_supplier is null or not exists(select 1 from public.aqan_suppliers where id=v_supplier and organization_id=v_org) then raise exception 'Choose a valid supplier'; end if;
  select coalesce(sum((x->>'line_total')::numeric),0) into v_total from jsonb_array_elements(p_items) x;
  v_total:=greatest(v_total-coalesce((p_header->>'discount_amount')::numeric,0)+coalesce((p_header->>'tax_amount')::numeric,0)+coalesce((p_header->>'shipping_amount')::numeric,0)+coalesce((p_header->>'additional_costs')::numeric,0),0); v_paid:=least(coalesce((p_header->>'amount_paid')::numeric,0),v_total);
  insert into public.aqan_goods_receipts(organization_id,purchase_number,supplier_id,warehouse_id,supplier_invoice_number,purchase_date,due_date,status,payment_status,payment_method,subtotal,discount_amount,tax_amount,shipping_amount,additional_costs,total,amount_paid,balance_due,received_by,notes)
  values(v_org,'AQN-PUR-'||to_char(now(),'YYYYMM')||'-'||lpad(nextval('public.aqan_purchase_number_seq')::text,5,'0'),v_supplier,nullif(p_header->>'warehouse_id','')::uuid,nullif(trim(p_header->>'reference'),''),coalesce(nullif(p_header->>'purchase_date','')::date,current_date),nullif(p_header->>'due_date','')::date,case when v_paid>=v_total then 'paid' when v_paid>0 then 'partially_paid' else 'received' end,case when v_paid>=v_total then 'paid' when v_paid>0 then 'partially_paid' else 'unpaid' end,nullif(p_header->>'payment_method',''),v_total+coalesce((p_header->>'discount_amount')::numeric,0)-coalesce((p_header->>'tax_amount')::numeric,0)-coalesce((p_header->>'shipping_amount')::numeric,0)-coalesce((p_header->>'additional_costs')::numeric,0),coalesce((p_header->>'discount_amount')::numeric,0),coalesce((p_header->>'tax_amount')::numeric,0),coalesce((p_header->>'shipping_amount')::numeric,0),coalesce((p_header->>'additional_costs')::numeric,0),v_total,v_paid,v_total-v_paid,(select auth.uid()),nullif(trim(p_header->>'notes'),'')) returning id into v_grn;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.aqan_products where id=(v_item->>'product_id')::uuid and organization_id=v_org for update;
    if v_product.id is null then raise exception 'Purchase contains an invalid product'; end if;
    v_qty:=(v_item->>'quantity')::numeric*coalesce(nullif(v_item->>'units_per_purchase','')::numeric,1); v_cost:=coalesce((v_item->>'unit_cost')::numeric,0)/coalesce(nullif(v_item->>'units_per_purchase','')::numeric,1);
    v_old_value:=v_product.stock*coalesce(nullif(v_product.average_cost,0),v_product.cost); v_new_avg:=case when v_product.costing_method='manual' then v_product.average_cost when v_product.costing_method='last_purchase' then v_cost else round((v_old_value+v_qty*v_cost)/nullif(v_product.stock+v_qty,0),2) end;
    insert into public.aqan_stock_batches(organization_id,product_id,warehouse_id,supplier_id,goods_receipt_id,batch_number,manufacturing_date,expiry_date,received_quantity,quantity_on_hand,cost_per_unit,received_date,status)
    values(v_org,v_product.id,nullif(p_header->>'warehouse_id','')::uuid,v_supplier,v_grn,nullif(trim(v_item->>'batch_number'),''),nullif(v_item->>'manufacturing_date','')::date,nullif(v_item->>'expiry_date','')::date,v_qty,v_qty,v_cost,coalesce(nullif(p_header->>'purchase_date','')::date,current_date),case when nullif(v_item->>'expiry_date','')::date<current_date then 'expired' else 'healthy' end) returning id into v_batch;
    insert into public.aqan_goods_receipt_items(organization_id,goods_receipt_id,product_id,stock_batch_id,quantity,purchase_unit,units_per_purchase,selling_units_received,unit_cost,discount_amount,tax_rate,tax_amount,line_total,batch_number,manufacturing_date,expiry_date)
    values(v_org,v_grn,v_product.id,v_batch,(v_item->>'quantity')::numeric,coalesce(nullif(v_item->>'purchase_unit',''),v_product.purchase_unit,v_product.unit_of_measure),coalesce(nullif(v_item->>'units_per_purchase','')::numeric,1),v_qty,v_cost,coalesce((v_item->>'discount_amount')::numeric,0),coalesce((v_item->>'tax_rate')::numeric,0),coalesce((v_item->>'tax_amount')::numeric,0),(v_item->>'line_total')::numeric,nullif(trim(v_item->>'batch_number'),''),nullif(v_item->>'manufacturing_date','')::date,nullif(v_item->>'expiry_date','')::date);
    update public.aqan_products set stock=stock+v_qty::integer,cost=v_new_avg,average_cost=v_new_avg,updated_cost_at=now(),preferred_supplier_id=coalesce(preferred_supplier_id,v_supplier) where id=v_product.id;
    insert into public.aqan_stock_movements(organization_id,product_id,batch_id,warehouse_id,movement_type,quantity_change,unit_cost,reference_type,reference_id,reference_number,created_by)
    values(v_org,v_product.id,v_batch,nullif(p_header->>'warehouse_id','')::uuid,'purchase',v_qty,v_cost,'purchase',v_grn,(select purchase_number from public.aqan_goods_receipts where id=v_grn),(select auth.uid()));
  end loop;
  update public.aqan_suppliers set outstanding_balance=outstanding_balance+(v_total-v_paid) where id=v_supplier;
  perform private.aqan_audit(v_org,'purchase.received','purchase',v_grn,jsonb_build_object('total',v_total,'paid',v_paid,'balance',v_total-v_paid)); return v_grn;
end $$;

create or replace function public.aqan_adjust_stock(p_product_id uuid,p_batch_id uuid,p_quantity_change numeric,p_reason text,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_movement uuid; v_type text; v_batch_qty numeric;
begin select organization_id into v_org from public.aqan_products where id=p_product_id for update;
  if v_org is null or not private.aqan_has_role(v_org,array['owner','admin','manager','inventory']) then raise exception 'Not permitted'; end if;
  v_type:=case p_reason when 'stocktake' then 'stock_count' when 'damaged' then 'damaged' when 'expired' then 'expired' when 'lost' then 'lost' when 'internal_use' then 'internal_use' when 'found_stock' then 'found_stock' else 'manual_adjustment' end;
  if p_batch_id is not null then select quantity_on_hand into v_batch_qty from public.aqan_stock_batches where id=p_batch_id and product_id=p_product_id and organization_id=v_org for update; if v_batch_qty is null or v_batch_qty+p_quantity_change<0 then raise exception 'Adjustment exceeds the selected batch'; end if; update public.aqan_stock_batches set quantity_on_hand=quantity_on_hand+p_quantity_change,status=case when quantity_on_hand+p_quantity_change<=0 then 'depleted' when expiry_date<current_date then 'expired' else 'healthy' end where id=p_batch_id; end if;
  if (select stock+p_quantity_change from public.aqan_products where id=p_product_id)<0 then raise exception 'Adjustment would make stock negative'; end if;
  update public.aqan_products set stock=stock+p_quantity_change::integer where id=p_product_id;
  insert into public.aqan_stock_movements(organization_id,product_id,batch_id,movement_type,quantity_change,reference_type,notes,created_by) values(v_org,p_product_id,p_batch_id,v_type,p_quantity_change,'adjustment',nullif(trim(p_notes),''),(select auth.uid())) returning id into v_movement;
  perform private.aqan_audit(v_org,'stock.adjusted','product',p_product_id,jsonb_build_object('change',p_quantity_change,'reason',p_reason)); return v_movement;
end $$;

create or replace function public.aqan_complete_sale_v2(p_customer_id uuid,p_items jsonb,p_payments jsonb,p_discount numeric default 0,p_shipping numeric default 0,p_due_date date default null,p_notes text default null,p_salesperson uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_sale uuid; v_invoice text; v_item jsonb; v_payment jsonb; v_product public.aqan_products%rowtype; v_price numeric; v_qty numeric; v_subtotal numeric:=0; v_discount numeric:=greatest(coalesce(p_discount,0),0); v_shipping numeric:=greatest(coalesce(p_shipping,0),0); v_tax numeric:=0; v_total numeric; v_paid numeric:=0; v_line_tax numeric; v_line_discount numeric; v_batch record; v_remaining numeric;
begin select organization_id into v_org from public.aqan_memberships where user_id=(select auth.uid()) order by created_at limit 1;
  if v_org is null or not private.aqan_has_role(v_org,array['owner','admin','manager','cashier','sales','salesperson']) then raise exception 'You do not have permission to complete sales'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one item'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.aqan_products where id=(v_item->>'product_id')::uuid and organization_id=v_org and active for update;
    if v_product.id is null then raise exception 'Invalid sale product'; end if; v_qty:=(v_item->>'quantity')::numeric;
    if v_product.product_type='product' and v_product.track_inventory and not v_product.allow_negative_stock and v_product.stock<v_qty then raise exception 'Insufficient stock for %',v_product.name; end if;
    v_price:=case coalesce(v_item->>'price_level','retail') when 'wholesale' then coalesce(v_product.wholesale_price,v_product.price) when 'distributor' then coalesce(v_product.distributor_price,v_product.wholesale_price,v_product.price) when 'custom' then coalesce(nullif(v_item->>'unit_price','')::numeric,v_product.custom_price,v_product.price) else coalesce(nullif(v_item->>'unit_price','')::numeric,v_product.price) end;
    if v_product.minimum_selling_price is not null and v_price<v_product.minimum_selling_price and not private.aqan_has_role(v_org,array['owner','admin','manager']) then raise exception 'Price below allowed minimum for %',v_product.name; end if;
    v_line_discount:=greatest(coalesce((v_item->>'discount_amount')::numeric,0),0); v_line_tax:=case when v_product.tax_inclusive then round(greatest(v_price*v_qty-v_line_discount,0)*v_product.tax_rate/(1+v_product.tax_rate),2) else round(greatest(v_price*v_qty-v_line_discount,0)*v_product.tax_rate,2) end;
    v_subtotal:=v_subtotal+greatest(v_price*v_qty-v_line_discount,0); v_tax:=v_tax+v_line_tax;
  end loop;
  v_total:=greatest(v_subtotal-v_discount+v_tax+v_shipping,0);
  if jsonb_typeof(p_payments)='array' then select coalesce(sum((x->>'amount')::numeric),0) into v_paid from jsonb_array_elements(p_payments) x where coalesce(x->>'method','credit')<>'credit'; end if; v_paid:=least(v_paid,v_total);
  insert into public.aqan_sales(organization_id,customer_id,subtotal,discount_amount,shipping_amount,vat_amount,total,amount_paid,balance_due,status,due_date,notes,price_level,salesperson_id,customer_name_snapshot,customer_phone_snapshot,customer_email_snapshot,created_by)
  select v_org,p_customer_id,v_subtotal,v_discount,v_shipping,v_tax,v_total,v_paid,v_total-v_paid,case when v_paid>=v_total then 'paid' else 'pending' end,p_due_date,nullif(trim(p_notes),''),'mixed',coalesce(p_salesperson,(select auth.uid())),coalesce(c.name,'Walk-in Customer'),c.phone,c.email,(select auth.uid()) from (select 1) z left join public.aqan_customers c on c.id=p_customer_id and c.organization_id=v_org returning id,invoice_number into v_sale,v_invoice;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.aqan_products where id=(v_item->>'product_id')::uuid; v_qty:=(v_item->>'quantity')::numeric; v_price:=case coalesce(v_item->>'price_level','retail') when 'wholesale' then coalesce(v_product.wholesale_price,v_product.price) when 'distributor' then coalesce(v_product.distributor_price,v_product.wholesale_price,v_product.price) when 'custom' then coalesce(nullif(v_item->>'unit_price','')::numeric,v_product.custom_price,v_product.price) else coalesce(nullif(v_item->>'unit_price','')::numeric,v_product.price) end; v_line_discount:=greatest(coalesce((v_item->>'discount_amount')::numeric,0),0); v_line_tax:=case when v_product.tax_inclusive then round(greatest(v_price*v_qty-v_line_discount,0)*v_product.tax_rate/(1+v_product.tax_rate),2) else round(greatest(v_price*v_qty-v_line_discount,0)*v_product.tax_rate,2) end;
    insert into public.aqan_sale_items(organization_id,sale_id,product_id,product_name,sku,quantity,unit,price_level,unit_price,cost_price,discount_amount,tax_rate,tax_amount,line_total) values(v_org,v_sale,v_product.id,v_product.name,v_product.sku,v_qty::integer,v_product.unit_of_measure,coalesce(v_item->>'price_level','retail'),v_price,coalesce(nullif(v_product.average_cost,0),v_product.cost),v_line_discount,v_product.tax_rate,v_line_tax,greatest(v_price*v_qty-v_line_discount,0)+v_line_tax);
    if v_product.product_type='product' and v_product.track_inventory then
      update public.aqan_products set stock=stock-v_qty::integer where id=v_product.id; v_remaining:=v_qty;
      for v_batch in select * from public.aqan_stock_batches where product_id=v_product.id and organization_id=v_org and quantity_on_hand>0 order by expiry_date nulls last,received_date,id for update loop exit when v_remaining<=0; update public.aqan_stock_batches set quantity_on_hand=quantity_on_hand-least(quantity_on_hand,v_remaining),status=case when quantity_on_hand-least(quantity_on_hand,v_remaining)<=0 then 'depleted' when expiry_date<current_date then 'expired' else status end where id=v_batch.id; insert into public.aqan_stock_movements(organization_id,product_id,batch_id,warehouse_id,movement_type,quantity_change,unit_cost,reference_type,reference_id,reference_number,created_by) values(v_org,v_product.id,v_batch.id,v_batch.warehouse_id,'sale',-least(v_batch.quantity_on_hand,v_remaining),v_batch.cost_per_unit,'sale',v_sale,v_invoice,(select auth.uid())); v_remaining:=v_remaining-least(v_batch.quantity_on_hand,v_remaining); end loop;
      if v_remaining>0 then insert into public.aqan_stock_movements(organization_id,product_id,movement_type,quantity_change,unit_cost,reference_type,reference_id,reference_number,created_by) values(v_org,v_product.id,'sale',-v_remaining,coalesce(nullif(v_product.average_cost,0),v_product.cost),'sale',v_sale,v_invoice,(select auth.uid())); end if;
    end if;
  end loop;
  if jsonb_typeof(p_payments)='array' then for v_payment in select * from jsonb_array_elements(p_payments) loop if coalesce(v_payment->>'method','credit')<>'credit' and coalesce((v_payment->>'amount')::numeric,0)>0 then insert into public.aqan_payments(organization_id,sale_id,amount,method,mobile_provider,status,reference,notes,received_by) values(v_org,v_sale,(v_payment->>'amount')::numeric,v_payment->>'method',nullif(v_payment->>'provider',''),'completed',nullif(v_payment->>'reference',''),nullif(v_payment->>'notes',''),(select auth.uid())); end if; end loop; end if;
  if p_customer_id is not null then update public.aqan_customers set total_spend=total_spend+v_total,last_purchase_at=now() where id=p_customer_id; end if; perform private.aqan_audit(v_org,'sale.completed','sale',v_sale,jsonb_build_object('invoice_number',v_invoice,'total',v_total,'paid',v_paid,'balance',v_total-v_paid));
  return jsonb_build_object('sale_id',v_sale,'invoice_number',v_invoice,'subtotal',v_subtotal,'tax',v_tax,'total',v_total,'amount_paid',v_paid,'balance_due',v_total-v_paid);
end $$;

create or replace function public.aqan_record_customer_payment(p_customer_id uuid,p_amount numeric,p_method text,p_reference text default null,p_notes text default null,p_sale_ids uuid[] default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_payment uuid; v_remaining numeric:=p_amount; v_sale record; v_apply numeric;
begin select organization_id into v_org from public.aqan_customers where id=p_customer_id;
  if v_org is null or not private.aqan_has_role(v_org,array['owner','admin','manager','cashier','sales','salesperson','accountant']) then raise exception 'Not permitted'; end if; if p_amount<=0 then raise exception 'Amount must be positive'; end if;
  insert into public.aqan_customer_payments(organization_id,customer_id,amount,method,reference,notes,received_by) values(v_org,p_customer_id,p_amount,p_method,nullif(trim(p_reference),''),nullif(trim(p_notes),''),(select auth.uid())) returning id into v_payment;
  for v_sale in select id,balance_due from public.aqan_sales where organization_id=v_org and customer_id=p_customer_id and balance_due>0 and (p_sale_ids is null or id=any(p_sale_ids)) order by due_date nulls last,sold_at for update loop exit when v_remaining<=0; v_apply:=least(v_remaining,v_sale.balance_due); insert into public.aqan_customer_payment_allocations(organization_id,customer_payment_id,sale_id,amount) values(v_org,v_payment,v_sale.id,v_apply); insert into public.aqan_payments(organization_id,sale_id,amount,method,status,reference,notes,received_by) values(v_org,v_sale.id,v_apply,p_method,'completed',nullif(trim(p_reference),''),nullif(trim(p_notes),''),(select auth.uid())); update public.aqan_sales set amount_paid=amount_paid+v_apply,balance_due=balance_due-v_apply,status=case when balance_due-v_apply<=0 then 'paid' else 'pending' end where id=v_sale.id; v_remaining:=v_remaining-v_apply; end loop;
  perform private.aqan_audit(v_org,'customer.payment_recorded','customer',p_customer_id,jsonb_build_object('amount',p_amount,'unallocated',v_remaining)); return v_payment;
end $$;

create or replace function public.aqan_record_supplier_payment(p_supplier_id uuid,p_amount numeric,p_method text,p_reference text default null,p_notes text default null,p_purchase_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_payment uuid; v_remaining numeric:=p_amount; v_purchase record; v_apply numeric;
begin select organization_id into v_org from public.aqan_suppliers where id=p_supplier_id;
  if v_org is null or not private.aqan_has_role(v_org,array['owner','admin','manager','accountant']) then raise exception 'Not permitted'; end if;
  insert into public.aqan_supplier_payments(organization_id,supplier_id,goods_receipt_id,amount,method,reference,notes,paid_by) values(v_org,p_supplier_id,p_purchase_id,p_amount,p_method,nullif(trim(p_reference),''),nullif(trim(p_notes),''),(select auth.uid())) returning id into v_payment;
  for v_purchase in select id,balance_due from public.aqan_goods_receipts where organization_id=v_org and supplier_id=p_supplier_id and balance_due>0 and (p_purchase_id is null or id=p_purchase_id) order by due_date nulls last,purchase_date for update loop exit when v_remaining<=0; v_apply:=least(v_remaining,v_purchase.balance_due); update public.aqan_goods_receipts set amount_paid=amount_paid+v_apply,balance_due=balance_due-v_apply,payment_status=case when balance_due-v_apply<=0 then 'paid' else 'partially_paid' end,status=case when balance_due-v_apply<=0 then 'paid' else 'partially_paid' end where id=v_purchase.id; v_remaining:=v_remaining-v_apply; end loop;
  update public.aqan_suppliers set outstanding_balance=greatest(outstanding_balance-(p_amount-v_remaining),0) where id=p_supplier_id; perform private.aqan_audit(v_org,'supplier.payment_recorded','supplier',p_supplier_id,jsonb_build_object('amount',p_amount)); return v_payment;
end $$;

create or replace function public.aqan_convert_quotation_to_invoice(p_quotation_id uuid,p_payments jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_customer uuid; v_items jsonb; v_result jsonb;
begin select organization_id,customer_id into v_org,v_customer from public.aqan_quotations where id=p_quotation_id for update;
  if v_org is null or not private.aqan_has_role(v_org,array['owner','admin','manager','cashier','sales','salesperson']) then raise exception 'Not permitted'; end if;
  select jsonb_agg(jsonb_build_object('product_id',product_id,'quantity',quantity,'unit_price',unit_price,'price_level','custom','discount_amount',0)) into v_items from public.aqan_quotation_items where quotation_id=p_quotation_id and product_id is not null;
  v_result:=public.aqan_complete_sale_v2(v_customer,v_items,coalesce(p_payments,'[]'::jsonb),0,0,null,'Converted from quotation '||(select quote_number from public.aqan_quotations where id=p_quotation_id),(select auth.uid()));
  update public.aqan_quotations set status='converted',converted_sale_id=(v_result->>'sale_id')::uuid where id=p_quotation_id; update public.aqan_sales set quotation_id=p_quotation_id where id=(v_result->>'sale_id')::uuid; return v_result;
end $$;

create or replace function public.aqan_convert_proforma_to_invoice(p_proforma_id uuid,p_payments jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_customer uuid; v_items jsonb; v_result jsonb;
begin
  select organization_id,customer_id into v_org,v_customer from public.aqan_proformas where id=p_proforma_id for update;
  if v_org is null or not private.aqan_has_role(v_org,array['owner','admin','manager','cashier','sales','salesperson']) then raise exception 'Not permitted'; end if;
  select jsonb_agg(jsonb_build_object('product_id',product_id,'quantity',quantity,'unit_price',unit_price,'price_level','custom','discount_amount',discount_amount)) into v_items from public.aqan_proforma_items where proforma_id=p_proforma_id and product_id is not null;
  if v_items is null then raise exception 'A proforma needs at least one catalogue item before conversion'; end if;
  v_result:=public.aqan_complete_sale_v2(v_customer,v_items,coalesce(p_payments,'[]'::jsonb),0,0,null,'Converted from proforma '||(select proforma_number from public.aqan_proformas where id=p_proforma_id),(select auth.uid()));
  update public.aqan_proformas set status='converted',converted_sale_id=(v_result->>'sale_id')::uuid,updated_at=now() where id=p_proforma_id;
  return v_result;
end $$;

create or replace function public.aqan_process_return(p_sale_id uuid,p_action text,p_items jsonb,p_refund_method text default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_return uuid; v_item jsonb; v_sale_item public.aqan_sale_items%rowtype; v_total numeric:=0; v_qty numeric;
begin select organization_id into v_org from public.aqan_sales where id=p_sale_id;
  if v_org is null or not private.aqan_has_role(v_org,array['owner','admin','manager','cashier']) then raise exception 'Not permitted'; end if;
  insert into public.aqan_returns(organization_id,sale_id,customer_id,action,refund_method,notes,created_by) select v_org,id,customer_id,p_action,nullif(p_refund_method,''),nullif(trim(p_notes),''),(select auth.uid()) from public.aqan_sales where id=p_sale_id returning id into v_return;
  for v_item in select * from jsonb_array_elements(p_items) loop select * into v_sale_item from public.aqan_sale_items where id=(v_item->>'sale_item_id')::uuid and sale_id=p_sale_id for update; v_qty:=(v_item->>'quantity')::numeric; if v_sale_item.id is null or v_qty<=0 or v_sale_item.returned_quantity+v_qty>v_sale_item.quantity then raise exception 'Invalid return quantity'; end if; v_total:=v_total+v_qty*v_sale_item.unit_price; insert into public.aqan_return_items(organization_id,return_id,sale_item_id,product_id,quantity,reason,inventory_action,unit_amount,line_total) values(v_org,v_return,v_sale_item.id,v_sale_item.product_id,v_qty,v_item->>'reason',v_item->>'inventory_action',v_sale_item.unit_price,v_qty*v_sale_item.unit_price); update public.aqan_sale_items set returned_quantity=returned_quantity+v_qty where id=v_sale_item.id; if v_item->>'inventory_action'='sellable' then update public.aqan_products set stock=stock+v_qty::integer where id=v_sale_item.product_id; insert into public.aqan_stock_movements(organization_id,product_id,movement_type,quantity_change,unit_cost,reference_type,reference_id,created_by,notes) values(v_org,v_sale_item.product_id,'customer_return',v_qty,v_sale_item.cost_price,'return',v_return,(select auth.uid()),v_item->>'reason'); else insert into public.aqan_stock_movements(organization_id,product_id,movement_type,quantity_change,unit_cost,reference_type,reference_id,created_by,notes) values(v_org,v_sale_item.product_id,case when v_item->>'inventory_action'='expired_writeoff' then 'expired' else 'damaged' end,-v_qty,v_sale_item.cost_price,'return',v_return,(select auth.uid()),v_item->>'reason'); end if; end loop;
  update public.aqan_returns set total=v_total where id=v_return;
  if p_action='customer_credit' then update public.aqan_sales set balance_due=greatest(balance_due-v_total,0),status=case when greatest(balance_due-v_total,0)=0 then 'paid' else status end where id=p_sale_id; end if;
  perform private.aqan_audit(v_org,'return.processed','return',v_return,jsonb_build_object('total',v_total,'action',p_action)); return v_return;
end $$;

create or replace function private.aqan_sync_payment_balance() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.aqan_sales set amount_paid=coalesce((select sum(amount) from public.aqan_payments where sale_id=new.sale_id and status='completed'),0),balance_due=greatest(total-coalesce((select sum(amount) from public.aqan_payments where sale_id=new.sale_id and status='completed'),0),0),status=case when coalesce((select sum(amount) from public.aqan_payments where sale_id=new.sale_id and status='completed'),0)>=total then 'paid' else 'pending' end where id=new.sale_id and status<>'void'; return new; end $$;
drop trigger if exists aqan_payments_sync_sale on public.aqan_payments;
create trigger aqan_payments_sync_sale after insert or update on public.aqan_payments for each row execute function private.aqan_sync_payment_balance();

do $$ declare sig regprocedure; begin
  foreach sig in array array[
    'public.aqan_create_product_with_opening_stock(jsonb,jsonb)'::regprocedure,
    'public.aqan_receive_purchase(jsonb,jsonb)'::regprocedure,
    'public.aqan_adjust_stock(uuid,uuid,numeric,text,text)'::regprocedure,
    'public.aqan_complete_sale_v2(uuid,jsonb,jsonb,numeric,numeric,date,text,uuid)'::regprocedure,
    'public.aqan_record_customer_payment(uuid,numeric,text,text,text,uuid[])'::regprocedure,
    'public.aqan_record_supplier_payment(uuid,numeric,text,text,text,uuid)'::regprocedure,
    'public.aqan_convert_quotation_to_invoice(uuid,jsonb)'::regprocedure,
    'public.aqan_convert_proforma_to_invoice(uuid,jsonb)'::regprocedure,
    'public.aqan_process_return(uuid,text,jsonb,text,text)'::regprocedure]
  loop execute format('revoke all on function %s from public,anon,authenticated',sig); execute format('grant execute on function %s to authenticated',sig); end loop;
end $$;

insert into public.aqan_tax_rates(organization_id,name,code,rate,is_default)
select id,'VAT 18%','vat18',0.18,true from public.aqan_organizations on conflict(organization_id,code) do nothing;
insert into public.aqan_tax_rates(organization_id,name,code,rate)
select id,'VAT Exempt','exempt',0,false from public.aqan_organizations on conflict(organization_id,code) do nothing;
insert into public.aqan_tax_rates(organization_id,name,code,rate)
select id,'Zero Rated','zero',0,false from public.aqan_organizations on conflict(organization_id,code) do nothing;
insert into public.aqan_expense_categories(organization_id,name)
select organization.id,category.name from public.aqan_organizations organization cross join (values('Rent'),('Utilities'),('Salaries'),('Transport'),('Internet'),('Repairs'),('Marketing'),('Other')) category(name) on conflict(organization_id,name) do nothing;
