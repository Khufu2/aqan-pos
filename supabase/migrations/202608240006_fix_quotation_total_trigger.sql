-- Handle DELETE trigger rows explicitly; PostgreSQL does not expose NEW for deletes.

create or replace function private.aqan_refresh_quotation_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_org_id uuid;
  v_rate numeric := 18;
  v_subtotal numeric := 0;
begin
  if tg_op = 'DELETE' then
    v_quote_id := old.quotation_id;
    v_org_id := old.organization_id;
  else
    v_quote_id := new.quotation_id;
    v_org_id := new.organization_id;
  end if;

  select coalesce(vat_rate, 18) into v_rate
  from public.aqan_business_settings
  where organization_id = v_org_id;

  select coalesce(sum(line_total), 0) into v_subtotal
  from public.aqan_quotation_items
  where quotation_id = v_quote_id;

  update public.aqan_quotations
  set subtotal = v_subtotal,
      vat_amount = round(v_subtotal * v_rate / 100, 2),
      total = v_subtotal + round(v_subtotal * v_rate / 100, 2),
      updated_at = now()
  where id = v_quote_id;
  return coalesce(new, old);
end;
$$;

revoke all on function private.aqan_refresh_quotation_totals() from public;
