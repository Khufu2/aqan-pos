-- Tokenised customer document collaboration. Public access is intentionally
-- mediated by server routes; neither table is granted to the anon role.
create table public.aqan_document_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  document_type text not null check (document_type in ('invoice','quotation','proforma')),
  document_id uuid not null,
  token_hash text not null unique,
  permission text not null default 'comment' check (permission in ('view','comment')),
  recipient_name text,
  recipient_email text,
  response_status text not null default 'pending' check (response_status in ('pending','viewed','accepted','declined','changes_requested')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.aqan_document_share_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aqan_organizations(id) on delete cascade,
  share_id uuid not null references public.aqan_document_shares(id) on delete cascade,
  message_type text not null default 'comment' check (message_type in ('comment','changes_requested','accepted','declined')),
  author_name text not null,
  author_email text,
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index aqan_document_shares_org_document_idx
  on public.aqan_document_shares (organization_id, document_type, document_id, created_at desc);
create index aqan_document_shares_expiry_idx
  on public.aqan_document_shares (expires_at) where revoked_at is null;
create index aqan_document_share_messages_share_idx
  on public.aqan_document_share_messages (share_id, created_at desc);
create index aqan_document_share_messages_org_idx
  on public.aqan_document_share_messages (organization_id, created_at desc);

alter table public.aqan_document_shares enable row level security;
alter table public.aqan_document_share_messages enable row level security;

create policy aqan_document_shares_staff_read on public.aqan_document_shares
  for select to authenticated
  using (private.aqan_has_role(organization_id, array['owner','admin','manager','sales','salesperson','accountant','viewer']));
create policy aqan_document_shares_staff_write on public.aqan_document_shares
  for all to authenticated
  using (private.aqan_has_role(organization_id, array['owner','admin','manager','sales','salesperson','accountant']))
  with check (private.aqan_has_role(organization_id, array['owner','admin','manager','sales','salesperson','accountant']));

create policy aqan_document_share_messages_staff_read on public.aqan_document_share_messages
  for select to authenticated
  using (private.aqan_has_role(organization_id, array['owner','admin','manager','sales','salesperson','accountant','viewer']));
create policy aqan_document_share_messages_staff_write on public.aqan_document_share_messages
  for all to authenticated
  using (private.aqan_has_role(organization_id, array['owner','admin','manager','sales','salesperson','accountant']))
  with check (private.aqan_has_role(organization_id, array['owner','admin','manager','sales','salesperson','accountant']));

grant select, insert, update, delete on public.aqan_document_shares to authenticated;
grant select, insert, update, delete on public.aqan_document_share_messages to authenticated;
revoke all on public.aqan_document_shares from anon;
revoke all on public.aqan_document_share_messages from anon;
