-- Keep commercial quotation totals correct when line items are added or amended.

create or replace function private.aqan_refresh_quotation_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote_id uuid := coalesce(new.quotation_id, old.quotation_id);
  v_rate numeric := 18;
  v_subtotal numeric := 0;
begin
  select coalesce(vat_rate, 18) into v_rate
  from public.aqan_business_settings
  where organization_id = coalesce(new.organization_id, old.organization_id);

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

drop trigger if exists aqan_quote_item_totals on public.aqan_quotation_items;
create trigger aqan_quote_item_totals
after insert or update or delete on public.aqan_quotation_items
for each row execute function private.aqan_refresh_quotation_totals();

-- Recalculate any quotations created before the trigger was introduced.
with quote_totals as (
  select q.id, q.organization_id, coalesce(sum(i.line_total), 0) as subtotal
  from public.aqan_quotations q
  left join public.aqan_quotation_items i on i.quotation_id = q.id
  group by q.id, q.organization_id
)
update public.aqan_quotations q
set subtotal = t.subtotal,
    vat_amount = round(t.subtotal * coalesce(s.vat_rate, 18) / 100, 2),
    total = t.subtotal + round(t.subtotal * coalesce(s.vat_rate, 18) / 100, 2),
    updated_at = now()
from quote_totals t
left join public.aqan_business_settings s on s.organization_id = t.organization_id
where q.id = t.id;
