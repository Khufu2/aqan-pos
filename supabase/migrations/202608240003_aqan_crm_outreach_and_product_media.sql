-- Product imagery and an actionable facility CRM for AQAN BIOMEDICAL POS.

alter table public.aqan_products
  add column if not exists image_path text;

alter table public.aqan_crm_leads
  add column if not exists facility_type text,
  add column if not exists ownership_category text,
  add column if not exists region text,
  add column if not exists district text,
  add column if not exists council text,
  add column if not exists ward text,
  add column if not exists preferred_channel text,
  add column if not exists service_count integer not null default 0,
  add column if not exists equipment_count integer not null default 0,
  add column if not exists equipment_summary text,
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists last_outreach_at timestamptz,
  add column if not exists last_outreach_channel text;

create table if not exists public.aqan_crm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  lead_id uuid not null references public.aqan_crm_leads(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp', 'phone', 'visit', 'note')),
  outcome text not null check (outcome in ('prepared', 'sent', 'contacted', 'replied', 'qualified', 'proposal_sent', 'not_a_fit', 'note')),
  subject text,
  body text,
  created_at timestamptz not null default now()
);

create index if not exists aqan_crm_activities_lead_created_idx
  on public.aqan_crm_activities (lead_id, created_at desc);
create index if not exists aqan_crm_leads_org_region_idx
  on public.aqan_crm_leads (organization_id, region, lead_score desc);

alter table public.aqan_crm_activities enable row level security;

create policy aqan_crm_activities_member_select on public.aqan_crm_activities
  for select to authenticated
  using (private.aqan_has_role(organization_id, array['owner','admin','sales','viewer']));
create policy aqan_crm_activities_sales_insert on public.aqan_crm_activities
  for insert to authenticated
  with check (private.aqan_has_role(organization_id, array['owner','admin','sales']));

grant select, insert on public.aqan_crm_activities to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'aqan-product-images',
  'aqan-product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.aqan_can_manage_product_image(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p_org_id uuid;
begin
  if (select auth.uid()) is null then return false; end if;
  begin
    p_org_id := ((storage.foldername(p_name))[1])::uuid;
  exception when others then
    return false;
  end;
  return private.aqan_has_role(p_org_id, array['owner','admin','sales']);
end;
$$;

revoke all on function private.aqan_can_manage_product_image(text) from public, anon, authenticated;
grant execute on function private.aqan_can_manage_product_image(text) to authenticated;

create policy aqan_product_images_authenticated_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'aqan-product-images'
    and private.aqan_can_manage_product_image(name)
  );
create policy aqan_product_images_authenticated_update on storage.objects
  for update to authenticated
  using (bucket_id = 'aqan-product-images' and private.aqan_can_manage_product_image(name))
  with check (bucket_id = 'aqan-product-images' and private.aqan_can_manage_product_image(name));
create policy aqan_product_images_authenticated_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'aqan-product-images' and private.aqan_can_manage_product_image(name));

