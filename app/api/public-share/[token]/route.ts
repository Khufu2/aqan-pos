import { createHash } from "node:crypto";
import { createServiceClient } from "../../../../lib/server-supabase";

const tokenPattern = /^[A-Za-z0-9_-]{40,64}$/;
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

async function findShare(token: string) {
  if (!tokenPattern.test(token)) return null;
  const db = createServiceClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data } = await db.from("aqan_document_shares")
    .select("id,organization_id,document_type,document_id,permission,response_status,recipient_name,recipient_email,expires_at,revoked_at,view_count")
    .eq("token_hash", tokenHash).maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return { db, share: data };
}

async function loadDocument(db: ReturnType<typeof createServiceClient>, type: string, id: string, organizationId: string) {
  if (type === "invoice") {
    const { data, error } = await db.from("aqan_sales").select("id,invoice_number,subtotal,discount_amount,shipping_amount,vat_amount,total,amount_paid,balance_due,status,due_date,sold_at,notes,customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot,customer:aqan_customers(name,contact_name,email,phone,city),items:aqan_sale_items(id,product_name,sku,quantity,unit_price,discount_amount,tax_amount,line_total)").eq("id", id).eq("organization_id", organizationId).maybeSingle();
    if (error) throw error;
    return data ? { ...data, number: data.invoice_number, issuedAt: data.sold_at, validUntil: data.due_date } : null;
  }
  if (type === "quotation") {
    const { data, error } = await db.from("aqan_quotations").select("id,quote_number,subtotal,vat_amount,total,status,valid_until,created_at,notes,payment_terms,quotation_terms,delivery_terms,bank_details_snapshot,customer:aqan_customers(name,contact_name,email,phone,city),items:aqan_quotation_items(id,description,quantity,unit_price,line_total)").eq("id", id).eq("organization_id", organizationId).maybeSingle();
    if (error) throw error;
    return data ? { ...data, number: data.quote_number, issuedAt: data.created_at, validUntil: data.valid_until } : null;
  }
  const { data, error } = await db.from("aqan_proformas").select("id,proforma_number,subtotal,discount_amount,vat_amount,total,status,issue_date,valid_until,notes,terms,customer:aqan_customers(name,contact_name,email,phone,city),items:aqan_proforma_items(id,description,quantity,unit_price,discount_amount,tax_amount,line_total)").eq("id", id).eq("organization_id", organizationId).maybeSingle();
  if (error) throw error;
  return data ? { ...data, number: data.proforma_number, issuedAt: data.issue_date, validUntil: data.valid_until } : null;
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const found = await findShare(token);
  if (!found) return reply({ error: "This document link is invalid, expired or has been revoked." }, 404);
  const { db, share } = found;
  try {
    const [document, settingsResult, messagesResult] = await Promise.all([
      loadDocument(db, share.document_type, share.document_id, share.organization_id),
      db.from("aqan_business_settings").select("legal_name,address,phone,email,tin,vrn,payment_terms,invoice_footer,logo_path,quotation_accent").eq("organization_id", share.organization_id).maybeSingle(),
      db.from("aqan_document_share_messages").select("id,message_type,author_name,message,created_at").eq("share_id", share.id).order("created_at"),
    ]);
    if (!document) return reply({ error: "The shared document no longer exists." }, 404);
    await db.from("aqan_document_shares").update({
      last_viewed_at: new Date().toISOString(),
      view_count: Number(share.view_count || 0) + 1,
      response_status: share.response_status === "pending" ? "viewed" : share.response_status,
      updated_at: new Date().toISOString(),
    }).eq("id", share.id);
    return reply({
      share: { type: share.document_type, permission: share.permission, responseStatus: share.response_status, expiresAt: share.expires_at },
      business: settingsResult.data,
      document,
      messages: messagesResult.data || [],
    });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "The document could not be loaded." }, 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const found = await findShare(token);
  if (!found) return reply({ error: "This document link is invalid, expired or has been revoked." }, 404);
  const { db, share } = found;
  if (share.permission !== "comment") return reply({ error: "This link is view-only." }, 403);
  const body = await request.json().catch(() => null) as null | Record<string, unknown>;
  const action = String(body?.action || "comment");
  const authorName = String(body?.authorName || "").trim().slice(0, 160);
  const authorEmail = String(body?.authorEmail || "").trim().slice(0, 320);
  const message = String(body?.message || "").trim().slice(0, 4000);
  if (!authorName || !message || !["comment", "changes_requested", "accepted", "declined"].includes(action)) {
    return reply({ error: "Add your name and a message before sending." }, 400);
  }
  if ((action === "accepted" || action === "declined") && share.document_type === "invoice") {
    return reply({ error: "Issued invoices can receive comments or change requests, but cannot be rewritten from a public link." }, 400);
  }
  const tenMinutesAgo = new Date(Date.now() - 10 * 60000).toISOString();
  const { count } = await db.from("aqan_document_share_messages").select("id", { count: "exact", head: true }).eq("share_id", share.id).gte("created_at", tenMinutesAgo);
  if ((count || 0) >= 5) return reply({ error: "Too many responses were sent. Please wait a few minutes." }, 429);

  const { error } = await db.from("aqan_document_share_messages").insert({
    organization_id: share.organization_id,
    share_id: share.id,
    message_type: action,
    author_name: authorName,
    author_email: authorEmail || null,
    message,
  });
  if (error) return reply({ error: error.message }, 400);
  const responseStatus = action === "comment" ? share.response_status : action;
  await db.from("aqan_document_shares").update({ response_status: responseStatus, updated_at: new Date().toISOString() }).eq("id", share.id);
  if ((action === "accepted" || action === "declined") && ["quotation", "proforma"].includes(share.document_type)) {
    const table = share.document_type === "quotation" ? "aqan_quotations" : "aqan_proformas";
    const nextStatus = action === "accepted" ? "accepted" : share.document_type === "quotation" ? "declined" : "rejected";
    await db.from(table).update({ status: nextStatus }).eq("id", share.document_id).eq("organization_id", share.organization_id);
  }
  return reply({ ok: true, responseStatus });
}
