-- AQAN BIOMEDICAL POS
-- Secure multi-user data model for sales, stock, CRM, quotations, service and outreach.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.aqan_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  currency text not null default 'TZS',
  vat_rate numeric(5,4) not null default 0.1800 check (vat_rate between 0 and 1),
  timezone text not null default 'Africa/Dar_es_Salaam',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.aqan_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.aqan_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'sales', 'service', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.aqan_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.aqan_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  category text not null,
  description text,
  price numeric(14,2) not null check (price >= 0),
  cost numeric(14,2) not null default 0 check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  reorder_level integer not null default 5 check (reorder_level >= 0),
  serial_tracked boolean not null default false,
  active boolean not null default true,
  color text not null default '#dff4ff',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table public.aqan_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  name text not null,
  customer_type text not null default 'Clinic' check (customer_type in ('Hospital', 'Clinic', 'Diagnostic centre', 'Pharmacy', 'NGO', 'Distributor', 'Walk-in')),
  contact_name text,
  email text,
  phone text,
  city text not null default 'Dar es Salaam',
  address text,
  tax_number text,
  total_spend numeric(14,2) not null default 0,
  last_purchase_at timestamptz,
  status text not null default 'active' check (status in ('active', 'lead', 'inactive')),
  marketing_consent boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index aqan_customers_org_email_key
  on public.aqan_customers (organization_id, lower(email))
  where email is not null;

create sequence public.aqan_invoice_number_seq start 1049;
create sequence public.aqan_quote_number_seq start 393;
create sequence public.aqan_service_number_seq start 129;

create table public.aqan_sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  invoice_number text not null unique default ('AQN-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('public.aqan_invoice_number_seq')::text, 5, '0')),
  customer_id uuid references public.aqan_customers(id) on delete set null,
  subtotal numeric(14,2) not null check (subtotal >= 0),
  vat_amount numeric(14,2) not null check (vat_amount >= 0),
  total numeric(14,2) not null check (total >= 0),
  status text not null default 'paid' check (status in ('draft', 'pending', 'paid', 'void', 'refunded')),
  customer_name_snapshot text,
  customer_phone_snapshot text,
  customer_email_snapshot text,
  notes text,
  invoice_storage_path text,
  invoice_generated_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.aqan_sale_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  sale_id uuid not null references public.aqan_sales(id) on delete cascade,
  product_id uuid not null references public.aqan_products(id) on delete restrict,
  product_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table public.aqan_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  sale_id uuid not null references public.aqan_sales(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('cash', 'card', 'mobile_money', 'bank_transfer', 'credit')),
  mobile_provider text check (mobile_provider is null or mobile_provider in ('m_pesa', 'airtel_money', 'tigo_pesa', 'halopesa', 'mixx_by_yas', 'other')),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'refunded')),
  reference text,
  received_by uuid references auth.users(id) on delete set null,
  received_at timestamptz not null default now()
);

create table public.aqan_quotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  quote_number text not null unique default ('AQN-QT-' || lpad(nextval('public.aqan_quote_number_seq')::text, 4, '0')),
  customer_id uuid not null references public.aqan_customers(id) on delete restrict,
  subtotal numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  notes text,
  valid_until date not null default (current_date + 14),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.aqan_quotation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  quotation_id uuid not null references public.aqan_quotations(id) on delete cascade,
  product_id uuid references public.aqan_products(id) on delete set null,
  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  line_total numeric(14,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create table public.aqan_equipment_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  customer_id uuid not null references public.aqan_customers(id) on delete cascade,
  product_id uuid references public.aqan_products(id) on delete set null,
  sale_id uuid references public.aqan_sales(id) on delete set null,
  serial_number text not null,
  equipment_name text not null,
  installed_at date,
  warranty_expires_at date,
  next_service_at date,
  status text not null default 'active' check (status in ('active', 'under_service', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, serial_number)
);

create table public.aqan_service_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  request_number text not null unique default ('AQN-SR-' || lpad(nextval('public.aqan_service_number_seq')::text, 4, '0')),
  customer_id uuid not null references public.aqan_customers(id) on delete restrict,
  equipment_asset_id uuid references public.aqan_equipment_assets(id) on delete set null,
  equipment_name text not null,
  serial_number text,
  issue text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  status text not null default 'scheduled' check (status in ('new', 'scheduled', 'in_progress', 'resolved', 'cancelled')),
  scheduled_for timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.aqan_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  name text not null,
  channel text not null default 'whatsapp_email' check (channel in ('whatsapp', 'email', 'sms', 'whatsapp_email')),
  message text not null,
  status text not null default 'draft' check (status in ('draft', 'queued', 'sending', 'completed', 'cancelled')),
  audience_count integer not null default 0,
  sent_count integer not null default 0,
  opened_count integer not null default 0,
  replied_count integer not null default 0,
  product_id uuid references public.aqan_products(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.aqan_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  campaign_id uuid not null references public.aqan_campaigns(id) on delete cascade,
  customer_id uuid not null references public.aqan_customers(id) on delete cascade,
  delivery_status text not null default 'queued' check (delivery_status in ('queued', 'sent', 'delivered', 'opened', 'replied', 'failed', 'opted_out')),
  provider_message_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  unique (campaign_id, customer_id)
);

create table public.aqan_activity_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- CRM records may be imported from AQAN's existing CRM without exposing that system directly.
create table public.aqan_crm_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  external_id text,
  facility_name text not null,
  contact_name text,
  email text,
  phone text,
  city text,
  specialty text,
  lead_status text not null default 'new' check (lead_status in ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'nurture')),
  lead_score integer not null default 0 check (lead_score between 0 and 100),
  estimated_value numeric(14,2) not null default 0 check (estimated_value >= 0),
  last_contact_at timestamptz,
  next_action_at timestamptz,
  notes text,
  source text default 'crm_import',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_id)
);

create index aqan_products_org_stock_idx on public.aqan_products (organization_id, stock);
create index aqan_products_low_stock_idx on public.aqan_products (organization_id, stock, reorder_level) where active;
create index aqan_customers_org_name_idx on public.aqan_customers (organization_id, name);
create index aqan_customers_campaign_audience_idx on public.aqan_customers (organization_id, customer_type) where marketing_consent and status = 'active';
create index aqan_sales_org_sold_at_idx on public.aqan_sales (organization_id, sold_at desc);
create index aqan_quotes_org_status_idx on public.aqan_quotations (organization_id, status, created_at desc);
create index aqan_service_org_status_idx on public.aqan_service_requests (organization_id, status, scheduled_for);
create index aqan_campaigns_org_created_idx on public.aqan_campaigns (organization_id, created_at desc);
create index aqan_activity_org_created_idx on public.aqan_activity_log (organization_id, created_at desc);
create index aqan_memberships_user_idx on public.aqan_memberships (user_id);
create index aqan_access_requests_user_idx on public.aqan_access_requests (user_id);
create index aqan_access_requests_reviewed_by_idx on public.aqan_access_requests (reviewed_by) where reviewed_by is not null;
create index aqan_products_created_by_idx on public.aqan_products (created_by) where created_by is not null;
create index aqan_customers_created_by_idx on public.aqan_customers (created_by) where created_by is not null;
create index aqan_sales_customer_idx on public.aqan_sales (customer_id) where customer_id is not null;
create index aqan_sales_created_by_idx on public.aqan_sales (created_by);
create index aqan_sale_items_sale_idx on public.aqan_sale_items (sale_id);
create index aqan_sale_items_product_idx on public.aqan_sale_items (product_id);
create index aqan_sale_items_org_idx on public.aqan_sale_items (organization_id);
create index aqan_payments_sale_idx on public.aqan_payments (sale_id);
create index aqan_payments_received_by_idx on public.aqan_payments (received_by) where received_by is not null;
create index aqan_payments_org_idx on public.aqan_payments (organization_id);
create index aqan_quotations_customer_idx on public.aqan_quotations (customer_id);
create index aqan_quotations_created_by_idx on public.aqan_quotations (created_by) where created_by is not null;
create index aqan_quotation_items_quote_idx on public.aqan_quotation_items (quotation_id);
create index aqan_quotation_items_product_idx on public.aqan_quotation_items (product_id) where product_id is not null;
create index aqan_quotation_items_org_idx on public.aqan_quotation_items (organization_id);
create index aqan_assets_customer_idx on public.aqan_equipment_assets (customer_id);
create index aqan_assets_product_idx on public.aqan_equipment_assets (product_id) where product_id is not null;
create index aqan_assets_sale_idx on public.aqan_equipment_assets (sale_id) where sale_id is not null;
create index aqan_service_customer_idx on public.aqan_service_requests (customer_id);
create index aqan_service_asset_idx on public.aqan_service_requests (equipment_asset_id) where equipment_asset_id is not null;
create index aqan_service_assigned_to_idx on public.aqan_service_requests (assigned_to) where assigned_to is not null;
create index aqan_service_created_by_idx on public.aqan_service_requests (created_by) where created_by is not null;
create index aqan_campaigns_product_idx on public.aqan_campaigns (product_id) where product_id is not null;
create index aqan_campaigns_created_by_idx on public.aqan_campaigns (created_by) where created_by is not null;
create index aqan_campaign_recipients_customer_idx on public.aqan_campaign_recipients (customer_id);
create index aqan_campaign_recipients_org_idx on public.aqan_campaign_recipients (organization_id);
create index aqan_activity_actor_idx on public.aqan_activity_log (actor_id) where actor_id is not null;
create index aqan_crm_leads_org_status_score_idx on public.aqan_crm_leads (organization_id, lead_status, lead_score desc);
create index aqan_crm_leads_org_next_action_idx on public.aqan_crm_leads (organization_id, next_action_at) where next_action_at is not null;

create or replace function private.aqan_has_role(p_organization_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.aqan_memberships membership
      where membership.organization_id = p_organization_id
        and membership.user_id = (select auth.uid())
        and membership.role = any (p_roles)
    );
$$;

revoke all on function private.aqan_has_role(uuid, text[]) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.aqan_has_role(uuid, text[]) to authenticated;

create or replace function private.aqan_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.aqan_touch_updated_at() from public, anon, authenticated;

create trigger aqan_organizations_touch before update on public.aqan_organizations for each row execute function private.aqan_touch_updated_at();
create trigger aqan_profiles_touch before update on public.aqan_profiles for each row execute function private.aqan_touch_updated_at();
create trigger aqan_products_touch before update on public.aqan_products for each row execute function private.aqan_touch_updated_at();
create trigger aqan_customers_touch before update on public.aqan_customers for each row execute function private.aqan_touch_updated_at();
create trigger aqan_quotations_touch before update on public.aqan_quotations for each row execute function private.aqan_touch_updated_at();
create trigger aqan_assets_touch before update on public.aqan_equipment_assets for each row execute function private.aqan_touch_updated_at();
create trigger aqan_service_touch before update on public.aqan_service_requests for each row execute function private.aqan_touch_updated_at();
create trigger aqan_campaigns_touch before update on public.aqan_campaigns for each row execute function private.aqan_touch_updated_at();
create trigger aqan_crm_leads_touch before update on public.aqan_crm_leads for each row execute function private.aqan_touch_updated_at();

create or replace function public.aqan_current_membership()
returns table (organization_id uuid, organization_name text, role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  return query
  select organization.id, organization.name, membership.role
  from public.aqan_memberships membership
  join public.aqan_organizations organization on organization.id = membership.organization_id
  where membership.user_id = (select auth.uid())
  order by membership.created_at
  limit 1;
end;
$$;

revoke all on function public.aqan_current_membership() from public, anon, authenticated;
grant execute on function public.aqan_current_membership() to authenticated;

create or replace function public.aqan_request_access(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  caller_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_full_name), '') is null or length(trim(p_full_name)) > 120 then
    raise exception 'A valid full name is required';
  end if;

  select id into target_organization_id
  from public.aqan_organizations
  where slug = 'aqan-biomedical'
  limit 1;

  select email into caller_email from auth.users where id = (select auth.uid());

  insert into public.aqan_profiles (id, full_name)
  values ((select auth.uid()), trim(p_full_name))
  on conflict (id) do update set full_name = excluded.full_name;

  insert into public.aqan_access_requests (organization_id, user_id, full_name, email)
  values (target_organization_id, (select auth.uid()), trim(p_full_name), caller_email)
  on conflict (organization_id, user_id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        status = case when public.aqan_access_requests.status = 'declined' then 'pending' else public.aqan_access_requests.status end;
end;
$$;

revoke all on function public.aqan_request_access(text) from public, anon, authenticated;
grant execute on function public.aqan_request_access(text) to authenticated;

-- The very first authenticated AQAN staff member becomes the owner. Afterwards only an
-- existing owner/admin can grant access, preventing open self-escalation.
create or replace function public.aqan_claim_first_owner(p_full_name text)
returns table (organization_id uuid, organization_name text, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_full_name), '') is null or length(trim(p_full_name)) > 120 then
    raise exception 'A valid full name is required';
  end if;
  select id into target_organization_id from public.aqan_organizations where slug = 'aqan-biomedical';
  perform pg_advisory_xact_lock(hashtextextended('aqan-first-owner', 0));
  if exists (select 1 from public.aqan_memberships where organization_id = target_organization_id) then
    raise exception 'An AQAN owner already exists. Request workspace access instead.';
  end if;
  insert into public.aqan_profiles (id, full_name) values ((select auth.uid()), trim(p_full_name))
  on conflict (id) do update set full_name = excluded.full_name;
  insert into public.aqan_memberships (organization_id, user_id, role)
  values (target_organization_id, (select auth.uid()), 'owner');
  return query select organization.id, organization.name, 'owner'::text
  from public.aqan_organizations organization where organization.id = target_organization_id;
end;
$$;
revoke all on function public.aqan_claim_first_owner(text) from public, anon, authenticated;
grant execute on function public.aqan_claim_first_owner(text) to authenticated;

create or replace function public.aqan_complete_sale(
  p_customer_id uuid,
  p_payment_method text,
  p_items jsonb,
  p_payment_provider text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  caller_role text;
  organization_vat numeric(5,4);
  requested_count integer;
  matched_count integer;
  sale_subtotal numeric(14,2);
  sale_vat numeric(14,2);
  sale_total numeric(14,2);
  new_sale_id uuid;
  new_invoice_number text;
  resolved_customer_id uuid;
  resolved_customer_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select membership.organization_id, membership.role, organization.vat_rate
    into target_organization_id, caller_role, organization_vat
  from public.aqan_memberships membership
  join public.aqan_organizations organization on organization.id = membership.organization_id
  where membership.user_id = (select auth.uid())
  order by membership.created_at
  limit 1;

  if target_organization_id is null or caller_role not in ('owner', 'admin', 'sales') then
    raise exception 'You do not have permission to complete sales';
  end if;

  if p_payment_method not in ('cash', 'card', 'mobile_money', 'bank_transfer', 'credit') then
    raise exception 'Unsupported payment method';
  end if;
  if p_payment_method = 'mobile_money' and p_payment_provider not in ('m_pesa', 'airtel_money', 'tigo_pesa', 'halopesa', 'mixx_by_yas', 'other') then
    raise exception 'Choose the mobile money provider used for this payment';
  end if;
  if p_payment_method <> 'mobile_money' then p_payment_provider := null; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Sale must contain between 1 and 100 line items';
  end if;

  with requested as (
    select product_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    group by product_id
  )
  select count(*) into requested_count from requested where quantity > 0;

  if requested_count <> jsonb_array_length(p_items) then
    raise exception 'Each product must appear once with a positive quantity';
  end if;

  perform product.id
  from public.aqan_products product
  join jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer) on item.product_id = product.id
  where product.organization_id = target_organization_id
  order by product.id
  for update of product;

  with requested as (
    select product_id, quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
  )
  select count(*), coalesce(sum(product.price * requested.quantity), 0)
    into matched_count, sale_subtotal
  from requested
  join public.aqan_products product on product.id = requested.product_id
  where product.organization_id = target_organization_id
    and product.active
    and product.stock >= requested.quantity;

  if matched_count <> requested_count then
    raise exception 'One or more products are unavailable or have insufficient stock';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.aqan_customers
    where id = p_customer_id and organization_id = target_organization_id
  ) then
    raise exception 'Customer is not part of this workspace';
  end if;

  resolved_customer_id := p_customer_id;
  if resolved_customer_id is null and nullif(trim(coalesce(p_customer_name, '')), '') is not null then
    select id, name into resolved_customer_id, resolved_customer_name
    from public.aqan_customers
    where organization_id = target_organization_id
      and ((nullif(trim(p_customer_phone), '') is not null and phone = trim(p_customer_phone))
        or (nullif(trim(p_customer_email), '') is not null and lower(email) = lower(trim(p_customer_email)))
        or name = trim(p_customer_name))
    order by created_at limit 1;
    if resolved_customer_id is null then
      insert into public.aqan_customers (organization_id, name, customer_type, contact_name, email, phone, created_by)
      values (target_organization_id, trim(p_customer_name), 'Walk-in', trim(p_customer_name), nullif(trim(p_customer_email), ''), nullif(trim(p_customer_phone), ''), (select auth.uid()))
      returning id, name into resolved_customer_id, resolved_customer_name;
    else
      update public.aqan_customers set
        phone = coalesce(nullif(trim(p_customer_phone), ''), phone),
        email = coalesce(nullif(trim(p_customer_email), ''), email)
      where id = resolved_customer_id;
    end if;
  end if;

  select name into resolved_customer_name from public.aqan_customers where id = resolved_customer_id;

  sale_vat := round(sale_subtotal * organization_vat, 2);
  sale_total := sale_subtotal + sale_vat;

  insert into public.aqan_sales (
    organization_id, customer_id, subtotal, vat_amount, total, status, customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot, created_by
  ) values (
    target_organization_id, resolved_customer_id, sale_subtotal, sale_vat, sale_total, 'paid', coalesce(resolved_customer_name, nullif(trim(p_customer_name), ''), 'Walk-in medical buyer'), nullif(trim(p_customer_phone), ''), nullif(trim(p_customer_email), ''), (select auth.uid())
  ) returning id, invoice_number into new_sale_id, new_invoice_number;

  insert into public.aqan_sale_items (
    organization_id, sale_id, product_id, product_name, sku, quantity, unit_price, line_total
  )
  select target_organization_id, new_sale_id, product.id, product.name, product.sku,
    item.quantity, product.price, product.price * item.quantity
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
  join public.aqan_products product on product.id = item.product_id;

  update public.aqan_products product
  set stock = product.stock - requested.quantity
  from (
    select product_id, quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
  ) requested
  where product.id = requested.product_id;

  insert into public.aqan_payments (
    organization_id, sale_id, amount, method, mobile_provider, status, received_by
  ) values (
    target_organization_id, new_sale_id, sale_total, p_payment_method, p_payment_provider, 'completed', (select auth.uid())
  );

  if resolved_customer_id is not null then
    update public.aqan_customers
    set total_spend = total_spend + sale_total, last_purchase_at = now()
    where id = resolved_customer_id and organization_id = target_organization_id;
  end if;

  insert into public.aqan_activity_log (organization_id, actor_id, action, entity_type, entity_id, detail)
  values (
    target_organization_id,
    (select auth.uid()),
    'sale.completed',
    'sale',
    new_sale_id,
    jsonb_build_object('invoice_number', new_invoice_number, 'total', sale_total, 'payment_method', p_payment_method)
  );

  return jsonb_build_object('sale_id', new_sale_id, 'invoice_number', new_invoice_number, 'total', sale_total);
end;
$$;

revoke all on function public.aqan_complete_sale(uuid, text, jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function public.aqan_complete_sale(uuid, text, jsonb, text, text, text, text) to authenticated;

alter table public.aqan_organizations enable row level security;
alter table public.aqan_profiles enable row level security;
alter table public.aqan_memberships enable row level security;
alter table public.aqan_access_requests enable row level security;
alter table public.aqan_products enable row level security;
alter table public.aqan_customers enable row level security;
alter table public.aqan_sales enable row level security;
alter table public.aqan_sale_items enable row level security;
alter table public.aqan_payments enable row level security;
alter table public.aqan_quotations enable row level security;
alter table public.aqan_quotation_items enable row level security;
alter table public.aqan_equipment_assets enable row level security;
alter table public.aqan_service_requests enable row level security;
alter table public.aqan_campaigns enable row level security;
alter table public.aqan_campaign_recipients enable row level security;
alter table public.aqan_activity_log enable row level security;
alter table public.aqan_crm_leads enable row level security;

create policy aqan_organizations_member_select on public.aqan_organizations
  for select to authenticated using (private.aqan_has_role(id, array['owner','admin','sales','service','viewer']));
create policy aqan_organizations_admin_update on public.aqan_organizations
  for update to authenticated using (private.aqan_has_role(id, array['owner','admin']))
  with check (private.aqan_has_role(id, array['owner','admin']));

create policy aqan_profiles_self_select on public.aqan_profiles
  for select to authenticated using (id = (select auth.uid()));
create policy aqan_profiles_self_update on public.aqan_profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy aqan_memberships_member_select on public.aqan_memberships
  for select to authenticated using (
    user_id = (select auth.uid()) or private.aqan_has_role(organization_id, array['owner','admin'])
  );
create policy aqan_memberships_admin_insert on public.aqan_memberships
  for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin']));
create policy aqan_memberships_admin_update on public.aqan_memberships
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin']))
  with check (private.aqan_has_role(organization_id, array['owner','admin']));
create policy aqan_memberships_owner_delete on public.aqan_memberships
  for delete to authenticated using (private.aqan_has_role(organization_id, array['owner']));

create policy aqan_access_requests_self_select on public.aqan_access_requests
  for select to authenticated using (user_id = (select auth.uid()) or private.aqan_has_role(organization_id, array['owner','admin']));
create policy aqan_access_requests_admin_update on public.aqan_access_requests
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin']))
  with check (private.aqan_has_role(organization_id, array['owner','admin']));

create policy aqan_products_member_select on public.aqan_products
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_products_admin_insert on public.aqan_products
  for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin']));
create policy aqan_products_admin_update on public.aqan_products
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin']))
  with check (private.aqan_has_role(organization_id, array['owner','admin']));
create policy aqan_products_owner_delete on public.aqan_products
  for delete to authenticated using (private.aqan_has_role(organization_id, array['owner']));

create policy aqan_customers_member_select on public.aqan_customers
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_customers_sales_insert on public.aqan_customers
  for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_customers_sales_update on public.aqan_customers
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales']))
  with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_customers_admin_delete on public.aqan_customers
  for delete to authenticated using (private.aqan_has_role(organization_id, array['owner','admin']));

create policy aqan_sales_member_select on public.aqan_sales
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','viewer']));
create policy aqan_sales_admin_update on public.aqan_sales
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin']))
  with check (private.aqan_has_role(organization_id, array['owner','admin']));
create policy aqan_sales_owner_delete on public.aqan_sales
  for delete to authenticated using (private.aqan_has_role(organization_id, array['owner']));

create policy aqan_sale_items_member_select on public.aqan_sale_items
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','viewer']));
create policy aqan_payments_member_select on public.aqan_payments
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','viewer']));

create policy aqan_quotations_member_select on public.aqan_quotations
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','viewer']));
create policy aqan_quotations_sales_insert on public.aqan_quotations
  for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_quotations_sales_update on public.aqan_quotations
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales']))
  with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_quotations_admin_delete on public.aqan_quotations
  for delete to authenticated using (private.aqan_has_role(organization_id, array['owner','admin']));

create policy aqan_quote_items_member_select on public.aqan_quotation_items
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','viewer']));
create policy aqan_quote_items_sales_insert on public.aqan_quotation_items
  for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_quote_items_sales_update on public.aqan_quotation_items
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales']))
  with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_quote_items_admin_delete on public.aqan_quotation_items
  for delete to authenticated using (private.aqan_has_role(organization_id, array['owner','admin']));

create policy aqan_assets_member_select on public.aqan_equipment_assets
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_assets_staff_insert on public.aqan_equipment_assets
  for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin','service']));
create policy aqan_assets_staff_update on public.aqan_equipment_assets
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','service']))
  with check (private.aqan_has_role(organization_id, array['owner','admin','service']));
create policy aqan_assets_admin_delete on public.aqan_equipment_assets
  for delete to authenticated using (private.aqan_has_role(organization_id, array['owner','admin']));

create policy aqan_service_member_select on public.aqan_service_requests
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));
create policy aqan_service_staff_insert on public.aqan_service_requests
  for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin','service']));
create policy aqan_service_staff_update on public.aqan_service_requests
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','service']))
  with check (private.aqan_has_role(organization_id, array['owner','admin','service']));
create policy aqan_service_admin_delete on public.aqan_service_requests
  for delete to authenticated using (private.aqan_has_role(organization_id, array['owner','admin']));

create policy aqan_campaigns_member_select on public.aqan_campaigns
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','viewer']));
create policy aqan_campaigns_sales_insert on public.aqan_campaigns
  for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_campaigns_sales_update on public.aqan_campaigns
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales']))
  with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_campaigns_admin_delete on public.aqan_campaigns
  for delete to authenticated using (private.aqan_has_role(organization_id, array['owner','admin']));

create policy aqan_campaign_recipients_member_select on public.aqan_campaign_recipients
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','viewer']));
create policy aqan_campaign_recipients_sales_insert on public.aqan_campaign_recipients
  for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_campaign_recipients_sales_update on public.aqan_campaign_recipients
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales']))
  with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));

create policy aqan_activity_member_select on public.aqan_activity_log
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','service','viewer']));

create policy aqan_crm_leads_member_select on public.aqan_crm_leads
  for select to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales','viewer']));
create policy aqan_crm_leads_sales_insert on public.aqan_crm_leads
  for insert to authenticated with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_crm_leads_sales_update on public.aqan_crm_leads
  for update to authenticated using (private.aqan_has_role(organization_id, array['owner','admin','sales']))
  with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));
create policy aqan_crm_leads_admin_delete on public.aqan_crm_leads
  for delete to authenticated using (private.aqan_has_role(organization_id, array['owner','admin']));

revoke all on table
  public.aqan_organizations,
  public.aqan_profiles,
  public.aqan_memberships,
  public.aqan_access_requests,
  public.aqan_products,
  public.aqan_customers,
  public.aqan_sales,
  public.aqan_sale_items,
  public.aqan_payments,
  public.aqan_quotations,
  public.aqan_quotation_items,
  public.aqan_equipment_assets,
  public.aqan_service_requests,
  public.aqan_campaigns,
  public.aqan_campaign_recipients,
  public.aqan_activity_log,
  public.aqan_crm_leads
from anon, authenticated;
revoke all on sequence
  public.aqan_invoice_number_seq,
  public.aqan_quote_number_seq,
  public.aqan_service_number_seq
from anon, authenticated;

grant select, update on public.aqan_organizations to authenticated;
grant select, update on public.aqan_profiles to authenticated;
grant select, insert, update, delete on public.aqan_memberships to authenticated;
grant select, update on public.aqan_access_requests to authenticated;
grant select, insert, update, delete on public.aqan_products to authenticated;
grant select, insert, update, delete on public.aqan_customers to authenticated;
grant select, update, delete on public.aqan_sales to authenticated;
grant select on public.aqan_sale_items to authenticated;
grant select on public.aqan_payments to authenticated;
grant select, insert, update, delete on public.aqan_quotations to authenticated;
grant select, insert, update, delete on public.aqan_quotation_items to authenticated;
grant select, insert, update, delete on public.aqan_equipment_assets to authenticated;
grant select, insert, update, delete on public.aqan_service_requests to authenticated;
grant select, insert, update, delete on public.aqan_campaigns to authenticated;
grant select, insert, update on public.aqan_campaign_recipients to authenticated;
grant select on public.aqan_activity_log to authenticated;
grant select, insert, update, delete on public.aqan_crm_leads to authenticated;
grant usage, select on sequence public.aqan_quote_number_seq to authenticated;
grant usage, select on sequence public.aqan_service_number_seq to authenticated;

insert into public.aqan_organizations (name, slug)
values ('AQAN Biomedical', 'aqan-biomedical')
on conflict (slug) do update set name = excluded.name;

with organization as (
  select id from public.aqan_organizations where slug = 'aqan-biomedical'
), seed (sku, name, category, price, cost, stock, reorder_level, serial_tracked, color) as (
  values
    ('PM-X12', 'Patient Monitor X12', 'Monitoring', 2850000::numeric, 2140000::numeric, 12, 5, true, '#dff4ff'),
    ('US-U8', 'Portable Ultrasound U8', 'Imaging', 12400000::numeric, 9650000::numeric, 4, 3, true, '#e8efff'),
    ('IP-IP5', 'Infusion Pump IP5', 'Critical care', 1750000::numeric, 1290000::numeric, 18, 8, true, '#e1f8f2'),
    ('OC-10L', 'Oxygen Concentrator 10L', 'Respiratory', 2100000::numeric, 1580000::numeric, 7, 5, true, '#f0ecff'),
    ('EC-E6', 'ECG Machine E6', 'Diagnostics', 4650000::numeric, 3520000::numeric, 5, 4, true, '#fff2e6'),
    ('SS-S3', 'Surgical Suction S3', 'Theatre', 980000::numeric, 710000::numeric, 21, 6, true, '#e6f5ff'),
    ('UG-5L', 'Ultrasound Gel 5L', 'Consumables', 68000::numeric, 41000::numeric, 8, 10, false, '#eef8ff'),
    ('EC-P80', 'ECG Paper 80mm', 'Consumables', 45000::numeric, 26000::numeric, 12, 15, false, '#ecf8f4')
)
insert into public.aqan_products (organization_id, sku, name, category, price, cost, stock, reorder_level, serial_tracked, color)
select organization.id, seed.sku, seed.name, seed.category, seed.price, seed.cost, seed.stock, seed.reorder_level, seed.serial_tracked, seed.color
from organization cross join seed
on conflict (organization_id, sku) do nothing;

with organization as (
  select id from public.aqan_organizations where slug = 'aqan-biomedical'
), seed (name, customer_type, contact_name, email, phone, city, total_spend, status, marketing_consent) as (
  values
    ('Bugando Medical Centre', 'Hospital', 'Dr. Asha M.', 'procurement@bugando.example', '+255 754 000 101', 'Mwanza', 28400000::numeric, 'active', true),
    ('Kairuki Hospital', 'Hospital', 'Janeth K.', 'supplies@kairuki.example', '+255 754 000 102', 'Dar es Salaam', 22150000::numeric, 'active', true),
    ('Marie Stopes Tanzania', 'NGO', 'Rehema S.', 'medical@mst.example', '+255 754 000 103', 'Dar es Salaam', 17400000::numeric, 'active', true),
    ('Lake Zone Diagnostics', 'Diagnostic centre', 'Peter N.', 'lab@lakezone.example', '+255 754 000 104', 'Mwanza', 12800000::numeric, 'active', true),
    ('Tumaini Regional Clinic', 'Clinic', 'Dr. Halima R.', 'admin@tumaini.example', '+255 754 000 105', 'Dodoma', 8700000::numeric, 'active', true),
    ('Upendo Health Centre', 'Clinic', 'Joseph M.', 'care@upendo.example', '+255 754 000 106', 'Arusha', 6200000::numeric, 'lead', true)
)
insert into public.aqan_customers (organization_id, name, customer_type, contact_name, email, phone, city, total_spend, status, marketing_consent)
select organization.id, seed.name, seed.customer_type, seed.contact_name, seed.email, seed.phone, seed.city, seed.total_spend, seed.status, seed.marketing_consent
from organization cross join seed
where not exists (
  select 1 from public.aqan_customers customer
  where customer.organization_id = organization.id and customer.name = seed.name
);

comment on function public.aqan_complete_sale(uuid, text, jsonb, text, text, text, text) is
  'Atomically validates stock, records sale and payment, decrements inventory, updates customer value and writes an audit event.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aqan-invoices', 'aqan-invoices', false, 5242880, array['text/html', 'application/pdf'])
on conflict (id) do update set public = false;

create policy aqan_invoice_staff_read on storage.objects
  for select to authenticated using (
    bucket_id = 'aqan-invoices'
    and private.aqan_has_role(nullif((storage.foldername(name))[1], '')::uuid, array['owner','admin','sales','viewer'])
  );
