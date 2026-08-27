-- Operational backbone: company settings, commercial terms, dispatch and gate control.

create sequence if not exists public.aqan_delivery_number_seq start 1;
create sequence if not exists public.aqan_gate_number_seq start 1;

create table if not exists public.aqan_business_settings (
  organization_id uuid primary key references public.aqan_organizations(id) on delete cascade,
  legal_name text not null default 'AQAN Biomedical',
  trading_name text,
  address text,
  phone text,
  email text,
  tin text,
  vrn text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_branch text,
  payment_terms text not null default 'Payment is due within 14 days of invoice date unless otherwise agreed in writing.',
  quotation_terms text not null default 'Prices are in Tanzanian shillings and exclude delivery unless stated. Availability is subject to prior sale. Installation, commissioning and warranty terms are stated on the quotation.',
  delivery_terms text not null default 'Please inspect goods on delivery. Signing confirms receipt of the listed items in good order, subject to any written exceptions.',
  invoice_footer text,
  vat_rate numeric(5,2) not null default 18 check (vat_rate between 0 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.aqan_quotations
  add column if not exists payment_terms text,
  add column if not exists quotation_terms text,
  add column if not exists delivery_terms text,
  add column if not exists bank_details_snapshot text;

create table if not exists public.aqan_delivery_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  delivery_number text not null unique default ('AQN-DN-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.aqan_delivery_number_seq')::text, 5, '0')),
  sale_id uuid not null references public.aqan_sales(id) on delete restrict,
  customer_id uuid references public.aqan_customers(id) on delete set null,
  recipient_name text not null,
  recipient_phone text,
  delivery_address text,
  driver_name text,
  vehicle_number text,
  status text not null default 'prepared' check (status in ('prepared','out_for_delivery','delivered','returned','cancelled')),
  notes text,
  received_by_name text,
  receiver_signature text,
  received_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sale_id)
);

create table if not exists public.aqan_delivery_note_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  delivery_note_id uuid not null references public.aqan_delivery_notes(id) on delete cascade,
  product_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.aqan_gate_passes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  pass_number text not null unique default ('AQN-GP-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.aqan_gate_number_seq')::text, 5, '0')),
  delivery_note_id uuid references public.aqan_delivery_notes(id) on delete set null,
  vehicle_number text not null,
  driver_name text not null,
  driver_phone text,
  purpose text not null,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  status text not null default 'open' check (status in ('open','cleared','cancelled')),
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists aqan_delivery_notes_org_created_idx on public.aqan_delivery_notes (organization_id, created_at desc);
create index if not exists aqan_gate_passes_org_status_idx on public.aqan_gate_passes (organization_id, status, check_in_at desc);

alter table public.aqan_business_settings enable row level security;
alter table public.aqan_delivery_notes enable row level security;
alter table public.aqan_delivery_note_items enable row level security;
alter table public.aqan_gate_passes enable row level security;

create policy aqan_business_settings_member_select on public.aqan_business_settings for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_business_settings_admin_write on public.aqan_business_settings for all to authenticated using (private.aqan_has_role(organization_id, array['owner','admin'])) with check (private.aqan_has_role(organization_id, array['owner','admin']));
create policy aqan_delivery_notes_member_select on public.aqan_delivery_notes for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_delivery_notes_staff_write on public.aqan_delivery_notes for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin','sales','service']));
create policy aqan_delivery_notes_staff_update on public.aqan_delivery_notes for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service'])) with check (private.aqan_has_role(organization_id, array['owner','admin','sales','service']));
create policy aqan_delivery_items_member_select on public.aqan_delivery_note_items for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_gate_passes_member_select on public.aqan_gate_passes for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_gate_passes_staff_write on public.aqan_gate_passes for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin','sales','service']));
create policy aqan_gate_passes_staff_update on public.aqan_gate_passes for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service'])) with check (private.aqan_has_role(organization_id, array['owner','admin','sales','service']));

grant select, insert, update on public.aqan_business_settings, public.aqan_delivery_notes, public.aqan_delivery_note_items, public.aqan_gate_passes to authenticated;

create or replace function public.aqan_create_delivery_note(p_sale_id uuid, p_recipient_name text, p_recipient_phone text default null, p_delivery_address text default null, p_driver_name text default null, p_vehicle_number text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p_org uuid; p_customer uuid; p_note_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select organization_id, customer_id into p_org, p_customer from public.aqan_sales where id=p_sale_id;
  if p_org is null or not private.aqan_has_role(p_org, array['owner','admin','sales','service']) then raise exception 'Not permitted'; end if;
  if nullif(trim(p_recipient_name),'') is null then raise exception 'Recipient name is required'; end if;
  insert into public.aqan_delivery_notes (organization_id,sale_id,customer_id,recipient_name,recipient_phone,delivery_address,driver_name,vehicle_number,notes,created_by)
  values (p_org,p_sale_id,p_customer,trim(p_recipient_name),nullif(trim(p_recipient_phone),''),nullif(trim(p_delivery_address),''),nullif(trim(p_driver_name),''),nullif(trim(p_vehicle_number),''),nullif(trim(p_notes),''),(select auth.uid())) returning id into p_note_id;
  insert into public.aqan_delivery_note_items (organization_id,delivery_note_id,product_name,sku,quantity)
  select p_org,p_note_id,product_name,sku,quantity from public.aqan_sale_items where sale_id=p_sale_id;
  return p_note_id;
end; $$;
revoke all on function public.aqan_create_delivery_note(uuid,text,text,text,text,text,text) from public, anon;
grant execute on function public.aqan_create_delivery_note(uuid,text,text,text,text,text,text) to authenticated;
