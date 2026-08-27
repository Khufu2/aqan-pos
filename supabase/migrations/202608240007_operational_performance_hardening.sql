-- Cover operational foreign keys and avoid overlapping permissive SELECT policies.

create index if not exists aqan_business_settings_updated_by_idx on public.aqan_business_settings (updated_by);
create index if not exists aqan_delivery_notes_sale_idx on public.aqan_delivery_notes (sale_id);
create index if not exists aqan_delivery_notes_customer_idx on public.aqan_delivery_notes (customer_id);
create index if not exists aqan_delivery_notes_created_by_idx on public.aqan_delivery_notes (created_by);
create index if not exists aqan_delivery_note_items_note_idx on public.aqan_delivery_note_items (delivery_note_id);
create index if not exists aqan_gate_passes_note_idx on public.aqan_gate_passes (delivery_note_id);
create index if not exists aqan_gate_passes_approved_by_idx on public.aqan_gate_passes (approved_by);
create index if not exists aqan_gate_passes_created_by_idx on public.aqan_gate_passes (created_by);

drop policy if exists aqan_business_settings_admin_write on public.aqan_business_settings;
create policy aqan_business_settings_admin_insert on public.aqan_business_settings
  for insert to authenticated
  with check (private.aqan_has_role(organization_id, array['owner','admin']));
create policy aqan_business_settings_admin_update on public.aqan_business_settings
  for update to authenticated
  using (private.aqan_has_role(organization_id, array['owner','admin']))
  with check (private.aqan_has_role(organization_id, array['owner','admin']));
