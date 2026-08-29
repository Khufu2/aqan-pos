-- AQAN category manager. Existing text category values remain valid and are backfilled.
-- The first operations schema stored expenses using legacy `category` only. These
-- additive columns make the live table compatible with the operational expense UI
-- without altering or discarding the original values.
alter table public.aqan_expenses add column if not exists expense_number text;
alter table public.aqan_expenses add column if not exists category_name text;
alter table public.aqan_expenses add column if not exists supplier_id uuid references public.aqan_suppliers(id) on delete set null;
alter table public.aqan_expenses add column if not exists notes text;
alter table public.aqan_expenses add column if not exists status text not null default 'posted';

update public.aqan_expenses
set category_name = coalesce(nullif(trim(category_name), ''), nullif(trim(category), ''), 'Other'),
    expense_number = coalesce(nullif(trim(expense_number), ''), 'AQN-EXP-' || upper(replace(id::text, '-', ''))),
    status = coalesce(nullif(trim(status), ''), 'posted');

create unique index if not exists aqan_expenses_org_number_key
  on public.aqan_expenses(organization_id, expense_number)
  where expense_number is not null;

create table if not exists public.aqan_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('product','customer','expense')),
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists aqan_categories_org_type_name_key
  on public.aqan_categories(organization_id, entity_type, lower(name));

alter table public.aqan_categories enable row level security;

drop policy if exists aqan_categories_read on public.aqan_categories;
create policy aqan_categories_read on public.aqan_categories
  for select to authenticated
  using (private.aqan_has_role(organization_id, array['owner','admin','manager','cashier','sales','salesperson','inventory','service','accountant','viewer']));

drop policy if exists aqan_categories_manage on public.aqan_categories;
create policy aqan_categories_manage on public.aqan_categories
  for all to authenticated
  using (private.aqan_has_role(organization_id, array['owner','admin','manager','inventory','accountant']))
  with check (private.aqan_has_role(organization_id, array['owner','admin','manager','inventory','accountant']));

insert into public.aqan_categories(organization_id, entity_type, name)
select distinct organization_id, 'product', trim(category)
from public.aqan_products
where nullif(trim(category), '') is not null
on conflict do nothing;

insert into public.aqan_categories(organization_id, entity_type, name)
select distinct organization_id, 'customer', trim(customer_category)
from public.aqan_customers
where nullif(trim(customer_category), '') is not null
on conflict do nothing;

insert into public.aqan_categories(organization_id, entity_type, name)
select distinct organization_id, 'expense', trim(category)
from public.aqan_expenses
where nullif(trim(category), '') is not null
on conflict do nothing;
