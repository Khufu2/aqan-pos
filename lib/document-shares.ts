import { supabase } from "./supabase";

export type ShareableDocumentType = "invoice" | "quotation" | "proforma";

export async function createDocumentShare(input: {
  documentType: ShareableDocumentType;
  documentId: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  permission?: "view" | "comment";
}) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in again before sharing a document.");
  const response = await fetch("/api/document-shares", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The secure share link could not be created.");
  return result as { url: string; expiresAt: string };
}

export async function copyDocumentShare(input: Parameters<typeof createDocumentShare>[0]) {
  const share = await createDocumentShare(input);
  await navigator.clipboard.writeText(share.url);
  return share;
}
