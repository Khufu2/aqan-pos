-- Enterprise operations: document branding, suppliers, purchasing, warehouses, traceability and financial control.

alter table public.aqan_business_settings
  add column if not exists logo_path text,
  add column if not exists document_layout text not null default 'classic' check (document_layout in ('classic','modern','compact')),
  add column if not exists quotation_accent text not null default '#0ea5e9';

create table if not exists public.aqan_suppliers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  name text not null, contact_name text, phone text, email text, address text, tin text, payment_terms text, status text not null default 'active' check (status in ('active','on_hold','inactive')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id, name)
);
create table if not exists public.aqan_warehouses (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  name text not null, code text not null, address text, manager_name text, active boolean not null default true, created_at timestamptz not null default now(), unique (organization_id, code)
);
create table if not exists public.aqan_purchase_orders (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  po_number text not null unique default ('AQN-PO-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.aqan_quote_number_seq')::text, 5, '0')),
  supplier_id uuid not null references public.aqan_suppliers(id) on delete restrict, warehouse_id uuid references public.aqan_warehouses(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','submitted','approved','ordered','part_received','received','cancelled')),
  expected_on date, notes text, subtotal numeric(14,2) not null default 0, vat_amount numeric(14,2) not null default 0, total numeric(14,2) not null default 0, created_by uuid references auth.users(id) on delete set null, approved_by uuid references auth.users(id) on delete set null, approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.aqan_purchase_order_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade, purchase_order_id uuid not null references public.aqan_purchase_orders(id) on delete cascade, product_id uuid references public.aqan_products(id) on delete set null, description text not null, quantity integer not null check (quantity > 0), received_quantity integer not null default 0 check (received_quantity >= 0), unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0), line_total numeric(14,2) generated always as (quantity * unit_cost) stored
);
create table if not exists public.aqan_goods_receipts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade, grn_number text not null unique default ('AQN-GRN-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.aqan_invoice_number_seq')::text, 5, '0')),
  purchase_order_id uuid references public.aqan_purchase_orders(id) on delete set null, supplier_id uuid references public.aqan_suppliers(id) on delete set null, warehouse_id uuid references public.aqan_warehouses(id) on delete set null, supplier_invoice_number text, received_by uuid references auth.users(id) on delete set null, received_at timestamptz not null default now(), notes text
);
create table if not exists public.aqan_stock_batches (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade, product_id uuid not null references public.aqan_products(id) on delete cascade, warehouse_id uuid references public.aqan_warehouses(id) on delete set null, batch_number text, expiry_date date, quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0), cost_per_unit numeric(14,2) not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.aqan_stock_transfers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade, transfer_number text not null unique default ('AQN-ST-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.aqan_gate_number_seq')::text, 5, '0')),
  from_warehouse_id uuid references public.aqan_warehouses(id) on delete set null, to_warehouse_id uuid references public.aqan_warehouses(id) on delete set null, status text not null default 'draft' check (status in ('draft','in_transit','received','cancelled')), requested_by uuid references auth.users(id) on delete set null, received_by uuid references auth.users(id) on delete set null, notes text, created_at timestamptz not null default now()
);
create table if not exists public.aqan_cash_sessions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.aqan_organizations(id) on delete cascade, opened_by uuid references auth.users(id) on delete set null, closed_by uuid references auth.users(id) on delete set null, opening_float numeric(14,2) not null default 0, expected_cash numeric(14,2) not null default 0, counted_cash numeric(14,2), variance numeric(14,2), status text not null default 'open' check (status in ('open','closed','review')), opened_at timestamptz not null default now(), closed_at timestamptz, notes text
);

create index if not exists aqan_suppliers_org_status_idx on public.aqan_suppliers (organization_id, status);
create index if not exists aqan_po_org_status_idx on public.aqan_purchase_orders (organization_id, status, created_at desc);
create index if not exists aqan_po_items_po_idx on public.aqan_purchase_order_items (purchase_order_id);
create index if not exists aqan_batches_product_expiry_idx on public.aqan_stock_batches (organization_id, product_id, expiry_date);
create index if not exists aqan_transfers_org_status_idx on public.aqan_stock_transfers (organization_id, status, created_at desc);
create index if not exists aqan_cash_sessions_org_status_idx on public.aqan_cash_sessions (organization_id, status, opened_at desc);

alter table public.aqan_suppliers enable row level security;
alter table public.aqan_warehouses enable row level security;
alter table public.aqan_purchase_orders enable row level security;
alter table public.aqan_purchase_order_items enable row level security;
alter table public.aqan_goods_receipts enable row level security;
alter table public.aqan_stock_batches enable row level security;
alter table public.aqan_stock_transfers enable row level security;
alter table public.aqan_cash_sessions enable row level security;

create policy aqan_suppliers_member on public.aqan_suppliers for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_suppliers_staff_write on public.aqan_suppliers for all to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales'])) with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_warehouses_member on public.aqan_warehouses for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_warehouses_admin_write on public.aqan_warehouses for all to authenticated using (private.aqan_has_role(organization_id, array['owner','admin'])) with check (private.aqan_has_role(organization_id, array['owner','admin']));
create policy aqan_po_member on public.aqan_purchase_orders for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_po_staff_write on public.aqan_purchase_orders for all to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales'])) with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_po_items_member on public.aqan_purchase_order_items for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_po_items_staff_write on public.aqan_purchase_order_items for all to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales'])) with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_grn_member on public.aqan_goods_receipts for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_grn_staff_write on public.aqan_goods_receipts for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin','sales','service']));
create policy aqan_batches_member on public.aqan_stock_batches for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_batches_staff_write on public.aqan_stock_batches for all to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service'])) with check (private.aqan_has_role(organization_id, array['owner','admin','sales','service']));
create policy aqan_transfers_member on public.aqan_stock_transfers for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_transfers_staff_write on public.aqan_stock_transfers for all to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service'])) with check (private.aqan_has_role(organization_id, array['owner','admin','sales','service']));
create policy aqan_cash_member on public.aqan_cash_sessions for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','viewer']));
create policy aqan_cash_staff_write on public.aqan_cash_sessions for all to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales'])) with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));

grant select, insert, update, delete on public.aqan_suppliers, public.aqan_warehouses, public.aqan_purchase_orders, public.aqan_purchase_order_items, public.aqan_goods_receipts, public.aqan_stock_batches, public.aqan_stock_transfers, public.aqan_cash_sessions to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('aqan-branding','aqan-branding',true,2097152,array['image/png','image/jpeg','image/webp','image/svg+xml']) on conflict (id) do nothing;
create policy aqan_branding_read on storage.objects for select to authenticated using (bucket_id='aqan-branding');
create policy aqan_branding_admin_write on storage.objects for all to authenticated using (bucket_id='aqan-branding' and private.aqan_can_manage_product_image(name)) with check (bucket_id='aqan-branding' and private.aqan_can_manage_product_image(name));
