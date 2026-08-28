import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Membership = {
  organization_id: string;
  organization_name: string;
  role: "owner" | "admin" | "manager" | "cashier" | "sales" | "salesperson" | "inventory" | "service" | "accountant" | "viewer";
};

export type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  cost: number;
  stock: number;
  reorder_level: number;
  sku: string;
  color: string;
  image_path: string | null;
  serial_tracked: boolean;
  active: boolean;
};

export type Customer = {
  id: string;
  name: string;
  customer_type: string;
  city: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  total_spend: number;
  last_purchase_at: string | null;
  status: string;
};

export type Sale = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  subtotal: number;
  vat_amount: number;
  total: number;
  status: string;
  sold_at: string;
  customer?: { name: string } | null;
};

export type Quotation = {
  id: string;
  quote_number: string;
  customer_id: string;
  total: number;
  status: string;
  valid_until: string;
  created_at: string;
  customer?: { name: string } | null;
};

export type QuotationDetail = Quotation & {
  subtotal: number;
  vat_amount: number;
  notes: string | null;
  payment_terms: string | null;
  quotation_terms: string | null;
  delivery_terms: string | null;
  bank_details_snapshot: string | null;
  customer?: { name: string; contact_name: string | null; phone: string | null; email: string | null; city: string | null } | null;
  items: Array<{ id: string; product_id: string | null; description: string; quantity: number; unit_price: number; line_total: number }>;
};

export type ServiceRequest = {
  id: string;
  request_number: string;
  customer_id: string;
  equipment_name: string;
  serial_number: string | null;
  issue: string;
  priority: string;
  status: string;
  scheduled_for: string | null;
  customer?: { name: string } | null;
};

export type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: string;
  audience_count: number;
  sent_count: number;
  opened_count: number;
  replied_count: number;
  created_at: string;
};

export type CrmLead = {
  id: string;
  facility_name: string;
  contact_name: string | null;
  city: string | null;
  specialty: string | null;
  lead_status: string;
  lead_score: number;
  estimated_value: number;
  last_contact_at: string | null;
  next_action_at: string | null;
  notes: string | null;
  email: string | null;
  phone: string | null;
  facility_type: string | null;
  ownership_category: string | null;
  region: string | null;
  district: string | null;
  council: string | null;
  ward: string | null;
  preferred_channel: string | null;
  service_count: number;
  equipment_count: number;
  equipment_summary: string | null;
  last_outreach_at: string | null;
  last_outreach_channel: string | null;
};

export type CrmActivity = {
  id: string;
  lead_id: string;
  channel: "email" | "whatsapp" | "phone" | "visit" | "note";
  outcome: string;
  subject: string | null;
  body: string | null;
  created_at: string;
};

export type BusinessSettings = {
  legal_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  tin: string | null;
  vrn: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  payment_terms: string;
  quotation_terms: string;
  delivery_terms: string;
  invoice_footer: string | null;
  vat_rate: number;
  logo_path?: string | null;
  document_layout?: "classic" | "modern" | "compact";
  quotation_accent?: string;
};

export type Supplier = { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; status: string; payment_terms: string | null; };
export type Warehouse = { id: string; name: string; code: string; address: string | null; manager_name: string | null; active: boolean; };
export type PurchaseOrder = { id: string; po_number: string; status: string; total: number; expected_on: string | null; supplier?: { name: string } | null; };
export type CashSession = { id: string; status: string; opening_float: number; expected_cash: number; counted_cash: number | null; opened_at: string; };

export type DeliveryNote = { id: string; delivery_number: string; sale_id: string; recipient_name: string; recipient_phone: string | null; delivery_address: string | null; driver_name: string | null; vehicle_number: string | null; status: string; received_by_name: string | null; received_at: string | null; created_at: string; };
export type GatePass = { id: string; pass_number: string; vehicle_number: string; driver_name: string; driver_phone: string | null; purpose: string; status: string; check_in_at: string; check_out_at: string | null; };

export type StaffMember = { user_id: string; role: Membership["role"]; full_name: string | null };

export type AqanData = {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  quotations: Quotation[];
  serviceRequests: ServiceRequest[];
  campaigns: Campaign[];
  crmLeads: CrmLead[];
  settings: BusinessSettings | null;
  deliveryNotes: DeliveryNote[];
  gatePasses: GatePass[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  purchaseOrders: PurchaseOrder[];
  cashSessions: CashSession[];
};

export const emptyAqanData: AqanData = {
  products: [],
  customers: [],
  sales: [],
  quotations: [],
  serviceRequests: [],
  campaigns: [],
  crmLeads: [],
  settings: null,
  deliveryNotes: [],
  gatePasses: [],
  suppliers: [], warehouses: [], purchaseOrders: [], cashSessions: [],
};

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured for this deployment.");
  return supabase;
}

export async function getMembership(): Promise<Membership | null> {
  const client = requireClient();
  const { data, error } = await client.rpc("aqan_current_membership");
  if (error) throw error;
  return Array.isArray(data) && data.length ? data[0] as Membership : null;
}

export async function loadAqanData(): Promise<AqanData> {
  const client = requireClient();
  const [products, customers, sales, quotations, serviceRequests, campaigns, crmLeads, settings, deliveryNotes, gatePasses, suppliers, warehouses, purchaseOrders, cashSessions] = await Promise.all([
    client.from("aqan_products").select("id,name,category,description,price,cost,stock,reorder_level,sku,color,image_path,serial_tracked,active").eq("active", true).order("name"),
    client.from("aqan_customers").select("id,name,customer_type,city,contact_name,email,phone,total_spend,last_purchase_at,status").order("name"),
    client.from("aqan_sales").select("id,invoice_number,customer_id,subtotal,vat_amount,total,status,sold_at,customer:aqan_customers(name)").order("sold_at", { ascending: false }).limit(50),
    client.from("aqan_quotations").select("id,quote_number,customer_id,total,status,valid_until,created_at,customer:aqan_customers(name)").order("created_at", { ascending: false }).limit(50),
    client.from("aqan_service_requests").select("id,request_number,customer_id,equipment_name,serial_number,issue,priority,status,scheduled_for,customer:aqan_customers(name)").order("created_at", { ascending: false }).limit(50),
    client.from("aqan_campaigns").select("id,name,channel,status,audience_count,sent_count,opened_count,replied_count,created_at").order("created_at", { ascending: false }).limit(50),
    client.from("aqan_crm_leads").select("id,facility_name,contact_name,email,phone,city,specialty,lead_status,lead_score,estimated_value,last_contact_at,next_action_at,notes,facility_type,ownership_category,region,district,council,ward,preferred_channel,service_count,equipment_count,equipment_summary,last_outreach_at,last_outreach_channel").order("lead_score", { ascending: false }).limit(1000),
    client.from("aqan_business_settings").select("legal_name,address,phone,email,tin,vrn,bank_name,bank_account_name,bank_account_number,bank_branch,payment_terms,quotation_terms,delivery_terms,invoice_footer,vat_rate,logo_path,document_layout,quotation_accent").maybeSingle(),
    client.from("aqan_delivery_notes").select("id,delivery_number,sale_id,recipient_name,recipient_phone,delivery_address,driver_name,vehicle_number,status,received_by_name,received_at,created_at").order("created_at", { ascending: false }).limit(50),
    client.from("aqan_gate_passes").select("id,pass_number,vehicle_number,driver_name,driver_phone,purpose,status,check_in_at,check_out_at").order("check_in_at", { ascending: false }).limit(50),
    client.from("aqan_suppliers").select("id,name,contact_name,phone,email,status,payment_terms").order("name").limit(100),
    client.from("aqan_warehouses").select("id,name,code,address,manager_name,active").order("name").limit(30),
    client.from("aqan_purchase_orders").select("id,po_number,status,total,expected_on,supplier:aqan_suppliers(name)").order("created_at", {ascending:false}).limit(50),
    client.from("aqan_cash_sessions").select("id,status,opening_float,expected_cash,counted_cash,opened_at").order("opened_at", {ascending:false}).limit(20),
  ]);

  for (const result of [products, customers, sales, quotations, serviceRequests, campaigns, crmLeads, settings, deliveryNotes, gatePasses, suppliers, warehouses, purchaseOrders, cashSessions]) {
    if (result.error) throw result.error;
  }

  return {
    products: (products.data ?? []) as Product[],
    customers: (customers.data ?? []) as Customer[],
    sales: (sales.data ?? []) as unknown as Sale[],
    quotations: (quotations.data ?? []) as unknown as Quotation[],
    serviceRequests: (serviceRequests.data ?? []) as unknown as ServiceRequest[],
    campaigns: (campaigns.data ?? []) as Campaign[],
    crmLeads: (crmLeads.data ?? []) as CrmLead[],
    settings: settings.data as BusinessSettings | null,
    deliveryNotes: (deliveryNotes.data ?? []) as DeliveryNote[],
    gatePasses: (gatePasses.data ?? []) as GatePass[],
    suppliers: (suppliers.data ?? []) as Supplier[], warehouses: (warehouses.data ?? []) as Warehouse[], purchaseOrders: (purchaseOrders.data ?? []) as unknown as PurchaseOrder[], cashSessions: (cashSessions.data ?? []) as CashSession[],
  };
}

export async function requestWorkspaceAccess(fullName: string) {
  const client = requireClient();
  const { error } = await client.rpc("aqan_request_access", { p_full_name: fullName });
  if (error) throw error;
}

export async function completeSale(input: {
  customerId: string | null;
  paymentMethod: string;
  paymentProvider?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  items: Array<{ product_id: string; quantity: number }>;
}) {
  const client = requireClient();
  const { data, error } = await client.rpc("aqan_complete_sale", {
    p_customer_id: input.customerId,
    p_payment_method: input.paymentMethod,
    p_items: input.items,
    p_payment_provider: input.paymentProvider ?? null,
    p_customer_name: input.customerName ?? null,
    p_customer_phone: input.customerPhone ?? null,
    p_customer_email: input.customerEmail ?? null,
  });
  if (error) throw error;
  return data as { sale_id: string; invoice_number: string; total: number };
}

export async function claimFirstOwner(fullName: string) {
  const client = requireClient();
  const { data, error } = await client.rpc("aqan_claim_first_owner", { p_full_name: fullName });
  if (error) throw error;
  return Array.isArray(data) && data.length ? data[0] as Membership : null;
}

export async function askAqanAI(question: string) {
  const client = requireClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in again before using AQAN AI.");
  const { data, error } = await client.functions.invoke("aqan-ai", {
    body: { question },
    headers: { Authorization: `Bearer ${session.access_token}` },
    timeout: 45_000,
  });
  if (error) {
    let detail = error.message || "AQAN AI could not be reached.";
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json() as { error?: string; message?: string };
        detail = payload.error || payload.message || detail;
      } catch {
        // Preserve the SDK message when the gateway response is not JSON.
      }
    }
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.answer) throw new Error("AQAN AI returned no answer.");
  return data as { answer: string; model?: string; leads?: Array<{ facility_name: string; lead_score: number; lead_status: string; suggested_action: string }> };
}

export async function loadStaff(organizationId: string): Promise<StaffMember[]> {
  const client = requireClient();
  const { data: memberships, error } = await client.from("aqan_memberships").select("user_id,role").eq("organization_id", organizationId).order("created_at");
  if (error) throw error;
  const ids = (memberships ?? []).map((member) => member.user_id);
  if (!ids.length) return [];
  const { data: profiles, error: profileError } = await client.from("aqan_profiles").select("id,full_name").in("id", ids);
  if (profileError) throw profileError;
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  return (memberships ?? []).map((member) => ({ user_id: member.user_id, role: member.role as Membership["role"], full_name: profileNames.get(member.user_id) ?? null }));
}

export type AssignableRole = "admin" | "manager" | "cashier" | "sales" | "salesperson" | "inventory" | "service" | "accountant" | "viewer";
export async function inviteStaff(input: { email: string; fullName: string; role: AssignableRole }) {
  const client = requireClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error("Your secure session has expired. Please sign in again.");
  const response = await fetch("/api/team/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error || "The staff invitation could not be sent.");
  return data as { ok: true; email: string; role: string };
}

export async function updateMyProfile(input: { fullName: string; phone: string; language: "en" | "sw"; theme: "light" | "dark" | "system"; fontSize?: "small" | "standard" | "large" }) {
  const client = requireClient();
  const { data: { user }, error: authError } = await client.auth.updateUser({
    data: { full_name: input.fullName.trim(), phone: input.phone.trim(), aqan_language: input.language, aqan_theme: input.theme, ...(input.fontSize ? { aqan_font_size: input.fontSize } : {}) },
  });
  if (authError) throw authError;
  if (user) {
    const { error: profileError } = await client.from("aqan_profiles").update({ full_name: input.fullName.trim(), phone: input.phone.trim() }).eq("id", user.id);
    if (profileError) throw profileError;
  }
  return user;
}

export async function updateMyPassword(password: string) {
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

export async function setMemberRole(userId: string, role: AssignableRole) {
  const client = requireClient();
  const { error } = await client.rpc("aqan_set_member_role", { p_user_id: userId, p_role: role });
  if (error) throw error;
}

export function productImageUrl(path: string | null) {
  if (!path) return null;
  const client = requireClient();
  return client.storage.from("aqan-product-images").getPublicUrl(path).data.publicUrl;
}

export async function createProduct(input: Pick<Product, "name" | "category" | "description" | "price" | "stock" | "reorder_level" | "sku" | "serial_tracked">, organizationId: string, image?: File | null) {
  const client = requireClient();
  const sku = input.sku.trim() || `${input.category.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "MED"}-${Date.now().toString(36).toUpperCase()}`;
  const { data: product, error } = await client.from("aqan_products").insert({ ...input, sku, organization_id: organizationId, color: "#dff4ff" }).select("id").single();
  if (error) throw error;
  if (!image || !product) return;
  if (!image.type.startsWith("image/") || image.size > 5 * 1024 * 1024) throw new Error("Product photos must be JPG, PNG or WebP and no larger than 5MB.");
  const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${organizationId}/${product.id}/${Date.now()}.${extension}`;
  const { error: uploadError } = await client.storage.from("aqan-product-images").upload(path, image, { contentType: image.type, upsert: false });
  if (uploadError) throw uploadError;
  const { error: imageError } = await client.from("aqan_products").update({ image_path: path }).eq("id", product.id);
  if (imageError) throw imageError;
}

export async function updateProduct(input: Pick<Product, "id" | "name" | "category" | "description" | "price" | "cost" | "reorder_level" | "sku" | "serial_tracked" | "active">) {
  const client = requireClient();
  const { id, ...changes } = input;
  const { error } = await client.from("aqan_products").update(changes).eq("id", id);
  if (error) throw error;
}

export async function setProductStock(productId: string, stock: number) {
  const client = requireClient();
  const nextStock = Math.max(0, Math.floor(Number(stock) || 0));
  const { error } = await client.from("aqan_products").update({ stock: nextStock }).eq("id", productId);
  if (error) throw error;
}

export async function replaceProductImage(productId: string, organizationId: string, file: File) {
  const client = requireClient();
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) throw new Error("Product photos must be JPG, PNG or WebP and no larger than 5MB.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${organizationId}/${productId}/${Date.now()}.${extension}`;
  const { error: uploadError } = await client.storage.from("aqan-product-images").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { error: updateError } = await client.from("aqan_products").update({ image_path: path }).eq("id", productId);
  if (updateError) throw updateError;
  return path;
}

export async function loadQuotationDetail(quotationId: string): Promise<QuotationDetail> {
  const client = requireClient();
  const { data, error } = await client.from("aqan_quotations").select("id,quote_number,customer_id,subtotal,vat_amount,total,status,notes,valid_until,created_at,payment_terms,quotation_terms,delivery_terms,bank_details_snapshot,customer:aqan_customers(name,contact_name,phone,email,city),items:aqan_quotation_items(id,product_id,description,quantity,unit_price,line_total)").eq("id", quotationId).single();
  if (error || !data) throw error || new Error("Quotation could not be loaded.");
  return data as unknown as QuotationDetail;
}

export async function updateQuotationStatus(quotationId: string, status: "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired") {
  const { error } = await requireClient().from("aqan_quotations").update({ status }).eq("id", quotationId);
  if (error) throw error;
}

export async function recordCrmOutreach(input: { leadId: string; organizationId: string; channel: "email" | "whatsapp" | "phone" | "visit" | "note"; outcome: "prepared" | "sent" | "contacted" | "replied" | "qualified" | "proposal_sent" | "not_a_fit" | "note"; subject?: string; body?: string; leadStatus?: CrmLead["lead_status"] }) {
  const client = requireClient();
  const { error: activityError } = await client.from("aqan_crm_activities").insert({
    organization_id: input.organizationId,
    lead_id: input.leadId,
    channel: input.channel,
    outcome: input.outcome,
    subject: input.subject || null,
    body: input.body || null,
  });
  if (activityError) throw activityError;
  const { error: leadError } = await client.from("aqan_crm_leads").update({
    lead_status: input.leadStatus ?? "contacted",
    last_outreach_at: new Date().toISOString(),
    last_outreach_channel: input.channel,
  }).eq("id", input.leadId);
  if (leadError) throw leadError;
}

export async function loadCrmActivities(leadId: string): Promise<CrmActivity[]> {
  const client = requireClient();
  const { data, error } = await client.from("aqan_crm_activities").select("id,lead_id,channel,outcome,subject,body,created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as CrmActivity[];
}

export async function updateCrmLead(input: { leadId: string; leadStatus: string; nextActionAt?: string | null; notes?: string | null }) {
  const client = requireClient();
  const { error } = await client.from("aqan_crm_leads").update({ lead_status: input.leadStatus, next_action_at: input.nextActionAt || null, ...(input.notes !== undefined ? { notes: input.notes } : {}) }).eq("id", input.leadId);
  if (error) throw error;
}

export async function createCustomer(input: Pick<Customer, "name" | "customer_type" | "city" | "contact_name" | "email" | "phone">, organizationId: string) {
  const client = requireClient();
  const { error } = await client.from("aqan_customers").insert({ ...input, organization_id: organizationId });
  if (error) throw error;
}

export async function createQuotation(input: { customerId: string; notes: string; validUntil: string; productId: string; quantity: number }, organizationId: string) {
  const client = requireClient();
  const { data: product, error: productError } = await client.from("aqan_products").select("id,name,price").eq("id", input.productId).single();
  if (productError || !product) throw productError || new Error("Select a product for this quotation.");
  const { data: settings } = await client.from("aqan_business_settings").select("payment_terms,quotation_terms,delivery_terms,bank_name,bank_account_name,bank_account_number,bank_branch").eq("organization_id", organizationId).maybeSingle();
  const { data: quotation, error } = await client.from("aqan_quotations").insert({
    organization_id: organizationId,
    customer_id: input.customerId,
    notes: input.notes,
    valid_until: input.validUntil,
    status: "draft",
    payment_terms: settings?.payment_terms ?? null,
    quotation_terms: settings?.quotation_terms ?? null,
    delivery_terms: settings?.delivery_terms ?? null,
    bank_details_snapshot: settings?.bank_name ? [settings.bank_name, settings.bank_account_name, settings.bank_account_number, settings.bank_branch].filter(Boolean).join(" Â· ") : null,
  }).select("id").single();
  if (error) throw error;
  const { error: itemError } = await client.from("aqan_quotation_items").insert({ organization_id: organizationId, quotation_id: quotation.id, product_id: product.id, description: product.name, quantity: Math.max(1, Math.floor(input.quantity || 1)), unit_price: product.price });
  if (itemError) throw itemError;
}

/**
 * Creates a commercially complete quotation from one or more live catalogue lines.
 * Prices are always re-read from the secured catalogue; AI/UI text is never trusted
 * as a source of price, tax or product ownership.
 */
export async function createAdvancedQuotation(input: {
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  validUntil: string;
  notes?: string | null;
  items: Array<{ productId: string; quantity: number }>;
}, organizationId: string) {
  const client = requireClient();
  const customerName = input.customerName.trim();
  if (!customerName) throw new Error("Add the customer or facility name before creating a quotation.");
  const requested = new Map<string, number>();
  for (const item of input.items) {
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    if (item.productId && quantity > 0) requested.set(item.productId, (requested.get(item.productId) || 0) + quantity);
  }
  if (!requested.size) throw new Error("Add at least one catalogue product and quantity to the quotation.");

  let customerId = input.customerId || null;
  if (!customerId) {
    const { data: existing, error: existingError } = await client
      .from("aqan_customers")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("name", customerName)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    customerId = existing?.id || null;
  }
  if (!customerId) {
    const { data: customer, error: customerError } = await client
      .from("aqan_customers")
      .insert({ organization_id: organizationId, name: customerName, customer_type: "Healthcare customer", contact_name: customerName, phone: input.customerPhone?.trim() || null, email: input.customerEmail?.trim() || null })
      .select("id")
      .single();
    if (customerError || !customer) throw customerError || new Error("Customer could not be created.");
    customerId = customer.id;
  }

  const productIds = [...requested.keys()];
  const { data: products, error: productError } = await client
    .from("aqan_products")
    .select("id,name,price,active")
    .eq("organization_id", organizationId)
    .in("id", productIds);
  if (productError) throw productError;
  const liveProducts = new Map((products ?? []).filter((product) => product.active).map((product) => [product.id, product]));
  if (liveProducts.size !== productIds.length) throw new Error("One or more selected products are unavailable. Refresh the catalogue and try again.");

  const { data: settings, error: settingsError } = await client
    .from("aqan_business_settings")
    .select("payment_terms,quotation_terms,delivery_terms,bank_name,bank_account_name,bank_account_number,bank_branch")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  const { data: quotation, error: quotationError } = await client
    .from("aqan_quotations")
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      notes: input.notes?.trim() || null,
      valid_until: input.validUntil,
      status: "draft",
      payment_terms: settings?.payment_terms ?? null,
      quotation_terms: settings?.quotation_terms ?? null,
      delivery_terms: settings?.delivery_terms ?? null,
      bank_details_snapshot: settings?.bank_name ? [settings.bank_name, settings.bank_account_name, settings.bank_account_number, settings.bank_branch].filter(Boolean).join(" Â· ") : null,
    })
    .select("id,quote_number")
    .single();
  if (quotationError || !quotation) throw quotationError || new Error("Quotation could not be created.");

  const { error: itemsError } = await client.from("aqan_quotation_items").insert(productIds.map((productId) => {
    const product = liveProducts.get(productId)!;
    const quantity = requested.get(productId)!;
    return { organization_id: organizationId, quotation_id: quotation.id, product_id: product.id, description: product.name, quantity, unit_price: product.price };
  }));
  if (itemsError) throw itemsError;
  return quotation as { id: string; quote_number: string };
}

export async function saveBusinessSettings(input: BusinessSettings, organizationId: string) {
  const client = requireClient();
  const { error } = await client.from("aqan_business_settings").upsert({ organization_id: organizationId, ...input });
  if (error) throw error;
}

export async function uploadBrandLogo(organizationId: string, file: File) {
  const client = requireClient();
  if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) throw new Error("Logo must be an image smaller than 2MB.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${organizationId}/logo-${Date.now()}.${extension}`;
  const { error } = await client.storage.from("aqan-branding").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { error: settingsError } = await client.from("aqan_business_settings").upsert({ organization_id: organizationId, logo_path: path });
  if (settingsError) throw settingsError;
}

export function brandLogoUrl(path: string | null | undefined) {
  if (!path) return null;
  return requireClient().storage.from("aqan-branding").getPublicUrl(path).data.publicUrl;
}

export async function updateDocumentDesign(organizationId: string, layout: "classic" | "modern" | "compact", accent: string) {
  const { error } = await requireClient().from("aqan_business_settings").upsert({ organization_id: organizationId, document_layout: layout, quotation_accent: accent });
  if (error) throw error;
}

export async function createSupplier(input: { organizationId: string; name: string; contactName?: string; phone?: string; email?: string; paymentTerms?: string }) {
  const { error } = await requireClient().from("aqan_suppliers").insert({ organization_id: input.organizationId, name: input.name, contact_name: input.contactName || null, phone: input.phone || null, email: input.email || null, payment_terms: input.paymentTerms || null }); if (error) throw error;
}
export async function createWarehouse(input: { organizationId: string; name: string; code: string; address?: string; managerName?: string }) {
  const { error } = await requireClient().from("aqan_warehouses").insert({ organization_id: input.organizationId, name: input.name, code: input.code, address: input.address || null, manager_name: input.managerName || null }); if (error) throw error;
}
export async function createPurchaseOrder(input: { organizationId: string; supplierId: string; warehouseId?: string; expectedOn?: string; notes?: string }) {
  const { error } = await requireClient().from("aqan_purchase_orders").insert({ organization_id: input.organizationId, supplier_id: input.supplierId, warehouse_id: input.warehouseId || null, expected_on: input.expectedOn || null, notes: input.notes || null }); if (error) throw error;
}
export async function openCashSession(input: { organizationId: string; openingFloat: number; notes?: string }) {
  const { error } = await requireClient().from("aqan_cash_sessions").insert({ organization_id: input.organizationId, opening_float: input.openingFloat, notes: input.notes || null }); if (error) throw error;
}
export async function receiveStock(input: { productId: string; quantity: number; batchNumber?: string; expiryDate?: string; costPerUnit?: number; supplierId?: string; warehouseId?: string; supplierInvoiceNumber?: string; notes?: string }) {
  const { data, error } = await requireClient().rpc("aqan_receive_stock", { p_product_id: input.productId, p_quantity: input.quantity, p_batch_number: input.batchNumber || null, p_expiry_date: input.expiryDate || null, p_cost_per_unit: input.costPerUnit || 0, p_supplier_id: input.supplierId || null, p_warehouse_id: input.warehouseId || null, p_supplier_invoice_number: input.supplierInvoiceNumber || null, p_notes: input.notes || null }); if (error) throw error; return data as string;
}
export async function closeCashSession(input: { sessionId: string; countedCash: number; notes?: string }) {
  const { error } = await requireClient().rpc("aqan_close_cash_session", { p_session_id: input.sessionId, p_counted_cash: input.countedCash, p_notes: input.notes || null }); if (error) throw error;
}

export async function createDeliveryNote(input: { saleId: string; recipientName: string; recipientPhone: string; deliveryAddress: string; driverName: string; vehicleNumber: string; notes: string }) {
  const client = requireClient();
  const { data, error } = await client.rpc("aqan_create_delivery_note", { p_sale_id: input.saleId, p_recipient_name: input.recipientName, p_recipient_phone: input.recipientPhone || null, p_delivery_address: input.deliveryAddress || null, p_driver_name: input.driverName || null, p_vehicle_number: input.vehicleNumber || null, p_notes: input.notes || null });
  if (error) throw error;
  return data as string;
}

export async function confirmDelivery(noteId: string, receivedByName: string, signature: string) {
  const client = requireClient();
  const { error } = await client.from("aqan_delivery_notes").update({ status: "delivered", received_by_name: receivedByName, receiver_signature: signature, received_at: new Date().toISOString() }).eq("id", noteId);
  if (error) throw error;
}

export async function createGatePass(input: { organizationId: string; vehicleNumber: string; driverName: string; driverPhone: string; purpose: string; notes: string; deliveryNoteId?: string | null }) {
  const client = requireClient();
  const { error } = await client.from("aqan_gate_passes").insert({ organization_id: input.organizationId, vehicle_number: input.vehicleNumber, driver_name: input.driverName, driver_phone: input.driverPhone || null, purpose: input.purpose, notes: input.notes || null, delivery_note_id: input.deliveryNoteId || null });
  if (error) throw error;
}

export async function createServiceRequest(input: { customerId: string; equipmentName: string; serialNumber: string; issue: string; scheduledFor: string }, organizationId: string) {
  const client = requireClient();
  const { error } = await client.from("aqan_service_requests").insert({
    organization_id: organizationId,
    customer_id: input.customerId,
    equipment_name: input.equipmentName,
    serial_number: input.serialNumber || null,
    issue: input.issue,
    scheduled_for: input.scheduledFor || null,
  });
  if (error) throw error;
}

export async function createCampaign(input: { name: string; channel: string; message: string }, organizationId: string) {
  const client = requireClient();
  const { error } = await client.from("aqan_campaigns").insert({
    organization_id: organizationId,
    name: input.name,
    channel: input.channel,
    message: input.message,
    status: "draft",
  });
  if (error) throw error;
}

export async function signIn(email: string, password: string) {
  const client = requireClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, fullName: string) {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: "https://aqan-biomedical-pos.vercel.app",
    },
  });
  if (error) throw error;
  return data;
}

export async function resendSignupConfirmation(email: string) {
  const client = requireClient();
  const { error } = await client.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: "https://aqan-biomedical-pos.vercel.app" },
  });
  if (error) throw error;
}

export async function signOut() {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export function subscribeToSession(onSession: (session: Session | null) => void) {
  if (!supabase) return () => undefined;
  void supabase.auth.getSession().then(({ data }) => onSession(data.session));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => onSession(session));
  return () => data.subscription.unsubscribe();
}
