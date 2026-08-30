"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import "../share.css";

type SharedPayload = {
  share: { type: "invoice" | "quotation" | "proforma"; permission: "view" | "comment"; responseStatus: string; expiresAt: string };
  business: { legal_name?: string; address?: string; phone?: string; email?: string; tin?: string; vrn?: string; payment_terms?: string; invoice_footer?: string; quotation_accent?: string } | null;
  document: Record<string, unknown> & { number: string; status: string; issuedAt: string; validUntil?: string; subtotal: number; vat_amount: number; total: number; amount_paid?: number; balance_due?: number; notes?: string; customer?: { name?: string; contact_name?: string; email?: string; phone?: string; city?: string } | null; items?: Array<Record<string, unknown>> };
  messages: Array<{ id: string; message_type: string; author_name: string; message: string; created_at: string }>;
};

const money = (value: unknown) => `TZS ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const date = (value: unknown) => value ? new Intl.DateTimeFormat("en-TZ", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(String(value))) : "—";

export default function SharedDocumentPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<SharedPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const response = await fetch(`/api/public-share/${encodeURIComponent(params.token)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Document unavailable.");
    setData(result);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Document unavailable.")); }, 0);
    return () => window.clearTimeout(timer);
  }, [params.token]);
  const respond = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const response = await fetch(`/api/public-share/${encodeURIComponent(params.token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form), action: submitter?.value || "comment" }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Response could not be sent."); setBusy(false); return; }
    formElement.reset(); await load(); setBusy(false);
  };
  if (error && !data) return <main className="share-error"><div><span>AQAN BIOMEDICAL</span><h1>Document unavailable</h1><p>{error}</p></div></main>;
  if (!data) return <main className="share-error"><div><span>AQAN BIOMEDICAL</span><h1>Opening secure document…</h1><p>Checking the link and loading the latest version.</p></div></main>;
  const { document, business, share } = data;
  const customer = document.customer;
  const canDecide = share.type !== "invoice";
  return <main className="share-shell" style={{ "--share-accent": business?.quotation_accent || "#0d9bd7" } as React.CSSProperties}>
    <header className="share-toolbar"><strong>Secure AQAN document</strong><div><span>Expires {date(share.expiresAt)}</span><button onClick={() => window.print()}>Download / Print PDF</button></div></header>
    <article className="share-document">
      <section className="share-brand"><div><span>{business?.legal_name || "AQAN Biomedical Solutions"}</span><p>{business?.address}<br/>{business?.phone} {business?.email}</p></div><div><b>{share.type.replace("proforma", "proforma invoice").toUpperCase()}</b><h1>{document.number}</h1><em>{String(document.status || share.responseStatus).replaceAll("_", " ")}</em></div></section>
      <section className="share-meta"><div><small>ISSUED</small><strong>{date(document.issuedAt)}</strong>{document.validUntil ? <span>Valid / due {date(document.validUntil)}</span> : null}</div><div><small>PREPARED FOR</small><strong>{customer?.name || "Customer"}</strong><span>{[customer?.contact_name, customer?.email, customer?.phone, customer?.city].filter(Boolean).join(" · ")}</span></div></section>
      <div className="share-table-wrap"><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{(document.items || []).map((item, index) => <tr key={String(item.id || index)}><td><b>{String(item.description || item.product_name || "Item")}</b><small>{String(item.sku || "")}</small></td><td>{String(item.quantity || 0)}</td><td>{money(item.unit_price)}</td><td>{money(item.line_total)}</td></tr>)}</tbody></table></div>
      <section className="share-totals"><div><span>Subtotal</span><b>{money(document.subtotal)}</b></div><div><span>Tax / VAT</span><b>{money(document.vat_amount)}</b></div>{document.amount_paid !== undefined ? <div><span>Paid</span><b>{money(document.amount_paid)}</b></div> : null}<div className="grand"><span>{document.balance_due ? "Balance due" : "Total"}</span><b>{money(document.balance_due || document.total)}</b></div></section>
      {document.notes || business?.payment_terms ? <section className="share-terms"><h2>Terms & notes</h2>{document.notes ? <p>{String(document.notes)}</p> : null}{business?.payment_terms ? <p><b>Payment:</b> {business.payment_terms}</p> : null}</section> : null}
      {business?.invoice_footer ? <footer>{business.invoice_footer}</footer> : null}
    </article>
    {share.permission === "comment" ? <section className="share-collaboration"><div><span>CUSTOMER COLLABORATION</span><h2>Approve or request a change</h2><p>Issued invoices remain audit-safe: requests are sent to AQAN for review instead of silently changing accounting records.</p></div><form onSubmit={respond}><label>Your name<input name="authorName" required maxLength={160}/></label><label>Email (optional)<input name="authorEmail" type="email" maxLength={320}/></label><label className="wide">Message<textarea name="message" required maxLength={4000} rows={4} placeholder="Describe the correction, delivery detail, purchase order reference, or approval note."/></label><div className="share-response-actions"><button name="action" value="changes_requested" disabled={busy}>Request changes</button><button name="action" value="comment" disabled={busy}>Send comment</button>{canDecide ? <><button className="decline" name="action" value="declined" disabled={busy}>Decline</button><button className="accept" name="action" value="accepted" disabled={busy}>Accept document</button></> : null}</div>{error ? <p className="share-form-error">{error}</p> : null}</form>{data.messages.length ? <div className="share-thread"><h3>Response history</h3>{data.messages.map((message) => <article key={message.id}><b>{message.author_name} · {message.message_type.replaceAll("_", " ")}</b><p>{message.message}</p><small>{date(message.created_at)}</small></article>)}</div> : null}</section> : null}
  </main>;
}
