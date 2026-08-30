-- Configurable document output and currency conversion. Transaction ledgers
-- retain their booked local-currency amounts; rates are explicit presentation
-- rates managed by an owner, never silently fetched from an external source.
alter table public.aqan_business_settings
  add column if not exists exchange_rates jsonb not null default '{"TZS":1}'::jsonb,
  add column if not exists document_language text not null default 'en';

do $$
declare constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.aqan_business_settings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%document_layout%';
  if constraint_name is not null then
    execute format('alter table public.aqan_business_settings drop constraint %I', constraint_name);
  end if;
  alter table public.aqan_business_settings
    add constraint aqan_business_settings_document_layout_check
    check (document_layout in ('classic','modern','compact','minimal','bold'));
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'aqan_business_settings_document_language_check'
      and conrelid = 'public.aqan_business_settings'::regclass
  ) then
    alter table public.aqan_business_settings
      add constraint aqan_business_settings_document_language_check
      check (document_language in ('en','sw'));
  end if;
end $$;
