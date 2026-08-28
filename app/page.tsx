Warning: truncated output (original token count: 46780)
Total output lines: 1923

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Session } from "@supabase/supabase-js";
import {
  askAqanAI,
  claimFirstOwner,
  inviteStaff,
  completeSale,
  createCampaign,
  createCustomer,
  createAdvancedQuotation,
  createProduct,
  createQuotation,
  createServiceRequest,
  createDeliveryNote,
  createGatePass,
  createSupplier,
  createWarehouse,
  createPurchaseOrder,
  openCashSession,
  receiveStock,
  closeCashSession,
  uploadBrandLogo,
  brandLogoUrl,
  updateDocumentDesign,
  updateProduct,
  setProductStock,
  replaceProductImage,
  loadQuotationDetail,
  updateQuotationStatus,
  confirmDelivery,
  saveBusinessSettings,
  productImageUrl,
  recordCrmOutreach,
  loadCrmActivities,
  updateCrmLead,
  emptyAqanData,
  getMembership,
  loadAqanData,
  requestWorkspaceAccess,
  signIn,
  signOut,
  signUp,
  resendSignupConfirmation,
  loadStaff,
  setMemberRole,
  updateMyPassword,
  updateMyProfile,
  subscribeToSession,
  type AqanData,
  type BusinessSettings,
  type Customer,
  type CrmActivity,
  type Membership,
  type Product,
  type QuotationDetail,
  type StaffMember,
  type AssignableRole,
} from "../lib/aqan";
import { isSupabaseConfigured } from "../lib/supabase";
import OperationsView, { type OperationsMode } from "./components/OperationsView";
import { addCustomer, completeOperationalSale } from "../lib/operations";

const FacilityMap = dynamic(() => import("./components/FacilityMap"), { ssr: false });

declare global { interface HTMLElement { requestSubmit: () => void; } }

type IconName =
  | "home" | "sale" | "inventory" | "customers" | "quote" | "service"
  | "campaign" | "insights" | "search" | "bell" | "plus" | "arrow"
  | "sparkles" | "trend" | "warning" | "check" | "close" | "minus"
  | "trash" | "shield" | "more";

const iconPaths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5M9 21v-7h6v7"/></>,
  sale: <><path d="M4 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H7"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
  inventory: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></>,
  customers: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  quote: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></>,
  service: <><path d="M14.7 6.3a4 4 0 0 0-5-5L7 4l3 3 2.7-.7Z"/><path d="m5 13-3 3 6 6 3-3M12 8l8 8M16 12l4-4 3 3-4 4"/></>,
  campaign: <><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11.6 15.4 13 21H7l-1.7-7"/></>,
  insights: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>, arrow: <><path d="m9 18 6-6-6-6"/></>,
  sparkles: <><path d="m12 3-1.2 3.8L7 8l3.8 1.2L12 13l1.2-3.8L17 8l-3.8-1.2L12 3Z"/><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14ZM19 13l-.6 1.4L17 15l1.4.6L19 17l.6-1.4L21 15l-1.4-.6L19 13Z"/></>,
  trend: <><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></>,
  warning: <><path d="M10.3 3.6 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
  check: <path d="m5 12 4 4L19 6"/>, close: <path d="m6 6 12 12M18 6 6 18"/>, minus: <path d="M5 12h14"/>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/><path d="M10 11v6M14 11v6"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
};

function Icon({ name, size = 20, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

const nav = [
  { id: "dashboard", label: "Overview", icon: "home" as IconName },
  { id: "sell", label: "New sale", icon: "sale" as IconName },
  { id: "invoices", label: "Invoices & documents", icon: "quote" as IconName },
  { id: "quotes", label: "Quotations", icon: "quote" as IconName },
  { id: "returns", label: "Returns & credit notes", icon: "sale" as IconName },
  { id: "payments", label: "Payments", icon: "trend" as IconName },
  { id: "inventory", label: "Products & inventory", icon: "inventory" as IconName },
  { id: "purchases", label: "Purchases & suppliers", icon: "inventory" as IconName },
  { id: "customers", label: "Customers", icon: "customers" as IconName },
  { id: "expenses", label: "Expenses", icon: "sale" as IconName },
  { id: "reports", label: "Reports", icon: "insights" as IconName },
  { id: "crm", label: "Facility CRM", icon: "customers" as IconName },
  { id: "service", label: "Service & warranty", icon: "service" as IconName },
  { id: "campaigns", label: "Campaigns", icon: "campaign" as IconName },
  { id: "logistics", label: "Dispatch & gate", icon: "service" as IconName },
  { id: "insights", label: "Intelligence", icon: "insights" as IconName },
  { id: "team", label: "Team & access", icon: "customers" as IconName },
  { id: "settings", label: "Business settings", icon: "more" as IconName },
];

const formatTzs = (value: number) => `TZS ${value.toLocaleString("en-US")}`;
type AqanLanguage = "en" | "sw";
type AqanTheme = "light" | "dark" | "system";
const swNav: Record<string, string> = { dashboard: "Muhtasari", sell: "Mauzo mapya", invoices: "Ankara", returns: "Marejesho", payments: "Malipo", inventory: "Bidhaa na stoo", purchases: "Manunuzi", expenses: "Gharama", reports: "Ripoti", customers: "Wateja", crm: "CRM ya vituo", quotes: "Nukuu", service: "Huduma", campaigns: "Kampeni", logistics: "Usafirishaji", insights: "Akili", team: "Wafanyakazi", settings: "Mipangilio" };
const languageOptions: Array<{ value: AqanLanguage; flag: string; label: string }> = [{ value: "en", flag: "🇬🇧", label: "English" }, { value: "sw", flag: "🇹🇿", label: "Kiswahili" }];

function Logo() {
  return <div className="brand aqan-brand"><img src="/aqan-biomedical-solutions.svg" alt="Aqan Biomedical Solutions"/></div>;
}

function firstName(name: string) {
  return name.trim().split(/\s+/).find(Boolean) || "there";
}

function timeGreeting(language: AqanLanguage) {
  const hour = new Date().getHours();
  if (language === "sw") return hour < 12 ? "Habari za asubuhi" : hour < 18 ? "Habari za mchana" : "Habari za jioni";
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function todayLabel(language: AqanLanguage) {
  return new Intl.DateTimeFormat(language === "sw" ? "sw-TZ" : "en-TZ", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

function whatsappPhone(phone: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("255") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `255${digits.slice(1)}`;
  if (digits.length === 9 && /^[67]/.test(digits)) return `255${digits}`;
  return digits;
}

function KpiCard({ label, value, note, icon, tone = "blue" }: { label: string; value: string; note: string; icon: IconName; tone?: string }) {
  return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon name={icon} size={19}/></div><div className="kpi-heading"><span>{label}</span><button aria-label={`More options for ${label}`}><Icon name="more" size={17}/></button></div><strong className="kpi-value">{value}</strong><span className="kpi-note"><b>↗</b> {note}</span></article>;
}

function Dashboard({ onNavigate, data, displayName, language }: { onNavigate: (view: string) => void; data: AqanData; displayName: string; language: AqanLanguage }) {
  const inventoryValue = data.products.reduce((sum, product) => sum + Number(product.price) * product.stock, 0);
  const salesToday = data.sales.filter((sale) => new Date(sale.sold_at).toDateString() === new Date().toDateString()).reduce((sum, sale) => sum + Number(sale.total), 0);
  const openQuotes = data.quotations.filter((quote) => !["accepted", "declined", "expired"].includes(quote.status)).length;
  const recentSale = data.sales[0];
  return <div className="page-content">
    <section className="welcome-row">
      <div><div className="eyebrow"><span className="live-dot"/> {todayLabel(language)}</div><h1>{timeGreeting(language)}, {firstName(displayName)}.</h1><p>{language === "sw" ? "Hiki ndicho kinachoendelea kwenye biashara yako ya vifaa tiba leo." : "Here’s what is moving across your medical supply business today."}</p></div>
      <div className="header-actions"><button className="button secondary" onClick={() => onNavigate("quotes")}><Icon name="quote" size={18}/> {language === "sw" ? "Nukuu mpya" : "New quotation"}</button><button className="button primary" onClick={() => onNavigate("sell")}><Icon name="plus" size={18}/> {language === "sw" ? "Mauzo mapya" : "New sale"}</button></div>
    </section>
    <section className="kpi-grid" aria-label="Business summary">
      <KpiCard label={language === "sw" ? "Mauzo ya leo" : "Sales today"} value={formatTzs(salesToday)} note={`${data.sales.length} ${language === "sw" ? "miamala ya hivi karibuni" : "recent transactions"}`} icon="trend"/>
      <KpiCard label={language === "sw" ? "Nukuu zilizofunguliwa" : "Open quotations"} value={String(openQuotes)} note={language === "sw" ? "mnyororo wa mauzo" : "live sales pipeline"} icon="quote" tone="violet"/>
      <KpiCard label={language === "sw" ? "Thamani ya bidhaa" : "Inventory value"} value={formatTzs(inventoryValue)} note={`${data.products.length} ${language === "sw" ? "bidhaa zinafuatiliwa" : "products tracked"}`} icon="inventory" tone="mint"/>
      <KpiCard label={language === "sw" ? "Wateja hai" : "Active customers"} value={String(data.customers.filter((customer) => customer.status === "active").length)} note={language === "sw" ? "data imelindwa" : "secured by workspace access"} icon="customers" tone="orange"/>
    </section>
    <section className="dashboard-grid">
      <article className="panel revenue-panel">
        <div className="panel-header"><div><span className="section-kicker">Performance</span><h2>Revenue movement</h2></div><select aria-label="Revenue period"><option>Last 7 days</option><option>This month</option><option>This year</option></select></div>
        <div className="revenue-summary"><strong>{formatTzs(data.sales.reduce((sum, sale) => sum + Number(sale.total), 0))}</strong><span>Live</span><small>recorded sales</small></div>
        <div className="chart-wrap" aria-label="Revenue line chart"><div className="chart-y"><span>12M</span><span>8M</span><span>4M</span><span>0</span></div>
          <svg viewBox="0 0 650 180" role="img" aria-label="Revenue increased during the week"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity=".28"/><stop offset="100%" stopColor="#38bdf8" stopOpacity="0"/></linearGradient></defs><g className="grid-lines"><line x1="0" y1="20" x2="650" y2="20"/><line x1="0" y1="70" x2="650" y2="70"/><line x1="0" y1="120" x2="650" y2="120"/><line x1="0" y1="170" x2="650" y2="170"/></g><path d="M0 145 C55 135 65 104 115 111 S195 141 240 95 S330 103 365 70 S445 85 485 52 S575 83 650 26 L650 180 L0 180Z" fill="url(#area)"/><path d="M0 145 C55 135 65 104 115 111 S195 141 240 95 S330 103 365 70 S445 85 485 52 S575 83 650 26" fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/><circle cx="650" cy="26" r="5" fill="#fff" stroke="#0ea5e9" strokeWidth="3"/></svg>
          <div className="chart-x"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
        </div>
      </article>
      <article className="panel intelligence-panel">
        <div className="ai-title"><div className="ai-orb"><Icon name="sparkles" size={19}/></div><div><span>AQAN AI</span><h2>Smart actions</h2></div><span className="beta">Live</span></div>
        <div className="smart-action urgent"><div className="smart-icon"><Icon name="trend" size={18}/></div><div><strong>Restock opportunity</strong><p>Infusion pumps sell 31% faster this month. Order 15 units before Friday.</p><button>Review forecast <Icon name="arrow" size={14}/></button></div></div>
        <div className="smart-action"><div className="smart-icon"><Icon name="campaign" size={18}/></div><div><strong>New product audience found</strong><p>27 clinics are a strong match for the new portable ultrasound.</p><button onClick={() => onNavigate("campaigns")}>Create campaign <Icon name="arrow" size={14}/></button></div></div>
        <button className="ask-ai" onClick={() => onNavigate("insights")}><Icon name="sparkles" size={17}/> Ask AQAN AI about your business</button>
      </article>
    </section>
    <section className="bottom-grid">
      <article className="panel activity-panel"><div className="panel-header"><div><span className="section-kicker">Live feed</span><h2>Recent activity</h2></div><button className="text-button">View all</button></div><div className="activity-list">
        {recentSale ? <div className="activity"><span className="activity-icon sale"><Icon name="sale" size={17}/></span><div><strong>Sale completed · {recentSale.invoice_number}</strong><p>{recentSale.customer?.name ?? "Walk-in buyer"} · Biomedical equipment</p></div><b>{formatTzs(Number(recentSale.total))}</b><time>Live</time></div> : <div className="activity"><span className="activity-icon sale"><Icon name="sale" size={17}/></span><div><strong>No sales recorded yet</strong><p>Create products, then open Point of sale to begin.</p></div></div>}
      </div></article>
      <article className="panel stock-panel"><div className="panel-header"><div><span className="section-kicker">Attention</span><h2>Stock watch</h2></div><button className="text-button" onClick={() => onNavigate("inventory")}>Inventory</button></div>
        {data.products.filter((product) => product.stock <= product.reorder_level).slice(0, 3).map((product) => <div className="stock-item" key={product.id}><span className="product-mini blue">{product.sku.slice(0, 2)}</span><div><strong>{product.name}</strong><p>{product.stock} units remaining</p></div><span className="low">Low</span></div>)}{!data.products.some((product) => product.stock <= product.reorder_level) ? <div className="stock-item"><span className="product-mini mint">✓</span><div><strong>No stock alerts</strong><p>Add products to begin stock monitoring.</p></div></div> : null}
      </article>
    </section>
  </div>;
}

function PointOfSale({ products, customers, vatRate, onToast, onCheckout }: {
  products: Product[];
  customers: Customer[];
  vatRate: number;
  onToast: (message: string) => void;
  onCheckout: (items: Array<{ product_id: string; quantity: number }>, paymentMethod: string, amountReceived: number, customerId: string | null, paymentProvider: string | null, contact: { name: string; phone: string; email: string }) => Promise<{ message: string; invoiceNumber: string; total: number; balanceDue: number } | null>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All equipment");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState("m_pesa");
  const [amountReceived, setAmountReceived] = useState(0);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [completedSale, setCompletedSale] = useState<{ invoiceNumber: string; total: number; paymentMethod: string; balanceDue: number } | null>(null);
  const categories = ["All equipment", "Monitoring", "Imaging", "Critical care", "Respiratory", "Diagnostics"];
  const filtered = products.filter((product) => (category === "All equipment" || product.category === category) && `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase()));
  const cartRows = products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] }));
  const subtotal = cartRows.reduce((sum, row) => sum + Number(row.price) * row.qty, 0);
  const vat = subtotal * (vatRate / 100);
  const total = subtotal + vat;
  const setQty = (id: string, qty: number) => setCart((current) => { const next = { ...current }; if (qty <= 0) delete next[id]; else next[id] = Math.min(qty, products.find((product) => product.id === id)?.stock ?? qty); return next; });
  const complete = async (paymentMethod: string) => {
    setCompleting(true);
    try {
      const received = paymentMethod === "credit" ? 0 : Math.min(Math.max(amountReceived || total, 0), total);
      const result = await onCheckout(cartRows.map((row) => ({ product_id: row.id, quantity: row.qty })), paymentMethod, received, customerId || null, paymentMethod === "mobile_money" ? paymentProvider : null, { name: contactName, phone: contactPhone, email: contactEmail });
      if (!result) return;
      setReceiptOpen(false);
      setCart({});
      setCompletedSale({ invoiceNumber: result.invoiceNumber, total: result.total, paymentMethod, balanceDue: result.balanceDue });
      onToast(result.message);
    } finally {
      setCompleting(false);
    }
  };
  return <div className="pos-page">
    <section className="pos-products">
      <div className="pos-title"><div><span className="section-kicker">Sales desk</span><h1>Point of sale</h1><p>Select equipment and build the order.</p></div><span className="register-badge"><span/> Register 01 · Open</span></div>
      <div className="catalog-search"><Icon name="search" size={19}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products, SKU or scan barcode"/><kbd>⌘ K</kbd></div>
      <div className="category-pills">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={category === item ? "active" : ""}>{item}</button>)}</div>
      <div className="product-grid">{filtered.map((product) => <button className="product-card" key={product.id} disabled={product.stock === 0} onClick={() => setQty(product.id, (cart[product.id] || 0) + 1)}><div className="product-visual" style={{ background: product.color }}>{productImageUrl(product.image_path) ? <img src={productImageUrl(product.image_path)!} alt=""/> : <Icon name="inventory" size={31}/>}<span>{product.stock} in stock</span></div><span className="product-category">{product.category}</span><strong>{product.name}</strong><div><b>{formatTzs(Number(product.price))}</b><small>{product.sku}</small></div>{cart[product.id] ? <span className="in-cart"><Icon name="check" size={13}/> {cart[product.id]} in order</span> : null}</button>)}</div>
    </section>
    <aside className="cart-panel">
      <div className="cart-header"><div><span>Current order</span><h2>Walk-in sale</h2></div><button aria-label="More order options"><Icon name="more"/></button></div>
      <div className="customer-select"><span className="customer-avatar">{customerId ? "HC" : "WM"}</span><span><small>Customer</small><select aria-label="Select customer" value={customerId} onChange={(event) => { const id = event.target.value; setCustomerId(id); const customer = customers.find((item) => item.id === id); setContactName(customer?.name || ""); setContactPhone(customer?.phone || ""); setContactEmail(customer?.email || ""); }}><option value="">Walk-in medical buyer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></span><Icon name="arrow" size={17}/></div>
      <div className="cart-label"><span>{cartRows.length} items</span><button onClick={() => setCart({})}>Clear order</button></div>
      <div className="cart-items">{cartRows.length ? cartRows.map((row) => <div className="cart-item" key={row.id}><span className="cart-product-icon" style={{background: row.color}}><Icon name="inventory" size={18}/></span><div className="cart-product-name"><strong>{row.name}</strong><small>{formatTzs(Number(row.price))}</small></div><div className="qty"><button onClick={() => setQty(row.id, row.qty - 1)} aria-label={`Decrease ${row.name}`}><Icon name="minus" size={13}/></button><span>{row.qty}</span><button onClick={() => setQty(row.id, row.qty + 1)} disabled={row.qty >= row.stock} aria-label={`Increase ${row.name}`}><Icon name="plus" size={13}/></button></div><strong className="line-total">{formatTzs(Number(row.price) * row.qty)}</strong><button className="remove" onClick={() => setQty(row.id, 0)} aria-label={`Remove ${row.name}`}><Icon name="trash" size={15}/></button></div>) : <div className="empty-cart"><span><Icon name="sale" size={27}/></span><strong>Your order is empty</strong><p>Select equipment from the catalogue to begin.</p></div>}</div>
      <div className="cart-summary"><div><span>Subtotal</span><strong>{formatTzs(subtotal)}</strong></div><div><span>VAT ({vatRate}%)</span><strong>{formatTzs(vat)}</strong></div><div className="total"><span>Total</span><strong>{formatTzs(total)}</strong></div><button className="checkout" disabled={!cartRows.length} onClick={() => setReceiptOpen(true)}><span>Proceed to payment</span><span>{formatTzs(total)} <Icon name="arrow" size={17}/></span></button><div className="fiscal"><Icon name="shield" size={15}/> Secure invoice and stock posting</div></div>
    </aside>
    {receiptOpen ? <div className="modal-backdrop"><div className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title"><button className="modal-close" disabled={completing} onClick={() => setReceiptOpen(false)} aria-label="Close"><Icon name="close"/></button><span className="success-icon"><Icon name="check" size={30}/></span><span className="section-kicker">Secure payment</span><h2 id="payment-title">Collect {formatTzs(total)}</h2><p>Record a full payment, partial payment or customer credit. Stock, invoice and balance post together.</p><div className="form-grid compact"><label>Buyer / facility<input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Walk-in buyer or facility"/></label><label>Mobile number<input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+255…"/></label><label className="span-two">Email<input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="Optional email"/></label><label className="span-two">Amount received <input type="number" min="0" max={total} value={amountReceived || total} onChange={(event) => setAmountReceived(Number(event.target.value))}/><small>Leave at the full total for a paid invoice, enter less for a partial payment.</small></label></div><div className="payment-methods complete"><button disabled={completing} onClick={() => void complete("cash")}>Cash <small>Record cash payment</small></button><button disabled={completing} onClick={() => void complete("card")}>Card <small>Visa or Mastercard</small></button><button disabled={completing} onClick={() => void complete("mobile_money")}>Mobile money <small>Record selected provider</small></button><button disabled={completing} onClick={() => void complete("bank_transfer")}>Bank transfer <small>Record account transfer</small></button><button disabled={completing || !customerId} onClick={() => void complete("credit")}>Credit sale <small>{customerId ? "Record customer credit" : "Select a customer first"}</small></button></div><label className="mobile-provider">Mobile provider<select value={paymentProvider} onChange={(event) => setPaymentProvider(event.target.value)}><option value="m_pesa">M-Pesa</option><option value="airtel_money">Airtel Money</option><option value="tigo_pesa">Tigo Pesa</option><option value="halopesa">HaloPesa</option><option value="mixx_by_yas">Mixx by Yas</option><option value="other">Other</option></select></label>{completing ? <p className="form-note">Validating stock and securing the transaction…</p> : null}</div></div> : null}
    {completedSale ? <div className="modal-backdrop"><div className="payment-modal sale-complete" role="dialog" aria-modal="true" aria-labelledby="sale-complete-title"><span className="success-icon"><Icon name="check" size={30}/></span><span className="section-kicker">Sale completed</span><h2 id="sale-complete-title">{completedSale.invoiceNumber}</h2><p>{formatTzs(completedSale.total)} recorded via {completedSale.paymentMethod.replaceAll("_", " ")}. {completedSale.balanceDue ? `${formatTzs(completedSale.balanceDue)} remains due on the customer account.` : "Paid in full."}</p><div className="modal-actions"><button className="button secondary" onClick={() => { const popup = window.open("", "_blank", "width=600,height=760"); if (!popup) { onToast("Allow pop-ups to print the invoice receipt."); return; } popup.document.write(`<!doctype html><html><head><title>${safeDocumentText(completedSale.invoiceNumber)}</title><style>body{font-family:Arial;padding:38px;color:#16364d}h1{font-size:24px;border-bottom:3px solid #0ea5e9;padding-bottom:16px}.total{font-size:25px;font-weight:bold;margin:28px 0}.note{background:#f0f9fd;padding:15px;border-radius:10px}@media print{body{padding:10px}}</style></head><body><h1>AQAN Biomedical Solutions</h1><h2>Invoice ${safeDocumentText(completedSale.invoiceNumber)}</h2><div class="total">${safeDocumentText(formatTzs(completedSale.total))}</div><p>Payment method: ${safeDocumentText(completedSale.paymentMethod.replaceAll("_", " "))}</p><p>Balance due: ${safeDocumentText(formatTzs(completedSale.balanceDue))}</p><p class="note">This transaction is recorded in AQAN BIOMEDICAL POS. Open Invoices & documents for the complete audit record.</p><script>window.onload=()=>window.print()</script></body></html>`); popup.document.close(); }}>Print receipt</button><button className="button primary" onClick={() => setCompletedSale(null)}>Start another sale</button></div></div></div> : null}
  </div>;
}

function WorkspaceHeader({ kicker, title, description, action, onAction }: { kicker: string; title: string; description: string; action: string; onAction: () => void }) {
  return <div className="workspace-header"><div><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div><button className="button primary" onClick={onAction}><Icon name="plus" size={17}/>{action}</button></div>;
}

function ProductRecordModal({ product, membership, onClose, onRefresh, onToast, onOpenPos }: { product: Product; membership: Membership; onClose: () => void; onRefresh: () => Promise<void>; onToast: (message: string) => void; onOpenPos: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canEdit = ["owner", "admin"].includes(membership.role);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const photo = form.get("image");
      await Promise.all([
        updateProduct({ id: product.id, name: String(form.get("name") || "").trim(), sku: String(form.get("sku") || "").trim().toUpperCase(), category: String(form.get("category") || "").trim(), description: String(form.get("description") || "").trim() || null, price: Number(form.get("price") || 0), cost: Number(form.get("cost") || 0), reorder_level: Number(form.get("reorder_level") || 0), serial_tracked: form.get("serial_tracked") === "on", active: product.active }),
        setProductStock(product.id, Number(form.get("stock") || 0)),
        photo instanceof File && photo.size ? replaceProductImage(product.id, membership.organization_id, photo) : Promise.resolve(null),
      ]);
      await onRefresh(); onToast("Product record updated in the live catalogue."); onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Product could not be updated."); }
    finally { setBusy(false); }
  };
  const retire = async () => {
    if (!canEdit) return;
    setBusy(true); setError("");
    try { await updateProduct({ ...product, active: false }); await onRefresh(); onToast("Product archived. Its historical sales remain intact."); onClose(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Product could not be archived."); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="create-modal" style={{width:"min(760px,100%)"}} onSubmit={save} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="product-record-title"><button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close"/></button><span className="section-kicker">Live catalogue record</span><h2 id="product-record-title">{product.name}</h2><p>{product.sku} · {product.category} · {product.serial_tracked ? "Serial tracking enabled" : "Serial tracking optional"}</p><section className="summary-strip" style={{margin:"18px 0"}}><div><span>Available stock</span><strong>{product.stock}</strong><small>{product.stock <= product.reorder_level ? "Reorder attention needed" : "Units available to sell"}</small></div><div><span>Selling price</span><strong style={{fontSize:16}}>{formatTzs(Number(product.price))}</strong><small>VAT handling follows sale settings</small></div><div><span>Unit cost</span><strong style={{fontSize:16}}>{formatTzs(Number(product.cost))}</strong><small>Restricted to authorised editors</small></div><div><span>Stock state</span><strong style={{fontSize:16}}>{product.stock <= product.reorder_level ? "Low" : "Healthy"}</strong><small>Reorder level: {product.reorder_level}</small></div></section><div className="form-grid">{productImageUrl(product.image_path) ? <div className="span-two" style={{display:"flex",alignItems:"center",gap:12}}><img src={productImageUrl(product.image_path)!} alt={product.name} style={{width:86,height:86,objectFit:"cover",borderRadius:14,border:"1px solid #dce8ee"}}/><small>Product image is published to the AQAN catalogue. Choose another photo below to replace it.</small></div> : <div className="span-two form-note">No product photo yet. Upload one below so it appears in Inventory and POS.</div>}<label className="span-two">Product photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" disabled={!canEdit || busy}/><small>JPG, PNG or WebP · maximum 5MB</small></label><label className="span-two">Product name<input name="name" defaultValue={product.name} disabled={!canEdit || busy} required/></label><label>SKU<input name="sku" defaultValue={product.sku} disabled={!canEdit || busy} required/></label><label>Category<input name="category" defaultValue={product.category} disabled={!canEdit || busy} required/></label><label>Available stock<input name="stock" type="number" min="0" step="1" defaultValue={product.stock} disabled={!canEdit || busy} required/></label><label>Reorder level<input name="reorder_level" type="number" min="0" defaultValue={product.reorder_level} disabled={!canEdit || busy} required/></label><label>Sale price (TZS)<input name="price" type="number" min="0" defaultValue={product.price} disabled={!canEdit || busy} required/></label><label>Unit cost (TZS)<input name="cost" type="number" min="0" defaultValue={product.cost} disabled={!canEdit || busy} required/></label><label className="check-field"><input name="serial_tracked" type="checkbox" defaultChecked={product.serial_tracked} disabled={!canEdit || busy}/> Track serial numbers</label><label className="span-two">Product description<textarea name="description" rows={4} defaultValue={product.description || ""} placeholder="Specifications, intended use, warranty or handling note…" disabled={!canEdit || busy}/></label></div>{error ? <div className="form-error">{error}</div> : null}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => { onClose(); onOpenPos(); }}>Open POS</button>{canEdit ? <button type="button" className="button secondary" disabled={busy} onClick={() => void retire()}>Archive product</button> : null}<button type="button" className="button secondary" onClick={onClose}>Close</button>{canEdit ? <button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save product changes"}</button> : null}</div></form></div>;
}

function InventoryView({ products, membership, onToast, onAdd, onRefresh, onOpenPos }: { products: Product[]; membership: Membership; onToast: (message: string) => void; onAdd: () => void; onRefresh: () => Promise<void>; onOpenPos: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All stock");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All stock" || (filter === "Low stock" ? p.stock <= p.reorder_level : p.category === filter)));
  const inventoryValue = products.reduce((sum, product) => sum + Number(product.price) * product.stock, 0);
  const lowStock = products.filter((product) => product.stock <= product.reorder_level).length;
  return <div className="workspace-page"><WorkspaceHeader kicker="Stock control" title="Inventory" description="Track every device, reorder level, serial number and warehouse movement." action="Add product" onAction={onAdd}/>
    <section className="summary-strip"><div><span>Total stock value</span><strong>{formatTzs(inventoryValue)}</strong><small>Live catalogue valuation</small></div><div><span>Products tracked</span><strong>{products.length}</strong><small>{products.filter((product) => product.serial_tracked).length} serial-tracked lines</small></div><div><span>Low stock</span><strong className="danger-text">{lowStock}</strong><small>At or below reorder level</small></div><div><span>Stock security</span><strong>Atomic</strong><small>No overselling at checkout</small></div></section>
    <section className="table-panel"><div className="table-tools"><label><Icon name="search" size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product or SKU"/></label><div className="filter-row">{["All stock","Low stock","Monitoring","Imaging","Consumables"].map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><button className="tool-button" onClick={() => onToast("Inventory report prepared for export.")}>Export</button></div>
      <div className="data-table inventory-table"><div className="table-head"><span>Product</span><span>SKU</span><span>Category</span><span>Available</span><span>Unit price</span><span>Status</span><span/></div>{filtered.map((p) => <div className="table-row" key={p.id} onClick={() => setSelectedId(p.id)} style={{cursor:"pointer"}}><span className="product-cell"><i style={{background:p.color}}>{productImageUrl(p.image_path) ? <img src={productImageUrl(p.image_path)!} alt=""/> : <Icon name="inventory" size={17}/>}</i><b>{p.name}</b></span><span>{p.sku}</span><span>{p.category}</span><span><b>{p.stock}</b> units</span><span>{formatTzs(Number(p.price))}</span><span><em className={p.stock <= p.reorder_level ? "pill warning" : "pill success"}>{p.stock <= p.reorder_level ? "Low stock" : "In stock"}</em></span><button onClick={(event) => { event.stopPropagation(); setSelectedId(p.id); }} aria-label={`Open ${p.name}`}><Icon name="arrow" size={17}/></button></div>)}</div>
    </section>
    {selectedId ? <ProductRecordModal product={products.find((product) => product.id === selectedId)!} membership={membership} onClose={() => setSelectedId(null)} onRefresh={onRefresh} onToast={onToast} onOpenPos={onOpenPos}/> : null}
  </div>;
}

function CustomersView({ customers, onToast, onAdd }: { customers: Customer[]; onToast: (message: string) => void; onAdd: () => void }) {
  const [query, setQuery] = useState("");
  const rows = customers.map((customer) => ({
    name: customer.name,
    type: customer.customer_type,
    city: customer.city,
    contact: customer.contact_name || customer.email || customer.phone || "No contact assigned",
    spend: formatTzs(Number(customer.total_spend)),
    last: customer.last_purchase_at ? new Date(customer.last_purchase_at).toLocaleDateString("en-TZ", { day: "numeric", month: "short" }) : "No sale yet",
    score: Math.min(98, Math.max(62, Math.round(62 + Number(customer.total_spend) / 1000000))),
    initials: customer.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
  }));
  const filtered = rows.filter((c) => `${c.name} ${c.city} ${c.contact}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="workspace-page"><WorkspaceHeader kicker="Relationships" title="Customers" description="Every hospital, clinic, contact, consent record and opportunity in one intelligent CRM." action="New customer" onAction={onAdd}/>
    <section className="customer-insight"><div className="ai-orb"><Icon name="sparkles" size={20}/></div><div><span>AQAN AI CUSTOMER SIGNAL</span><strong>27 clinics are likely to need portable imaging equipment this quarter.</strong><p>Based on enquiry history, facility type and prior consumable purchases.</p></div><button onClick={() => onToast("A targeted audience of 27 customers has been created.")}>Build audience <Icon name="arrow" size={15}/></button></section>
    <section className="table-panel"><div className="table-tools"><label><Icon name="search" size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customers, contacts or city"/></label><div className="filter-row"><button className="active">All customers</button><button>Hospitals</button><button>Clinics</button><button>High value</button></div><button className="tool-button">Import</button></div>
      <div className="data-table customer-table"><div className="table-head"><span>Customer</span><span>Contact</span><span>Lifetime value</span><span>Last activity</span><span>AI fit</span><span/></div>{filtered.map((c) => <div className="table-row" key={c.name}><span className="customer-cell"><i>{c.initials}</i><span><b>{c.name}</b><small>{c.type} · {c.city}</small></span></span><span>{c.contact}</span><span><b>{c.spend}</b></span><span>{c.last}</span><span><em className="score"><i style={{width:`${c.score}%`}}/>{c.score}</em></span><button onClick={() => onToast(`Customer profile opened for ${c.name}.`)} aria-label={`Open ${c.name}`}><Icon name="arrow" size={17}/></button></div>)}</div>
    </section>
  </div>;
}

function FacilityCrmLegacy({ data, membership, onToast, onRefresh }: { data: AqanData; membership: Membership; onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const canAct = ["owner", "admin", "sales"].includes(membership.role);
  const leads = data.crmLeads.filter((lead) => `${lead.facility_name} ${lead.region || ""} ${lead.district || ""} ${lead.email || ""} ${lead.phone || ""}`.toLowerCase().includes(query.toLowerCase())).slice(0, 100);
  const reach = async (lead: AqanData["crmLeads"][number], channel: "email" | "whatsapp") => {
    if (!canAct) return;
    setBusyId(`${lead.id}-${channel}`);
    const intro = `Habari kutoka AQAN Biomedical. Tunaweza kukushauri vifaa na huduma zinazofaa kwa ${lead.facility_name}.`;
    // Reserve the browser tab while the outreach record is being saved. Mobile Safari
    // blocks a new tab opened only after an awaited Supabase request has completed.
    const digits = lead.phone?.replace(/\D/g, "") || "";
    const number = digits.startsWith("0") ? `255${digits.slice(1)}` : digits;
    const whatsappUrl = number ? `https://wa.me/${number}?text=${encodeURIComponent(intro)}` : "";
    const whatsappTab = channel === "whatsapp" && whatsappUrl ? window.open("about:blank", "_blank") : null;
    try {
      await recordCrmOutreach({ leadId: lead.id, organizationId: membership.organization_id, channel, outcome: "prepared", subject: "AQAN Biomedical equipment support", body: intro, leadStatus: "contacted" });
      if (channel === "email" && lead.email) window.open(`mailto:${lead.email}?subject=${encodeURIComponent("AQAN Biomedical equipment support")}&body=${encodeURIComponent(intro)}`, "_self");
      if (channel === "whatsapp" && whatsappUrl) {
        if (whatsappTab && !whatsappTab.closed) whatsappTab.close();
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }
      await onRefresh();
      onToast(`${channel === "email" ? "Email composer" : "WhatsApp"} opened and outreach recorded.`);
    } catch (caught) { if (whatsappTab && !whatsappTab.closed) whatsappTab.close(); onToast(caught instanceof Error ? caught.message : "Outreach could not be recorded."); } finally { setBusyId(""); }
  };
  const markReply = async (lead: AqanData["crmLeads"][number]) => {
    if (!canAct) return;
    setBusyId(`${lead.id}-reply`);
    try { await recordCrmOutreach({ leadId: lead.id, organizationId: membership.organization_id, channel: "note", outcome: "replied", body: "Reply confirmed in AQAN.", leadStatus: "qualified" }); await onRefresh(); onToast(`${lead.facility_name} marked as replied and qualified.`); } catch (caught) { onToast(caught instanceof Error ? caught.message : "Reply could not be recorded."); } finally { setBusyId(""); }
  };
  return <div className="workspace-page"><WorkspaceHeader kicker="Growth pipeline" title="Facility CRM" description={`${data.crmLeads.length.toLocaleString()} imported health facilities with contact and equipment-fit context.`} action="Ask AQAN AI" onAction={() => onToast("Open Intelligence and ask for a reach-out strategy for any facility.")}/>
    <section className="summary-strip"><div><span>Facilities</span><strong>{data.crmLeads.length.toLocaleString()}</strong><small>secured in AQAN</small></div><div><span>Email-ready</span><strong>{data.crmLeads.filter((lead) => lead.email).length}</strong><small>open a prepared email</small></div><div><span>Phone-ready</span><strong>{data.crmLeads.filter((lead) => lead.phone).length}</strong><small>WhatsApp or call follow-up</small></div><div><span>Contacted</span><strong>{data.crmLeads.filter((lead) => lead.lead_status !== "new").length}</strong><small>logged in the pipeline</small></div></section>
    <section className="table-panel"><div className="table-tools"><label><Icon name="search" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search facility, region, district, email or phone"/></label><div className="filter-row"><button className="active">Top 100 matches</button><button>{canAct ? "Outreach enabled" : "View only"}</button></div></div>
      <div className="data-table customer-table"><div className="table-head"><span>Facility</span><span>Contact route</span><span>Capability fit</span><span>Lead</span><span>Actions</span><span/></div>{leads.map((lead) => <div className="table-row" key={lead.id}><span className="customer-cell"><i>{lead.facility_name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</i><span><b>{lead.facility_name}</b><small>{lead.facility_type || "Facility"} · {lead.region || lead.city || "Tanzania"}</small></span></span><span><b>{lead.email || lead.phone || "No contact route"}</b><small>{lead.phone && lead.email ? "Email + phone" : lead.preferred_channel || "Contact missing"}</small></span><span><b>{lead.service_count} services · {lead.equipment_count} equipment lines</b><small>{lead.equipment_summary?.slice(0, 72) || lead.specialty?.slice(0, 72) || "Profile ready"}</small></span><span><em className="score"><i style={{width:`${lead.lead_score}%`}}/>{lead.lead_score}</em><small>{lead.lead_status.replace("_", " ")}</small></span><span className="modal-actions"><button className="button secondary" disabled={!canAct || !lead.email || busyId === `${lead.id}-email`} onClick={() => void reach(lead, "email")}>Email</button><button className="button secondary" disabled={!canAct || !lead.phone || busyId === `${lead.id}-whatsapp`} onClick={() => void reach(lead, "whatsapp")}>WhatsApp</button><button className="button primary" disabled={!canAct || busyId === `${lead.id}-reply`} onClick={() => void markReply(lead)}>Reply</button></span><button onClick={() => onToast(`${lead.facility_name}: ${lead.equipment_summary || lead.specialty || "No additional capability detail"}`)} aria-label={`Open ${lead.facility_name}`}><Icon name="arrow" size={17}/></button></div>)}</div>
    </section>
  </div>;
}

function FacilityCrmView({
  data,
  membership,
  language,
  onToast,
  onRefresh,
}: {
  data: AqanData;
  membership: Membership;
  language: AqanLanguage;
  onToast: (message: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [busy, setBusy] = useState(false);
  const canAct = ["owner", "admin", "sales"].includes(membership.role);
  const matchingLeads = useMemo(
    () =>
      data.crmLeads.filter(
        (lead) =>
          `${lead.facility_name} ${lead.region || ""} ${lead.district || ""} ${lead.email || ""} ${lead.phone || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (stageFilter === "all" || lead.lead_status === stageFilter),
      ),
    [data.crmLeads, query, stageFilter],
  );
  const leads = matchingLeads.slice(0, 250);
  const selected = data.crmLeads.find((lead) => lead.id === selectedId) || null;
  useEffect(() => {
    if (!selectedId) return;
    void loadCrmActivities(selectedId)
      .then(setActivities)
      .catch(() => undefined);
  }, [selectedId]);
  const log = async (
    channel: CrmActivity["channel"],
    outcome:
      | "prepared"
      | "contacted"
      | "replied"
      | "qualified"
      | "proposal_sent"
      | "not_a_fit"
      | "note",
    stage: string,
    body: string,
  ) => {
    if (!selected || !canAct) return;
    setBusy(true);
    try {
      await recordCrmOutreach({
        leadId: selected.id,
        organizationId: membership.organization_id,
        channel,
        outcome,
        body,
        leadStatus: stage,
      });
      await onRefresh();
      setActivities(await loadCrmActivities(selected.id));
      onToast("Activity recorded in the facility timeline.");
    } catch (caught) {
      onToast(
        caught instanceof Error
          ? caught.message
          : "Activity could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const savePlan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !canAct) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await updateCrmLead({
        leadId: selected.id,
        leadStatus: String(form.get("stage")),
        nextActionAt: String(form.get("next_action_at") || "")
          ? new Date(String(form.get("next_action_at"))).toISOString()
          : null,
        notes: String(form.get("notes") || "") || null,
      });
      await onRefresh();
      onToast("Opportunity stage and next action saved.");
    } catch (caught) {
      onToast(
        caught instanceof Error ? caught.message : "Plan could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const contactName = (lead: AqanData["crmLeads"][number]) =>
    lead.contact_name?.trim() ||
    (language === "sw"
      ? `timu ya ${lead.facility_name}`
      : `the ${lead.facility_name} team`);
  const outreachMessage = (lead: AqanData["crmLeads"][number]) =>
    language === "sw"
      ? `Habari ${contactName(lead)},\n\nKutoka AQAN Biomedical Solutions. Tungependa kuelewa mahitaji ya ${lead.facility_name} kuhusu vifaa tiba, consumables au huduma ya kiufundi, kisha kushiriki mapendekezo yanayofaa.\n\nTafadhali tujulishe muda mzuri wa kuzungumza.\n\nKwa heshima,\nAQAN Biomedical Solutions`
      : `Hello ${contactName(lead)},\n\nThis is AQAN Biomedical Solutions. We would like to understand ${lead.facility_name}'s priorities for medical equipment, consumables or technical service, then share a relevant recommendation.\n\nPlease let us know a convenient time to speak.\n\nKind regards,\nAQAN Biomedical Solutions`;
  const recordLaunch = (
    channel: "email" | "whatsapp" | "phone",
    body: string,
  ) => {
    if (!selected || !canAct) return;
    void log(channel, "prepared", "contacted", body);
  };
  const compose = (channel: "email" | "whatsapp") => {
    if (!selected) return;
    const message = outreachMessage(selected);
    const subject =
      language === "sw"
        ? "AQAN Biomedical | Vifaa na huduma za afya"
        : "AQAN Biomedical | Equipment & service support";
    if (channel === "email") {
      if (!selected.email)
        return onToast(
          language === "sw"
            ? "Barua pepe ya kituo hiki haijawekwa."
            : "This facility does not have an email address recorded.",
        );
      // Run in the same tap event so iOS can hand the action directly to the installed mail app.
      window.location.assign(
        `mailto:${selected.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
      );
      recordLaunch(
        "email",
        `Email composer opened for ${contactName(selected)}.\n\n${message}`,
      );
      onToast(
        language === "sw"
          ? "Barua pepe imefunguliwa na imeandaliwa kwa jina la mhusika."
          : "Email composer opened with a personalized message.",
      );
      return;
    }
    const phone = whatsappPhone(selected.phone);
    if (!phone)
      return onToast(
        language === "sw"
          ? "Namba ya WhatsApp ya kituo hiki haijawekwa."
          : "This facility does not have a usable WhatsApp number recorded.",
      );
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    // A plain anchor is more reliable than an async window.open on Mobile Safari.
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    recordLaunch(
      "whatsapp",
      `WhatsApp opened for ${contactName(selected)} at +${phone}.\n\n${message}`,
    );
    onToast(
      language === "sw"
        ? "WhatsApp imefunguliwa na ujumbe umewekwa tayari kwa jina la mhusika."
        : "WhatsApp opened with a personalized message.",
    );
  };
  const call = () => {
    if (!selected) return;
    const phone = whatsappPhone(selected.phone);
    if (!phone)
      return onToast(
        language === "sw"
          ? "Namba ya simu ya kituo hiki haijawekwa."
          : "This facility does not have a usable phone number recorded.",
      );
    window.location.assign(`tel:+${phone}`);
    recordLaunch(
      "phone",
      `Phone dialler opened for ${contactName(selected)} at +${phone}.`,
    );
    onToast(
      language === "sw"
        ? `Kupiga simu ${contactName(selected)}…`
        : `Opening the dialler for ${contactName(selected)}…`,
    );
  };
  return (
    <div className="workspace-page">
      <WorkspaceHeader
        kicker={
          language === "sw" ? "Akili ya biashara" : "Commercial intelligence"
        }
        title={language === "sw" ? "CRM ya vituo" : "Facility CRM"}
        description={
          language === "sw"
            ? `${data.crmLeads.length.toLocaleString()} vituo vimepangwa kwenye mnyororo wa mauzo unaoweza kutekelezwa.`
            : `${data.crmLeads.length.toLocaleString()} facilities organized into an actionable healthcare-sales pipeline.`
        }
        action={language === "sw" ? "Utafutaji wa AI" : "AI prospecting"}
        onAction={() =>
          onToast(
            language === "sw"
              ? "Tumia Intelligence kuunda mkakati wa bidhaa na mawasiliano kwa kituo chochote."
              : "Use Intelligence to generate a product-fit and outreach strategy from this CRM.",
          )
        }
      />
      <section className="summary-strip">
        <div>
          <span>Facilities</span>
          <strong>{data.crmLeads.length.toLocaleString()}</strong>
          <small>national account base</small>
        </div>
        <div>
          <span>Priority pipeline</span>
          <strong>
            {
              data.crmLeads.filter((l) =>
                ["qualified", "proposal_sent"].includes(l.lead_status),
              ).length
            }
          </strong>
          <small>qualified & proposal stage</small>
        </div>
        <div>
          <span>Next actions</span>
          <strong>
            {data.crmLeads.filter((l) => l.next_action_at).length}
          </strong>
          <small>scheduled follow-ups</small>
        </div>
        <div>
          <span>Reachable</span>
          <strong>
            {data.crmLeads.filter((l) => l.email || l.phone).length}
          </strong>
          <small>email or mobile contact</small>
        </div>
      </section>
      <section className="facility-map-panel">
        <div className="facility-map-heading">
          <div>
            <span className="section-kicker">Territory intelligence</span>
            <h2>Healthcare facility map</h2>
            <p>
              {matchingLeads.length.toLocaleString()} matching accounts · click
              a marker to open the full facility workspace.
            </p>
          </div>
          <div className="map-legend">
            <span>
              <i className="new" />
              New
            </span>
            <span>
              <i className="qualified" />
              Qualified
            </span>
            <span>
              <i className="proposal" />
              Proposal sent
            </span>
          </div>
        </div>
        <FacilityMap leads={matchingLeads} onSelect={setSelectedId} />
        <small className="map-disclaimer">
          Markers use the CRM region as an approximate territory position;
          district, council and ward remain visible in each account.
        </small>
      </section>
      <section className="table-panel">
        <div className="table-tools">
          <label>
            <Icon name="search" size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search every facility, contact, district, phone or email"
            />
          </label>
          <div className="filter-row">
            {[
              ["all", "All matches"],
              ["new", "New leads"],
              ["qualified", "Qualified"],
              ["proposal_sent", "Proposal sent"],
            ].map(([value, label]) => (
              <button
                type="button"
                className={stageFilter === value ? "active" : ""}
                onClick={() => setStageFilter(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="data-table customer-table">
          <div className="table-head">
            <span>Facility</span>
            <span>Contact</span>
            <span>Location & capability</span>
            <span>Opportunity</span>
            <span>Next step</span>
            <span />
          </div>
          {leads.map((lead) => (
            <div
              className="table-row"
              key={lead.id}
              onClick={() => setSelectedId(lead.id)}
              style={{ cursor: "pointer" }}
            >
              <span className="customer-cell">
                <i>
                  {lead.facility_name
                    .split(" ")
                    .slice(0, 2)
                    .map((x) => x[0])
                    .join("")
                    .toUpperCase()}
                </i>
                <span>
                  <b>{lead.facility_name}</b>
                  <small>
                    {lead.facility_type || "Health facility"} ·{" "}
                    {lead.ownership_category || "Account"}
                  </small>
                </span>
              </span>
              <span>
                <b>{lead.contact_name || "Contact not named"}</b>
                <small>{lead.email || lead.phone || "No route recorded"}</small>
              </span>
              <span>
                <b>
                  {lead.region || lead.city || "Tanzania"}
                  {lead.district ? ` · ${lead.district}` : ""}
                </b>
                <small>
                  {lead.equipment_count} equipment lines · {lead.service_count}{" "}
                  services
                </small>
              </span>
              <span>
                <em className="score">
                  <i style={{ width: `${lead.lead_score}%` }} />
                  {lead.lead_score}
                </em>
                <small>{lead.lead_status.replaceAll("_", " ")}</small>
              </span>
              <span>
                <small>
                  {lead.next_action_at
                    ? new Date(lead.next_action_at).toLocaleDateString(
                        "en-TZ",
                        { day: "numeric", month: "short" },
                      )
                    : "Plan follow-up"}
                </small>
              </span>
              <button aria-label={`Open ${lead.facility_name}`}>
                <Icon name="arrow" size={17} />
              </button>
            </div>
          ))}
        </div>
        {!leads.length ? (
          <div className="auth-empty">
            <p>No facilities match this search and pipeline stage.</p>
          </div>
        ) : null}
      </section>
      {selected ? (
        <div className="modal-backdrop" onMouseDown={() => setSelectedId(null)}>
          <article
            className="create-modal"
            style={{
              width: "min(980px,100%)",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="facility-title"
          >
            <button
              className="modal-close"
              onClick={() => setSelectedId(null)}
              aria-label="Close"
            >
              <Icon name="close" />
            </button>
            <span className="section-kicker">Facility account workspace</span>
            <h2 id="facility-title">{selected.facility_name}</h2>
            <p>
              {selected.facility_type || "Healthcare facility"} ·{" "}
              {selected.ownership_category || "Ownership not recorded"} · Lead
              score {selected.lead_score}/100
            </p>
            <section className="summary-strip" style={{ margin: "18px 0" }}>
              <div>
                <span>Opportunity stage</span>
                <strong style={{ fontSize: 16, textTransform: "capitalize" }}>
                  {selected.lead_status.replaceAll("_", " ")}
                </strong>…16780 tokens truncated…"warehouse_id" disabled={!canWrite}><option value="">Main / not assigned</option>{data.warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Batch / lot number<input name="batch_number" disabled={!canWrite}/></label><label>Expiry date<input name="expiry_date" type="date" disabled={!canWrite}/></label><label>Unit cost (TZS)<input name="cost_per_unit" type="number" min="0" disabled={!canWrite}/></label><label>Supplier invoice / GRN ref<input name="supplier_invoice" disabled={!canWrite}/></label><label className="span-two">Receiving notes<textarea name="notes" rows={2} disabled={!canWrite}/></label></div><div className="modal-actions" style={{padding:"0 18px 18px"}}><button className="button primary" disabled={!canWrite||busy||!data.products.length}>{busy?"Receiving…":"Post goods receipt"}</button></div></form><form className="table-panel" onSubmit={close}><div className="panel-heading"><div><span className="section-kicker">End of shift</span><h2>Close cash session</h2></div></div><div className="form-grid" style={{padding:18}}><label>Open session<select name="session_id" required disabled={!canWrite}><option value="">Select open session</option>{data.cashSessions.filter(s=>s.status==="open").map(s=><option key={s.id} value={s.id}>{new Date(s.opened_at).toLocaleString("en-TZ")} · float {formatTzs(Number(s.opening_float))}</option>)}</select></label><label>Counted cash (TZS)<input name="counted_cash" type="number" min="0" required disabled={!canWrite}/></label><label className="span-two">Close notes<textarea name="notes" rows={2} disabled={!canWrite}/></label></div><div className="modal-actions" style={{padding:"0 18px 18px"}}><button className="button primary" disabled={!canWrite||busy||!data.cashSessions.some(s=>s.status==="open")}>{busy?"Closing…":"Close & reconcile"}</button></div></form></section></div><LogisticsCore data={data} membership={membership} onToast={onToast} onRefresh={onRefresh}/></>;
}

type AiActionKind = "product" | "quotation" | "invoice";
type AiChatMessage = { id: string; role: "user" | "assistant"; text: string; error?: boolean };
type AiLine = { productId: string; quantity: number };

function actionFromPrompt(prompt: string): AiActionKind | null {
  const value = prompt.toLowerCase();
  if (/(add|create|new|ongeza|weka).{0,32}(product|item|bidhaa|equipment|catalogue)/.test(value)) return "product";
  if (/(create|make|new|prepare|tengeneza|andika).{0,32}(quotation|quote|nukuu)/.test(value)) return "quotation";
  if (/(create|make|new|issue|generate|tengeneza|toa).{0,32}(invoice|sale|receipt|invoice)/.test(value)) return "invoice";
  return null;
}

function suggestedLines(prompt: string, products: Product[]): AiLine[] {
  const words = prompt.toLowerCase();
  const quantity = Math.max(1, Math.min(100, Number(words.match(/(?:x|qty|quantity|units?)\s*(\d{1,3})\b/i)?.[1] || words.match(/\b(\d{1,3})\s*(?:x|units?|pcs?)\b/i)?.[1] || 1)));
  return products.filter((product) => words.includes(product.name.toLowerCase()) || words.includes(product.sku.toLowerCase())).slice(0, 6).map((product) => ({ productId: product.id, quantity }));
}

function AiActionPanel({ kind, prompt, data, membership, onDismiss, onCreated, onToast }: { kind: AiActionKind; prompt: string; data: AqanData; membership: Membership; onDismiss: () => void; onCreated: () => Promise<void>; onToast: (message: string) => void }) {
  const canWrite = kind === "product" ? ["owner", "admin"].includes(membership.role) : ["owner", "admin", "sales"].includes(membership.role);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<AiLine[]>(() => suggestedLines(prompt, data.products));
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [provider, setProvider] = useState("m_pesa");
  const [error, setError] = useState("");
  const [validUntil, setValidUntil] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const matchingProducts = data.products.filter((product) => product.active && product.stock > 0);
  const rows = lines.map((line) => ({ ...line, product: data.products.find((product) => product.id === line.productId) })).filter((line): line is AiLine & { product: Product } => Boolean(line.product));
  const subtotal = rows.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0);
  const vatRate = Number(data.settings?.vat_rate ?? 18) / 100;
  const total = subtotal + subtotal * vatRate;
  const addLine = () => setLines((current) => [...current, { productId: matchingProducts[0]?.id || "", quantity: 1 }]);
  const updateLine = (index: number, key: keyof AiLine, value: string | number) => setLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, [key]: key === "quantity" ? Number(value) : value } : line));
  const removeLine = (index: number) => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index));
  const execute = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;
    setError("");
    try {
      if (kind === "product") {
        const form = new FormData(event.currentTarget);
        const name = String(form.get("name") || "").trim();
        const price = Number(form.get("price") || 0);
        const stock = Number(form.get("stock") || 0);
        if (!name || price < 0 || stock < 0) throw new Error("Add a product name, a valid selling price and opening stock.");
        if (!window.confirm(`Add ${name} to the live AQAN catalogue?`)) return;
        setBusy(true);
        const photo = form.get("image");
        await createProduct({ name, sku: String(form.get("sku") || ""), category: String(form.get("category") || "Biomedical equipment"), description: String(form.get("description") || "") || null, price, stock, reorder_level: Number(form.get("reorder_level") || 0), serial_tracked: form.get("serial_tracked") === "on" }, membership.organization_id, photo instanceof File && photo.size ? photo : null);
        await onCreated(); onToast(`${name} was added to the live catalogue. AQAN generated the SKU where needed.`); onDismiss(); return;
      }
      if (!customerName.trim()) throw new Error("AQAN needs the customer or facility name before it can prepare this document.");
      if (!rows.length) throw new Error("Select at least one live catalogue product and quantity.");
      if (kind === "quotation") {
        if (!validUntil) throw new Error("Choose the quotation validity date.");
        if (!window.confirm(`Create this quotation for ${customerName}?`)) return;
        setBusy(true);
        const quotation = await createAdvancedQuotation({ customerName, customerPhone, customerEmail, validUntil, notes, items: rows.map((line) => ({ productId: line.productId, quantity: line.quantity })) }, membership.organization_id);
        await onCreated(); onToast(`Quotation ${quotation.quote_number} created with live prices, tax, terms and bank details.`); onDismiss(); return;
      }
      if (!window.confirm(`Create a paid invoice for ${customerName} totaling ${formatTzs(total)}? This will deduct stock.`)) return;
      setBusy(true);
      const sale = await completeSale({ customerId: null, customerName, customerPhone, customerEmail, paymentMethod, paymentProvider: paymentMethod === "mobile_money" ? provider : null, items: rows.map((line) => ({ product_id: line.productId, quantity: line.quantity })) });
      await onCreated(); onToast(`Invoice ${sale.invoice_number} created. Stock, VAT, payment method and buyer contact were recorded.`); onDismiss();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "AQAN could not complete this action."); }
    finally { setBusy(false); }
  };
  const title = kind === "product" ? "Add a catalogue product" : kind === "quotation" ? "Prepare a live quotation" : "Prepare & issue an invoice";
  const instruction = kind === "product" ? "AQAN needs the catalogue facts first. SKU is generated automatically if you leave it blank, and an optional photo is published to Inventory and POS." : kind === "quotation" ? "AQAN will use current catalogue prices plus your saved VAT, validity, payment terms, bank details and commercial conditions." : "AQAN will verify live stock, calculate VAT, record the chosen payment method and save the buyer contact before issuing the invoice.";
  return <section className="ai-action-panel" aria-label={`${title} with AQAN AI`}><div className="ai-action-heading"><div><span className="section-kicker">AQAN AI action assistant</span><h2>{title}</h2><p>{instruction}</p></div><button type="button" className="text-button" onClick={onDismiss}>Cancel</button></div>{!canWrite ? <div className="form-error">Your {membership.role} role can analyse data but cannot create financial or catalogue records.</div> : <form className="form-grid" onSubmit={(event) => void execute(event)}>{kind === "product" ? <><label className="span-two">Product / equipment name<input name="name" required placeholder="e.g. Portable ultrasound U8" autoFocus/></label><label>SKU <small>Optional — AQAN generates it</small><input name="sku" placeholder="e.g. IMG-U8-001"/></label><label>Category<input name="category" defaultValue="Biomedical equipment"/></label><label>Selling price (TZS)<input name="price" type="number" min="0" required placeholder="0"/></label><label>Opening stock<input name="stock" type="number" min="0" required placeholder="0"/></label><label>Reorder at<input name="reorder_level" type="number" min="0" defaultValue="1"/></label><label className="check-field"><input name="serial_tracked" type="checkbox"/> Track serial numbers</label><label className="span-two">Description / specifications<textarea name="description" rows={3} placeholder="Manufacturer, model, intended use, warranty and key specifications…"/></label></> : <><label>Customer / facility name<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required placeholder="e.g. Njombe District Hospital" autoFocus/></label><label>Phone <small>Optional</small><input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="+255…"/></label><label className="span-two">Email <small>Optional</small><input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="procurement@facility.co.tz"/></label>{kind === "quotation" ? <label>Valid until<input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} required/></label> : <><label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Cash</option><option value="card">Card</option><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option><option value="credit">Credit sale</option></select></label>{paymentMethod === "mobile_money" ? <label>Mobile provider<select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="m_pesa">M-Pesa</option><option value="airtel_money">Airtel Money</option><option value="tigo_pesa">Tigo Pesa</option><option value="halopesa">HaloPesa</option><option value="mixx_by_yas">Mixx by Yas</option><option value="other">Other</option></select></label> : null}</>}</>} {kind !== "product" ? <><div className="span-two ai-lines"><div className="ai-lines-heading"><b>Live catalogue lines</b><button type="button" className="text-button" onClick={addLine} disabled={!matchingProducts.length}>+ Add line</button></div>{lines.map((line, index) => <div className="ai-line" key={`${index}-${line.productId}`}><select value={line.productId} onChange={(event) => updateLine(index, "productId", event.target.value)} required><option value="">Select product</option>{matchingProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatTzs(Number(product.price))} · {product.stock} in stock</option>)}</select><input type="number" min="1" max={data.products.find((product) => product.id === line.productId)?.stock || 100} value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} aria-label="Quantity"/><button type="button" className="remove" onClick={() => removeLine(index)} aria-label="Remove product line"><Icon name="trash" size={15}/></button></div>)}{!lines.length ? <p className="form-note">Add a catalogue line for AQAN to calculate a compliant total.</p> : null}<div className="ai-total"><span>{kind === "quotation" ? "Estimated quotation total" : "Invoice total"}</span><strong>{formatTzs(total)}</strong><small>Includes {Math.round(vatRate * 100)}% VAT from Business settings</small></div></div><label className="span-two">Notes <small>Optional</small><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder={kind === "quotation" ? "Scope, delivery expectation, validity conditions or special commercial notes…" : "Reference, delivery instruction or payment note…"}/></label></> : null}{error ? <div className="span-two form-error">{error}</div> : null}<div className="span-two modal-actions"><button type="button" className="button secondary" onClick={onDismiss} disabled={busy}>Cancel</button><button className="button primary" disabled={busy || !canWrite}>{busy ? "Creating secure record…" : kind === "product" ? "Confirm & add product" : kind === "quotation" ? "Confirm & create quotation" : "Confirm & create invoice"}</button></div></form>}</section>;
}

function IntelligenceView({ data, membership, onToast, onRefresh }: { data: AqanData; membership: Membership; onToast: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<{ kind: AiActionKind; prompt: string } | null>(null);
  const lowStock = data.products.filter((product) => product.stock <= product.reorder_level).sort((a, b) => (a.stock - a.reorder_level) - (b.stock - b.reorder_level));
  const topCustomers = [...data.customers].sort((a, b) => Number(b.total_spend) - Number(a.total_spend)).slice(0, 3);
  const revenue = data.sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const strongestCategory = data.products.reduce<Record<string, number>>((totals, product) => ({ ...totals, [product.category]: (totals[product.category] || 0) + Number(product.price) * product.stock }), {});
  const categoryName = Object.entries(strongestCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Monitoring";
  const defaultAnswer = data.products.length ? `AQAN is tracking ${data.products.length} product lines, ${data.customers.length} customers and ${formatTzs(revenue)} across the latest ${data.sales.length} sales. ${lowStock.length} items need stock attention.` : "The workspace is clean and ready. Add products with photos, then record the first sale or create a customer to unlock live recommendations.";
  const [answer, setAnswer] = useState(defaultAnswer);
  const ask = async (value: string) => { const q = value || question; if (!q.trim()) return; setSubmittedQuestion(q.trim()); setQuestion(""); const intent = actionFromPrompt(q); if (intent) { setAction({ kind: intent, prompt: q }); setError(""); setAnswer(intent === "product" ? "I can add this product to the live AQAN catalogue. First, confirm the specifications, selling price, opening stock and reorder level below." : intent === "quotation" ? "I can prepare a formal quotation from live catalogue prices. Add the customer, products and validity date below; AQAN will attach VAT, terms and saved bank details." : "I can create a paid invoice from live stock. Confirm the buyer, items and recorded payment method below. AQAN will deduct stock only after your confirmation."); onToast("AQAN AI prepared a secure action checklist. Review the details before creating the record."); return; } setAction(null); setAsking(true); setError(""); try { const result = await askAqanAI(q); setAnswer(result.answer); onToast(result.leads?.length ? `AQAN AI analysed the live workspace and ranked ${result.leads.length} lead candidates.` : "AQAN AI analysed the live workspace."); } catch (caught) { const message = caught instanceof Error ? caught.message : "AQAN AI could not complete this request."; setError(message); onToast(message); } finally { setAsking(false); } };
  const copyInsight = async () => { try { await navigator.clipboard.writeText(answer); onToast("AQAN AI insight copied."); } catch { onToast("Copy is unavailable in this browser. Select the insight text instead."); } };
  return <div className="workspace-page intelligence-page"><WorkspaceHeader kicker="Business intelligence" title="Ask AQAN AI" description="Gemini analyses only the signed-in workspace’s sales, stock, CRM, quotations and service data." action="Copy insight" onAction={() => void copyInsight()}/>
    <section className="ai-workspace"><div className="ai-chat"><div className="ai-chat-heading"><div className="ai-orb large"><Icon name="sparkles" size={24}/></div><div><span>AQAN AI · Gemini</span><h2>Your medical supply analyst</h2><p>Analyse the live workspace or ask AQAN to safely prepare an operational action.</p></div><em><span/> {asking ? "Analysing" : error ? "Needs attention" : "Ready"}</em></div><div className="answer-card"><span>{error ? "CONNECTION STATUS" : "CONVERSATION"}</span>{submittedQuestion ? <div className="ai-user-message"><small>You</small><p>{submittedQuestion}</p></div> : null}<div className={error ? "ai-assistant-message error" : "ai-assistant-message"}><small>AQAN AI</small><p>{asking ? "Analysing the secured AQAN workspace…" : error ? `I could not return a generated response: ${error}` : answer}</p></div><div className="answer-metrics"><div><small>Recorded sales value</small><strong>{formatTzs(revenue)}</strong><em>{data.sales.length} transactions</em></div><div><small>Strongest category</small><strong>{categoryName}</strong><em>by current stock value</em></div><div><small>CRM leads</small><strong>{data.crmLeads.length}</strong><em>available to analyse</em></div></div><small className="sources">Live scope: {data.products.length} products · {data.customers.length} customers · {data.crmLeads.length} CRM leads · {data.sales.length} recent sales</small></div><form className="ai-input" onSubmit={(e) => {e.preventDefault(); void ask(question);}}><Icon name="sparkles" size={18}/><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Try: Add a product, create a quotation, or create an invoice…"/><button type="submit" disabled={asking || !question.trim()}>{asking ? "Thinking…" : "Ask"} <Icon name="arrow" size={15}/></button></form>{action ? <AiActionPanel kind={action.kind} prompt={action.prompt} data={data} membership={membership} onDismiss={() => setAction(null)} onCreated={onRefresh} onToast={onToast}/> : null}</div>
      <aside className="suggestion-panel"><span className="section-kicker">Suggested questions</span><h2>Analyse or take action</h2>{["Add a product to the catalogue","Create a quotation","Create an invoice","Which facilities should we contact today?","What should we restock this week?","Which quotation needs follow-up?"].map((q, i) => <button key={q} onClick={() => void ask(q)}><span>{String(i+1).padStart(2,"0")}</span>{q}<Icon name="arrow" size={15}/></button>)}<div className="daily-brief"><Icon name="trend" size={18}/><div><strong>Daily executive brief</strong><p>Ready every morning at 08:00</p></div><span className="toggle active"><i/></span></div></aside>
    </section>
  </div>;
}

function FloatingAqanChat({ data, membership, onToast, onRefresh, onOpenIntelligence }: { data: AqanData; membership: Membership; onToast: (message: string) => void; onRefresh: () => Promise<void>; onOpenIntelligence: () => void }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<AiChatMessage[]>([{ id: "welcome", role: "assistant", text: "I’m AQAN AI. Ask me about live stock, customers, sales or CRM—or ask me to add a product, prepare a quotation or create an invoice." }]);
  const [action, setAction] = useState<{ kind: AiActionKind; prompt: string } | null>(null);
  const ask = async (value: string) => {
    const prompt = value.trim();
    if (!prompt) return;
    const messageId = Date.now().toString();
    setMessages((current) => [...current, { id: `${messageId}-user`, role: "user", text: prompt }]);
    setQuestion("");
    const intent = actionFromPrompt(prompt);
    if (intent) {
      setAction({ kind: intent, prompt });
      setError("");
      setMessages((current) => [...current, { id: `${messageId}-assistant`, role: "assistant", text: intent === "product" ? "I’ve opened the secure product form. Add the catalogue facts and confirm when ready." : intent === "quotation" ? "I’ve opened the quotation workspace. Select the customer, live catalogue lines and validity date." : "I’ve opened the invoice workspace. Confirm the customer, stock lines and recorded payment method before issuing it." }]);
      onToast("AQAN AI prepared an action for your review.");
      return;
    }
    setAsking(true);
    setError("");
    try {
      const result = await askAqanAI(prompt);
      setMessages((current) => [...current, { id: `${messageId}-assistant`, role: "assistant", text: result.answer }]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "AQAN AI could not complete this request.";
      setError(message);
      setMessages((current) => [...current, { id: `${messageId}-assistant`, role: "assistant", text: `I could not answer that request: ${message}`, error: true }]);
    } finally {
      setAsking(false);
    }
  };
  const close = () => { setOpen(false); setAction(null); };
  return <><button type="button" className="floating-ai-launcher" onClick={() => setOpen(true)} aria-label="Open AQAN AI assistant" aria-expanded={open}><span className="floating-ai-pulse"/><Icon name="sparkles" size={19}/><b>Ask AQAN AI</b></button>{open ? <aside className="floating-ai-panel" role="dialog" aria-label="AQAN AI assistant"><header><div className="floating-ai-orb"><Icon name="sparkles" size={19}/></div><div><span>AQAN AI · Gemini</span><strong>Your live workspace assistant</strong></div><button type="button" onClick={close} aria-label="Close AQAN AI"><Icon name="close" size={19}/></button></header><div className="floating-ai-body"><p className="floating-ai-status"><i/> {asking ? "Analysing your workspace…" : error ? "Connection needs attention" : "Ready for a secure action"}</p><div className="floating-ai-messages" aria-live="polite">{messages.map((message) => <div className={`floating-ai-message ${message.role}${message.error ? " error" : ""}`} key={message.id}><small>{message.role === "user" ? "You" : "AQAN AI"}</small><p>{message.text}</p></div>)}{asking ? <div className="floating-ai-message assistant pending"><small>AQAN AI</small><p><span/><span/><span/> Analysing your secured workspace…</p></div> : null}</div>{!action ? <div className="floating-ai-prompts"><button type="button" onClick={() => void ask("What should we restock this week?")}>Restock advice</button><button type="button" onClick={() => void ask("Which facilities should we contact today?")}>Prioritise CRM leads</button><button type="button" onClick={() => void ask("Create a quotation")}>Create quotation</button></div> : <AiActionPanel kind={action.kind} prompt={action.prompt} data={data} membership={membership} onDismiss={() => setAction(null)} onCreated={onRefresh} onToast={onToast}/>}</div><form className="floating-ai-input" onSubmit={(event) => { event.preventDefault(); void ask(question); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask or create something…" aria-label="Ask AQAN AI" autoFocus/><button type="submit" disabled={asking || !question.trim()}>{asking ? "…" : <Icon name="arrow" size={17}/>}</button></form><button type="button" className="floating-ai-full" onClick={() => { close(); onOpenIntelligence(); }}>Open full Intelligence <Icon name="arrow" size={14}/></button></aside> : null}</>;
}

type CreateMode = "product" | "customer" | "quotation" | "service" | "campaign";

const createTitles: Record<CreateMode, { kicker: string; title: string; submit: string }> = {
  product: { kicker: "Catalogue", title: "Add biomedical product", submit: "Save product" },
  customer: { kicker: "CRM", title: "Add healthcare customer", submit: "Save customer" },
  quotation: { kicker: "Sales pipeline", title: "Create quotation", submit: "Create draft" },
  service: { kicker: "Service desk", title: "Schedule service visit", submit: "Schedule visit" },
  campaign: { kicker: "Outreach", title: "Prepare customer campaign", submit: "Save campaign" },
};

function TeamAccessView({ membership, onToast }: { membership: Membership; onToast: (message: string) => void }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refreshStaff = useCallback(async () => { setLoading(true); try { setStaff(await loadStaff(membership.organization_id)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load team members."); } finally { setLoading(false); } }, [membership.organization_id]);
  useEffect(() => {
    let cancelled = false;
    void loadStaff(membership.organization_id).then((members) => { if (!cancelled) setStaff(members); }).catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load team members."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [membership.organization_id]);
  if (!['owner', 'admin'].includes(membership.role)) return <div className="workspace-page"><WorkspaceHeader kicker="Access control" title="Team & access" description="Only AQAN owners and admins can create staff accounts or adjust permissions." action="Back to overview" onAction={() => history.back()}/><div className="form-error">Your current role is <b>{membership.role}</b>. Ask an owner or administrator to manage team access.</div></div>;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const email = String(form.get("email") || "").trim(); setBusy(true); setError(""); try { await inviteStaff({ fullName: String(form.get("full_name") || ""), email, role: String(form.get("role") || "viewer") as AssignableRole }); event.currentTarget.reset(); await refreshStaff(); onToast(`Invitation sent to ${email}. They set their own password from the secure email link.`); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send the staff invitation."); } finally { setBusy(false); } };
  const updateRole = async (userId: string, role: AssignableRole) => { setBusy(true); setError(""); try { await setMemberRole(userId, role); await refreshStaff(); onToast("Staff permission updated."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update permission."); } finally { setBusy(false); } };
  const roleOptions: Array<[AssignableRole,string]> = [["admin","Administrator — settings, staff and all operations"],["manager","Manager — operations, profit and approvals"],["cashier","Cashier — sales, payments and receipts"],["salesperson","Salesperson — customers, quotes and sales"],["inventory","Inventory — products, purchases and stock"],["accountant","Accountant — payments, expenses and reports"],["service","Service — equipment, delivery and stock visibility"],["viewer","Viewer — read-only workspace access"]];
  return <div className="workspace-page"><WorkspaceHeader kicker="Access control" title="Team & access" description="Invite staff by email, let them set their own password, and give each person only the role they need." action="Refresh team" onAction={() => void refreshStaff()}/><section className="team-hero"><div><span className="section-kicker">Secure invitation workflow</span><h2>No shared passwords. No open access.</h2><p>An AQAN owner or administrator chooses the role. The staff member receives a secure Supabase email, creates their password, then enters only the workspace they were invited to.</p></div><div className="team-role-guide"><span><b>Cashier</b> sales & receipts</span><span><b>Inventory</b> products & purchasing</span><span><b>Accountant</b> balances & reports</span><span><b>Manager</b> operational control</span></div></section><section className="table-panel"><div className="panel-heading"><div><span className="section-kicker">Invite staff</span><h2>Send secure access</h2></div></div><form className="form-grid" onSubmit={submit}><label>Full name<input name="full_name" required placeholder="e.g. Asha Mrema"/></label><label>Work email<input name="email" type="email" required placeholder="asha@aqan.co.tz"/></label><label className="span-two">Permission<select name="role" defaultValue="salesperson">{roleOptions.map(([role,label])=><option key={role} value={role}>{label}</option>)}</select></label><div className="span-two form-note">The invitation email contains a one-time secure link. AQAN never shows or stores a staff member’s password.</div><div className="span-two modal-actions"><button className="button primary" disabled={busy}>{busy ? "Sending invite…" : "Send staff invitation"}</button></div></form>{error ? <div className="form-error">{error}</div> : null}</section><section className="table-panel"><div className="panel-heading"><div><span className="section-kicker">Current team</span><h2>Profiles & permissions</h2></div><span>{loading ? "Loading…" : `${staff.length} members`}</span></div><div className="data-table"><div className="table-head"><span>Staff member</span><span>Current role</span><span>Change permission</span></div>{staff.map((person) => <div className="table-row" key={person.user_id}><span><b>{person.full_name || "Unnamed staff"}</b></span><span><em className="pill success">{person.role}</em></span><span>{person.role === "owner" ? <small>Owner access is protected</small> : <select value={person.role} disabled={busy} onChange={(event) => void updateRole(person.user_id, event.target.value as AssignableRole)}>{roleOptions.map(([role,label])=><option key={role} value={role}>{label.split(" — ")[0]}</option>)}</select>}</span></div>)}</div></section></div>;
}

function AuthModal({ session, membership, onClose, onToast }: {
  session: Session | null;
  membership: Membership | null;
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");
  const [inviteSetup] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("setup") === "staff");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const email = String(form.get("email") || "");
      const password = String(form.get("password") || "");
      if (mode === "signin") {
        await signIn(email, password);
        onToast("Secure staff session started.");
      } else {
        const result = await signUp(email, password, String(form.get("full_name") || ""));
        if (result.session) {
          onToast("Account created and signed in securely.");
        } else {
          setPendingConfirmationEmail(email);
          onToast("Account created. Check your email for the confirmation link.");
        }
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Authentication failed.";
      if (/email not confirmed/i.test(message)) setPendingConfirmationEmail(String(new FormData(event.currentTarget).get("email") || ""));
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  const resendConfirmation = async () => {
    if (!pendingConfirmationEmail) return;
    setBusy(true);
    setError("");
    try {
      await resendSignupConfirmation(pendingConfirmationEmail);
      onToast("A new confirmation email was requested. Check spam too.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resend the confirmation email.");
    } finally {
      setBusy(false);
    }
  };
  const requestAccess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await requestWorkspaceAccess(String(form.get("full_name") || ""));
      onToast("Access request sent to the AQAN administrator.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit the access request.");
    } finally {
      setBusy(false);
    }
  };
  const claimOwner = async (fullName: string) => {
    setBusy(true);
    setError("");
    try {
      await claimFirstOwner(fullName);
      onToast("AQAN owner access claimed. Live workspace is loading.");
      window.setTimeout(() => window.location.reload(), 350);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Owner access could not be claimed.");
    } finally {
      setBusy(false);
    }
  };
  const setInvitePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") || "");
    if (password.length < 8) { setError("Choose a password with at least 8 characters."); return; }
    setBusy(true); setError("");
    try {
      await updateMyPassword(password);
      window.history.replaceState({}, "", window.location.pathname);
      onToast("Password secured. Your AQAN access is ready.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Password could not be updated."); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop"><div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close"/></button>
    <Logo/>
    {!isSupabaseConfigured ? <div className="auth-empty"><span className="success-icon"><Icon name="shield" size={28}/></span><span className="section-kicker">Backend prepared</span><h2 id="auth-title">AQAN connection pending</h2><p>The application is ready for the AQAN Supabase URL and publishable key.</p></div> : inviteSetup && session ? <form className="auth-form" onSubmit={setInvitePassword}><span className="section-kicker">Staff invitation accepted</span><h2 id="auth-title">Create your AQAN password</h2><p>Your role and workspace have been prepared by the AQAN administrator. Choose a secure password to finish access.</p><label>New password<input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters"/></label>{error ? <div className="form-error">{error}</div> : null}<button className="button primary full-button" disabled={busy}>{busy ? "Securing…" : "Secure my account"}</button></form> : pendingConfirmationEmail ? <div className="auth-empty"><span className="success-icon"><Icon name="check" size={28}/></span><span className="section-kicker">Confirmation required</span><h2 id="auth-title">Check your email</h2><p>We created <b>{pendingConfirmationEmail}</b>. Open its confirmation link, then return here and sign in. Check spam too.</p>{error ? <div className="form-error">{error}</div> : null}<button className="button primary full-button" onClick={() => void resendConfirmation()} disabled={busy}>{busy ? "Requesting…" : "Resend confirmation email"}</button><button className="text-button centered" type="button" onClick={() => { setPendingConfirmationEmail(""); setMode("signin"); setError(""); }}>Back to sign in</button></div> : session && membership ? <div className="auth-empty"><span className="success-icon"><Icon name="check" size={28}/></span><span className="section-kicker">Authenticated</span><h2 id="auth-title">{membership.organization_name}</h2><p>{session.user.email} has <b>{membership.role}</b> access to live operations.</p><button className="button secondary full-button" onClick={() => void signOut()}>Sign out</button></div> : session ? <form className="auth-form" onSubmit={requestAccess}><span className="section-kicker">Workspace approval</span><h2 id="auth-title">Join AQAN workspace</h2><p>First setup? Claim owner access. After that, new staff request approval from an owner.</p><label>Full name<input name="full_name" required defaultValue={String(session.user.user_metadata?.full_name || "")} placeholder="Your full name"/></label>{error ? <div className="form-error">{error}</div> : null}<div className="modal-actions"><button type="button" className="button primary" onClick={(event) => void claimOwner(String(new FormData(event.currentTarget.form!).get("full_name") || ""))} disabled={busy}>{busy ? "Checking…" : "Claim first owner"}</button><button className="button secondary" disabled={busy}>{busy ? "Sending…" : "Request access"}</button></div><button className="text-button centered" type="button" onClick={() => void signOut()}>Use a different account</button></form> : <form className="auth-form" onSubmit={submit}><span className="section-kicker">Secure staff access</span><h2 id="auth-title">{mode === "signin" ? "Sign in to AQAN" : "Create your staff account"}</h2><p>Customer, price and sales data is protected by row-level permissions.</p>{mode === "signup" ? <label>Full name<input name="full_name" required placeholder="e.g. Ivo Gerald"/></label> : null}<label>Email address<input type="email" name="email" required autoComplete="email" placeholder="you@aqan.co.tz"/></label><label>Password<input type="password" name="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="At least 8 characters"/></label>{error ? <div className="form-error">{error}</div> : null}<button className="button primary full-button" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in securely" : "Create account"}</button><button className="text-button centered" type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>{mode === "signin" ? "New staff member? Create account" : "Already registered? Sign in"}</button></form>}
  </div></div>;
}

function CreateModal({ mode, customers, products, onClose, onSubmit }: {
  mode: CreateMode;
  customers: Customer[];
  products: Product[];
  onClose: () => void;
  onSubmit: (mode: CreateMode, form: FormData) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [defaultValidUntil] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const definition = createTitles[mode];
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(mode, new FormData(event.currentTarget));
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This record could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  const customerSelect = <label>Customer<select name="customer_id" required defaultValue=""><option value="" disabled>Select a healthcare customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>;
  return <div className="modal-backdrop"><form className="create-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="create-title"><button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close"/></button><span className="section-kicker">{definition.kicker}</span><h2 id="create-title">{definition.title}</h2><p>Saved directly to the secured AQAN workspace.</p><div className="form-grid">
    {mode === "product" ? <><label className="span-two">Product name<input name="name" required placeholder="e.g. Anaesthesia Machine A7"/></label><label>SKU <small>(auto-generated if blank)</small><input name="sku" placeholder="e.g. AM-A7"/></label><label>Category<select name="category" defaultValue="Monitoring"><option>Monitoring</option><option>Imaging</option><option>Critical care</option><option>Respiratory</option><option>Diagnostics</option><option>Theatre</option><option>Consumables</option></select></label><label>Unit price (TZS)<input name="price" type="number" min="0" step="1" required/></label><label>Opening stock<input name="stock" type="number" min="0" step="1" required/></label><label>Reorder level<input name="reorder_level" type="number" min="0" step="1" defaultValue="5" required/></label><label>Product photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label><label className="check-field"><input name="serial_tracked" type="checkbox"/> Track serial numbers</label><label className="span-two">Product description<textarea name="description" rows={3} placeholder="Specifications, warranty, handling or intended use"/></label></> : null}
    {mode === "customer" ? <><label className="span-two">Facility name<input name="name" required placeholder="e.g. Mikocheni Specialist Hospital"/></label><label>Type<select name="customer_type"><option>Hospital</option><option>Clinic</option><option>Diagnostic centre</option><option>Pharmacy</option><option>NGO</option><option>Distributor</option></select></label><label>City<input name="city" required defaultValue="Dar es Salaam"/></label><label>Contact person<input name="contact_name" placeholder="Full name"/></label><label>Email<input name="email" type="email" placeholder="procurement@example.org"/></label><label className="span-two">Phone<input name="phone" type="tel" placeholder="+255 …"/></label></> : null}
    {mode === "quotation" ? <>{customerSelect}<label>Valid until<input name="valid_until" type="date" required defaultValue={defaultValidUntil}/></label><label className="span-two">Product / equipment<select name="product_id" required defaultValue=""><option value="" disabled>Select a stocked product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatTzs(product.price)}</option>)}</select></label><label>Quantity<input name="quantity" type="number" min="1" step="1" defaultValue="1" required/></label><label className="span-two">Notes<textarea name="notes" rows={4} placeholder="Scope, installation, warranty or delivery notes"/></label><div className="form-note span-two">The quotation includes the current commercial terms, payment terms and bank instructions from Business settings.</div></> : null}
    {mode === "service" ? <>{customerSelect}<label>Equipment<input name="equipment_name" required placeholder="Patient Monitor X12"/></label><label>Serial number<input name="serial_number" placeholder="PM120849"/></label><label>Visit date<input name="scheduled_for" type="datetime-local"/></label><label className="span-two">Issue or service scope<textarea name="issue" required rows={4} placeholder="Calibration, installation or preventive maintenance"/></label></> : null}
    {mode === "campaign" ? <><label>Campaign name<input name="name" required placeholder="Portable ultrasound arrival"/></label><label>Channel<select name="channel" defaultValue="whatsapp_email"><option value="whatsapp_email">WhatsApp + email</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option></select></label><label className="span-two">Customer message<textarea name="message" required rows={6} placeholder="Personalized product announcement with clear consent and opt-out language"/></label></> : null}
  </div>{customers.length === 0 && ["quotation", "service"].includes(mode) ? <div className="form-error">Add a customer before creating this record.</div> : null}{mode === "quotation" && products.length === 0 ? <div className="form-error">Add a stocked product before creating a quotation.</div> : null}{error ? <div className="form-error">{error}</div> : null}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || (customers.length === 0 && ["quotation", "service"].includes(mode)) || (mode === "quotation" && products.length === 0)}>{busy ? "Saving…" : definition.submit}</button></div></form></div>;
}

export default function Home() {
  const [view, setView] = useState("dashboard");
  const [language, setLanguage] = useState<AqanLanguage>("en");
  const [theme, setTheme] = useState<AqanTheme>("light");
  const [systemDark, setSystemDark] = useState(false);
  const [toast, setToast] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [data, setData] = useState<AqanData>(emptyAqanData);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authOpen, setAuthOpen] = useState(true);
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const currentLabel = useMemo(() => nav.find((item) => item.id === view)?.label || "Overview", [view]);
  const currentDisplayLabel = language === "sw" ? (swNav[view] || currentLabel) : currentLabel;
  const showToast = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(""), 4200); }, []);
  const refreshForSession = useCallback(async (activeSession: Session | null) => {
    if (!isSupabaseConfigured || !activeSession) {
      setMembership(null);
      setData(emptyAqanData);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const nextMembership = await getMembership();
      setMembership(nextMembership);
      setData(nextMembership ? await loadAqanData() : emptyAqanData);
    } catch (caught) {
      setMembership(null);
      setData(emptyAqanData);
      showToast(caught instanceof Error ? caught.message : "AQAN data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);
  const refresh = useCallback(() => refreshForSession(session), [refreshForSession, session]);

  useEffect(() => subscribeToSession((nextSession) => {
    setSession(nextSession);
    if (!nextSession) setAuthOpen(true);
    void refreshForSession(nextSession);
  }), [refreshForSession]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    sync(); media.addEventListener("change", sync); return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!session) return;
    const metadata = session.user.user_metadata || {};
    const nextLanguage = metadata.aqan_language === "sw" ? "sw" : metadata.aqan_language === "en" ? "en" : (localStorage.getItem("aqan-language") as AqanLanguage | null);
    const nextTheme = ["light", "dark", "system"].includes(String(metadata.aqan_theme)) ? metadata.aqan_theme as AqanTheme : (localStorage.getItem("aqan-theme") as AqanTheme | null);
    const timer = window.setTimeout(() => { if (nextLanguage) setLanguage(nextLanguage); if (nextTheme) setTheme(nextTheme); }, 0);
    return () => window.clearTimeout(timer);
  }, [session?.user.id]);

  const hasLiveAccess = Boolean(session && membership);
  const displayProducts = hasLiveAccess ? data.products : [];
  const displayName = String(session?.user.user_metadata?.full_name || session?.user.email?.split("@")[0] || "Ivo Gerald");
  const initials = displayName.split(/[ ._-]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AQ";
  const changeLanguage = (nextLanguage: AqanLanguage) => { setLanguage(nextLanguage); localStorage.setItem("aqan-language", nextLanguage); if (session) void updateMyProfile({ fullName: String(session.user.user_metadata?.full_name || displayName), phone: String(session.user.user_metadata?.phone || ""), language: nextLanguage, theme }).catch(() => undefined); };
  const changeTheme = (nextTheme: AqanTheme) => { setTheme(nextTheme); localStorage.setItem("aqan-theme", nextTheme); if (session) void updateMyProfile({ fullName: String(session.user.user_metadata?.full_name || displayName), phone: String(session.user.user_metadata?.phone || ""), language, theme: nextTheme }).catch(() => undefined); };
  const activeTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const requireAccess = () => {
    if (!isSupabaseConfigured || !session || !membership) {
      setAuthOpen(true);
      return false;
    }
    if (loading) {
      showToast("The live AQAN workspace is still syncing.");
      return false;
    }
    return true;
  };
  const openCreate = (mode: CreateMode) => { if (requireAccess()) setCreateMode(mode); };
  const checkout = async (items: Array<{ product_id: string; quantity: number }>, paymentMethod: string, amountReceived: number, customerId: string | null, paymentProvider: string | null, contact: { name: string; phone: string; email: string }) => {
    if (!requireAccess()) return null;
    if (!membership) return null;
    try {
      let effectiveCustomerId = customerId;
      if (!effectiveCustomerId && contact.name.trim()) {
        const existing = data.customers.find((customer) => customer.name.trim().toLowerCase() === contact.name.trim().toLowerCase());
        if (existing) effectiveCustomerId = existing.id;
        else effectiveCustomerId = await addCustomer({ organization_id: membership.organization_id, name: contact.name.trim(), customer_type: "Walk-in", contact_name: contact.name.trim(), phone: contact.phone || null, email: contact.email || null, city: "Dar es Salaam" });
      }
      if (paymentMethod === "credit" && !effectiveCustomerId) throw new Error("Select or create a customer before recording a credit sale.");
      const sale = await completeOperationalSale({ customerId: effectiveCustomerId, items: items.map((item) => ({ ...item, price_level: "retail", discount_amount: 0 })), payments: paymentMethod === "credit" ? [] : [{ method: paymentMethod, amount: amountReceived, provider: paymentProvider || undefined }], discount: 0, shipping: 0 });
      await refresh();
      return { message: `Payment recorded. Invoice ${sale.invoice_number} is ready.${Number(sale.balance_due) ? ` Balance due: ${formatTzs(Number(sale.balance_due))}.` : ""}`, invoiceNumber: sale.invoice_number, total: Number(sale.total), balanceDue: Number(sale.balance_due) };
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "The sale could not be completed.");
      return null;
    }
  };
  const submitCreate = async (mode: CreateMode, form: FormData) => {
    if (!membership) throw new Error("Workspace access is required.");
    const value = (name: string) => String(form.get(name) || "").trim();
    const uploadedImage = form.get("image");
    const productImage = uploadedImage instanceof File && uploadedImage.size ? uploadedImage : null;
    if (mode === "product") await createProduct({ name: value("name"), sku: value("sku").toUpperCase(), category: value("category"), description: value("description") || null, price: Number(value("price")), stock: Number(value("stock")), reorder_level: Number(value("reorder_level")), serial_tracked: form.get("serial_tracked") === "on" }, membership.organization_id, productImage);
    if (mode === "customer") await createCustomer({ name: value("name"), customer_type: value("customer_type"), city: value("city"), contact_name: value("contact_name") || null, email: value("email") || null, phone: value("phone") || null }, membership.organization_id);
    if (mode === "quotation") await createQuotation({ customerId: value("customer_id"), notes: value("notes"), validUntil: value("valid_until"), productId: value("product_id"), quantity: Number(value("quantity") || 1) }, membership.organization_id);
    if (mode === "service") await createServiceRequest({ customerId: value("customer_id"), equipmentName: value("equipment_name"), serialNumber: value("serial_number"), issue: value("issue"), scheduledFor: value("scheduled_for") ? new Date(value("scheduled_for")).toISOString() : "" }, membership.organization_id);
    if (mode === "campaign") await createCampaign({ name: value("name"), channel: value("channel"), message: value("message") }, membership.organization_id);
    await refresh();
    showToast(`${createTitles[mode].title} saved successfully.`);
  };
  if (!session || !membership) {
  return <main className="app-shell">{authOpen ? <AuthModal session={session} membership={membership} onClose={() => undefined} onToast={showToast}/> : null}</main>;
  }
  if (loading) return <main className="app-shell"><div className="auth-empty"><span className="success-icon"><Icon name="shield" size={28}/></span><span className="section-kicker">AQAN BIOMEDICAL POS</span><h2>Loading secured workspace</h2><p>Verifying your profile and permissions…</p></div></main>;
  return <main className="app-shell" data-theme={activeTheme}>
    <aside className="sidebar"><Logo/><nav aria-label="Main navigation"><span className="nav-label">{language === "sw" ? "Eneo la kazi" : "Workspace"}</span>{nav.filter((item) => item.id !== "team" || ['owner', 'admin'].includes(membership?.role ?? '')).map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><Icon name={item.icon} size={19}/><span>{language === "sw" ? (swNav[item.id] || item.label) : item.label}</span>{item.id === "service" ? <b>{data.serviceRequests.filter((request) => !["resolved", "cancelled"].includes(request.status)).length}</b> : null}</button>)}</nav><div className="sidebar-status"><div><Icon name="shield" size={17}/><span><strong>{hasLiveAccess ? "Live & secured" : "Sign in required"}</strong><small>{loading ? "Syncing workspace…" : hasLiveAccess ? "Supabase synced just now" : "No sample business data shown"}</small></span></div><button onClick={() => setAuthOpen(true)} aria-label="Open system status"><Icon name="arrow" size={16}/></button></div><button className="user-block" onClick={() => setView("settings")}><span className="avatar">{initials}</span><span><strong>{displayName}</strong><small>{membership?.role ?? "Secure access"}</small></span><Icon name="more" size={18}/></button></aside>
    <section className="main-area"><header className="topbar"><div className="mobile-brand"><Logo/></div><div className="breadcrumbs"><span>AQAN BIOMEDICAL POS</span><b>/</b><strong>{currentDisplayLabel}</strong></div><label className="global-search"><Icon name="search" size={18}/><input placeholder={language === "sw" ? "Tafuta chochote…" : "Search anything…"} aria-label="Search the workspace"/><kbd>⌘ K</kbd></label><div className="top-actions"><button className="language-switch" type="button" onClick={() => changeLanguage(language === "en" ? "sw" : "en")} aria-label={language === "en" ? "Switch to Kiswahili" : "Switch to English"} title={language === "en" ? "Switch to Kiswahili" : "Switch to English"}><span>{language === "sw" ? "🇹🇿" : "🇬🇧"}</span><b>{language === "sw" ? "SW" : "EN"}</b></button><button className="theme-toggle" onClick={() => changeTheme(activeTheme === "dark" ? "light" : "dark")} aria-label="Toggle dark mode">{activeTheme === "dark" ? "☀️" : "🌙"}</button><button aria-label="Notifications"><Icon name="bell" size={19}/><span className="notification-dot"/></button><span className="divider"/><button className="top-avatar" onClick={() => setView("settings")} aria-label="Open staff account">{initials}</button></div></header>{!hasLiveAccess ? <button className="connection-banner" onClick={() => setAuthOpen(true)}><Icon name="shield" size={16}/><span><strong>{session ? "Workspace approval required" : "Sign in to AQAN"}</strong>{session ? "Ask an AQAN owner to approve your workspace access." : "Create or sign in to a staff account to access live operations."}</span><Icon name="arrow" size={16}/></button> : null}{view === "dashboard" ? <Dashboard onNavigate={setView} data={data} displayName={displayName} language={language}/> : view === "sell" ? <PointOfSale products={displayProducts} customers={data.customers} vatRate={Number(data.settings?.vat_rate ?? 18)} onToast={showToast} onCheckout={checkout}/> : (["inventory","purchases","invoices","payments","returns","expenses","reports","customers"] as string[]).includes(view) ? <OperationsView mode={({inventory:"products",purchases:"purchases",invoices:"invoices",payments:"payments",returns:"returns",expenses:"expenses",reports:"reports",customers:"customers"} as Record<string,OperationsMode>)[view]} membership={membership} base={data} onToast={showToast} onRefresh={refresh} onNavigate={setView}/> : view === "crm" ? <FacilityCrmView data={data} membership={membership} language={language} onToast={showToast} onRefresh={refresh}/> : view === "quotes" ? <QuotesView data={data} membership={membership} onToast={showToast} onAdd={() => openCreate("quotation")} onRefresh={refresh}/> : view === "service" ? <ServiceView requests={data.serviceRequests} onToast={showToast} onAdd={() => openCreate("service")}/> : view === "campaigns" ? <CampaignsView campaigns={data.campaigns} onToast={showToast} onAdd={() => openCreate("campaign")}/> : view === "logistics" ? <LogisticsView data={data} membership={membership} onToast={showToast} onRefresh={refresh}/> : view === "settings" ? <SettingsView settings={data.settings} membership={membership} session={session} language={language} theme={theme} onLanguageChange={changeLanguage} onThemeChange={changeTheme} onToast={showToast} onRefresh={refresh}/> : view === "team" && membership ? <TeamAccessView membership={membership} onToast={showToast}/> : <IntelligenceView data={data} membership={membership} onToast={showToast} onRefresh={refresh}/>}</section>
    <FloatingAqanChat data={data} membership={membership} onToast={showToast} onRefresh={refresh} onOpenIntelligence={() => setView("insights")}/>
    <nav className="mobile-nav" aria-label="Mobile navigation">{nav.filter((item) => ["dashboard", "sell", "inventory", "crm", "insights"].includes(item.id)).map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><Icon name={item.icon} size={19}/><span>{item.id === "crm" ? "CRM" : item.label.split(" ")[0]}</span></button>)}</nav>{toast ? <div className="toast" role="status"><span><Icon name="check" size={16}/></span>{toast}</div> : null}
    {authOpen ? <AuthModal session={session} membership={membership} onClose={() => { if (session && membership) setAuthOpen(false); }} onToast={showToast}/> : null}
    {createMode ? <CreateModal mode={createMode} customers={data.customers} products={data.products} onClose={() => setCreateMode(null)} onSubmit={submitCreate}/> : null}
  </main>;
}
