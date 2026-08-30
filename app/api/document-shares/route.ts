import { createHash, randomBytes } from "node:crypto";
import { createServiceClient } from "../../../lib/server-supabase";

const allowedTypes = new Set(["invoice", "quotation", "proforma"]);
const allowedRoles = new Set(["owner", "admin", "manager", "sales", "salesperson", "accountant"]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Sign in again before sharing a document." }, 401);
  const db = createServiceClient();
  const { data: auth, error: authError } = await db.auth.getUser(bearer);
  if (authError || !auth.user) return json({ error: "Your session has expired." }, 401);

  const payload = await request.json().catch(() => null) as null | Record<string, unknown>;
  const documentType = String(payload?.documentType || "");
  const documentId = String(payload?.documentId || "");
  const permission = payload?.permission === "view" ? "view" : "comment";
  if (!allowedTypes.has(documentType) || !/^[0-9a-f-]{36}$/i.test(documentId)) {
    return json({ error: "Choose a valid document to share." }, 400);
  }

  const { data: membership } = await db.from("aqan_memberships").select("organization_id,role")
    .eq("user_id", auth.user.id).order("created_at").limit(1).maybeSingle();
  if (!membership || !allowedRoles.has(membership.role)) {
    return json({ error: "Your role cannot create customer document links." }, 403);
  }

  const table = documentType === "invoice" ? "aqan_sales" : documentType === "quotation" ? "aqan_quotations" : "aqan_proformas";
  const { data: document } = await db.from(table).select("id").eq("id", documentId)
    .eq("organization_id", membership.organization_id).maybeSingle();
  if (!document) return json({ error: "Document not found in your workspace." }, 404);

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const { error } = await db.from("aqan_document_shares").insert({
    organization_id: membership.organization_id,
    document_type: documentType,
    document_id: documentId,
    token_hash: tokenHash,
    permission,
    recipient_name: typeof payload?.recipientName === "string" ? payload.recipientName.slice(0, 160) : null,
    recipient_email: typeof payload?.recipientEmail === "string" ? payload.recipientEmail.slice(0, 320) : null,
    expires_at: expiresAt,
    created_by: auth.user.id,
  });
  if (error) return json({ error: error.message }, 400);

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const requestOrigin = new URL(request.url).origin;
  return json({ url: `${configuredOrigin || requestOrigin}/share/${token}`, expiresAt });
}
