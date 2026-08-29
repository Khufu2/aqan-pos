"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { brandLogoUrl, createPurchaseOrder, replaceProductImage, type AqanData, type Membership } from "../../lib/aqan";
import {
  addCustomer,
  addCategory,
  addExpense,
  addSupplier,
  adjustInventory,
  convertProforma,
  convertQuotation,
  createOperationalProduct,
  createProforma,
  emptyOperationsData,
  loadOperationsData,
  processReturn,
  receivePurchase,
  recordCustomerPayment,
  recordSupplierPayment,
  type OperationsData,
  type OperationalProduct,
  type Category,
} from "../../lib/operations";

export type OperationsMode =
  | "products"
  | "purchases"
  | "invoices"
  | "payments"
  | "returns"
  | "expenses"
  | "reports"
  | "customers";
const money = (value: number) =>
  `TZS ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const date = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-TZ", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "—";
const number = (form: FormData, key: string) => Number(form.get(key) || 0);
const text = (form: FormData, key: string) =>
  String(form.get(key) || "").trim();
const today = () => new Date().toISOString().slice(0, 10);

type DataToolKind = "products" | "customers" | "suppliers";

function csvValue(value: unknown) {
  const string = String(value ?? "");
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(value.trim()); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; value = "";
    } else value += character;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  const [headers = [], ...values] = rows;
  return values.map((entry) => Object.fromEntries(headers.map((header, index) => [header.trim().toLowerCase(), entry[index]?.trim() || ""])));
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function html(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function amountInWords(value: number) {
  const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const say = (number: number): string => number < 20 ? ones[number] : number < 100 ? `${tens[Math.floor(number / 10)]}${number % 10 ? `-${ones[number % 10]}` : ""}` : number < 1000 ? `${ones[Math.floor(number / 100)]} hundred${number % 100 ? ` ${say(number % 100)}` : ""}` : number < 1_000_000 ? `${say(Math.floor(number / 1000))} thousand${number % 1000 ? ` ${say(number % 1000)}` : ""}` : `${say(Math.floor(number / 1_000_000))} million${number % 1_000_000 ? ` ${say(number % 1_000_000)}` : ""}`;
  const rounded = Math.max(0, Math.round(value));
  return `${say(rounded).replace(/^./, (letter) => letter.toUpperCase())} Tanzanian shillings only`;
}

function Status({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "bad" | "info";
}) {
  return <span className={`ops-status ${tone || "info"}`}>{children}</span>;
}
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      {label}
      {children}
    </label>
  );
}
function Empty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="ops-empty">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop">
      <div className="ops-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <span className="section-kicker">AQAN OPERATIONS</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export default function OperationsView({
  mode,
  membership,
  base,
  onToast,
  onRefresh,
  onNavigate,
}: {
  mode: OperationsMode;
  membership: Membership;
  base: AqanData;
  onToast: (message: string) => void;
  onRefresh: () => Promise<void>;
  onNavigate: (view: string) => void;
}) {
  const [data, setData] = useState<OperationsData>(emptyOperationsData);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    | "product"
    | "purchase"
    | "adjust"
    | "expense"
    | "customerPayment"
    | "supplierPayment"
    | "supplier"
    | "purchaseOrder"
    | "return"
    | "customer"
    | "proforma"
    | "dataTools"
    | "categories"
    | null
  >(null);
  const [dataToolKind, setDataToolKind] = useState<DataToolKind>("products");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [supplierDetailId, setSupplierDetailId] = useState<string | null>(null);
  const [supplierPaymentId, setSupplierPaymentId] = useState<string | undefined>();
  const openSupplierPayment = (supplierId?: string) => {
    setSupplierPaymentId(supplierId);
    setModal("supplierPayment");
  };
  const reload = async () => {
    setLoading(true);
    try {
      setData(await loadOperationsData());
    } catch (e) {
      onToast(
        e instanceof Error
          ? e.message
          : "Operational data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const save = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await Promise.all([reload(), onRefresh()]);
      setModal(null);
      onToast(message);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The record could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const filteredProducts = useMemo(
    () =>
      data.products.filter((p) => {
        const search =
          !query ||
          `${p.name} ${p.sku} ${p.barcode || ""} ${p.category}`
            .toLowerCase()
            .includes(query.toLowerCase());
        const status =
          filter === "all" ||
          (filter === "low" && p.stock > 0 && p.stock <= p.reorder_level) ||
          (filter === "out" && p.stock <= 0) ||
          (filter === "in" && p.stock > p.reorder_level) ||
          (filter === "expiring" &&
            data.batches.some(
              (b) =>
                b.product_id === p.id &&
                b.expiry_date &&
                new Date(b.expiry_date).getTime() - Date.now() <= 90 * 86400000,
            ));
        return search && status;
      }),
    [data.products, data.batches, filter, query],
  );
  const metrics = useMemo(() => {
    const sales = data.sales.filter((s) => s.status !== "void");
    const revenue = sales.reduce((a, s) => a + Number(s.total), 0);
    const cogs = data.saleItems.reduce(
      (a, i) =>
        a + Number(i.cost_price) * Number(i.quantity - i.returned_quantity),
      0,
    );
    const expenses = data.expenses
      .filter((e) => e.status === "posted")
      .reduce((a, e) => a + Number(e.amount) + Number(e.tax_amount), 0);
    return {
      revenue,
      cogs,
      expenses,
      gross: revenue - cogs,
      net: revenue - cogs - expenses,
      receivable: sales.reduce((a, s) => a + Number(s.balance_due), 0),
      payable: data.purchases.reduce((a, p) => a + Number(p.balance_due), 0),
    };
  }, [data]);
  const title: Record<OperationsMode, string> = {
    products: "Products & inventory",
    purchases: "Purchases & suppliers",
    invoices: "Invoices & sales documents",
    payments: "Payments & balances",
    returns: "Returns & credit notes",
    expenses: "Business expenses",
    reports: "Reports & profit",
    customers: "Customer accounts",
  };
  const subtitle: Record<OperationsMode, string> = {
    products:
      "Prices, stock, batches, expiry and movement history in one place.",
    purchases:
      "Receive stock, track supplier invoices and settle amounts owed.",
    invoices: "Review invoices, balances and quotation conversions.",
    payments:
      "Record money received later and keep customer or supplier balances current.",
    returns:
      "Process returns against the original invoice with correct stock handling.",
    expenses:
      "Record real operating costs so profit reports remain meaningful.",
    reports:
      "Practical sales, profit, inventory and balance reporting from live records.",
    customers: "Balances, sales history, statements and fast account actions.",
  };
  const actions =
    mode === "products" ? (
      <>
        <button className="button secondary" onClick={() => { setDataToolKind("products"); setModal("dataTools"); }}>
          Import / export
        </button>
        <button className="button secondary" onClick={() => setModal("adjust")}>
          Adjust stock
        </button>
        <button className="button secondary" onClick={() => setModal("categories")}>
          Categories
        </button>
        <button className="button primary" onClick={() => setModal("product")}>
          + Add product
        </button>
      </>
    ) : mode === "purchases" ? (
      <>
        <button className="button secondary" onClick={() => { setDataToolKind("suppliers"); setModal("dataTools"); }}>
          Import suppliers
        </button>
        <button className="button secondary" onClick={() => setModal("purchaseOrder")}>
          New purchase order
        </button>
        <button className="button secondary" onClick={() => setModal("supplier")}>
          + Add supplier
        </button>
        <button
          className="button secondary"
          onClick={() => setModal("supplierPayment")}
        >
          Pay supplier
        </button>
        <button className="button primary" onClick={() => setModal("purchase")}>
          + Receive stock
        </button>
      </>
    ) : mode === "payments" ? (
      <button
        className="button primary"
        onClick={() => setModal("customerPayment")}
      >
        + Record customer payment
      </button>
    ) : mode === "returns" ? (
      <button className="button primary" onClick={() => setModal("return")}>
        + Process return
      </button>
    ) : mode === "expenses" ? (
      <>
        <button className="button secondary" onClick={() => setModal("categories")}>
          Categories
        </button>
        <button className="button primary" onClick={() => setModal("expense")}>
          + Add expense
        </button>
      </>
    ) : mode === "customers" ? (
      <>
        <button className="button secondary" onClick={() => { setDataToolKind("customers"); setModal("dataTools"); }}>
          Import / export
        </button>
        <button className="button primary" onClick={() => setModal("customer")}>
          + New customer
        </button>
      </>
    ) : null;
  return (
    <div className="page-content operations-page">
      <section className="welcome-row ops-heading">
        <div>
          <span className="section-kicker">SIMPLE BUSINESS WORKFLOWS</span>
          <h1>{title[mode]}</h1>
          <p>{subtitle[mode]}</p>
        </div>
        <div className="header-actions">{actions}</div>
      </section>
      {loading ? (
        <div className="ops-loading">Loading live business records…</div>
      ) : (
        <>
          {mode === "products" && (
            <Products
              data={data}
              products={filteredProducts}
              filter={filter}
              setFilter={setFilter}
              query={query}
              setQuery={setQuery}
              onSell={() => onNavigate("sell")}
              onReceive={() => setModal("purchase")}
              onAdjust={() => setModal("adjust")}
            />
          )}
          {mode === "purchases" && (
            <Purchases
              data={data}
              suppliers={base.suppliers}
              purchaseOrders={base.purchaseOrders}
              onReceive={() => setModal("purchase")}
              onPay={() => openSupplierPayment()}
              onAddSupplier={() => setModal("supplier")}
              onOpenSupplier={setSupplierDetailId}
            />
          )}
          {mode === "invoices" && (
            <Invoices
              data={data}
              base={base}
              onToast={onToast}
              onCreateProforma={() => setModal("proforma")}
              onConvert={async (id) =>
                save(
                  () => convertQuotation(id),
                  "Quotation converted to an invoice.",
                )
              }
              onConvertProforma={async (id) =>
                save(
                  () => convertProforma(id),
                  "Proforma converted to a final invoice.",
                )
              }
            />
          )}
          {mode === "payments" && (
            <Payments
              data={data}
              onReceive={() => setModal("customerPayment")}
              onSupplier={() => openSupplierPayment()}
            />
          )}
          {mode === "returns" && (
            <Returns data={data} onCreate={() => setModal("return")} />
          )}
          {mode === "expenses" && (
            <Expenses data={data} onCreate={() => setModal("expense")} />
          )}
          {mode === "reports" && <Reports data={data} metrics={metrics} />}
          {mode === "customers" && (
            <Customers
              data={data}
              base={base}
              onPayment={() => setModal("customerPayment")}
              onSale={() => onNavigate("sell")}
              onQuote={() => onNavigate("quotes")}
              onStatement={() => undefined}
              onCreate={() => setModal("customer")}
            />
          )}
        </>
      )}
      {modal === "product" && (
        <ProductForm
          membership={membership}
          suppliers={base.suppliers}
          categories={data.categories}
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
          onSave={(p, purchase, image) =>
            save(
              async () => {
                const productId = await createOperationalProduct(p, purchase);
                if (image) await replaceProductImage(productId, membership.organization_id, image);
              },
              "Product, opening stock and purchase history saved.",
            )
          }
        />
      )}
      {modal === "purchase" && (
        <PurchaseForm
          membership={membership}
          products={data.products}
          suppliers={base.suppliers}
          warehouses={base.warehouses}
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
          onSave={(h, i) =>
            save(
              () => receivePurchase(h, i),
              "Purchase received. Stock, batches and supplier balance updated.",
            )
          }
        />
      )}
      {modal === "supplier" && (
        <SupplierForm
          membership={membership}
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
          onSave={(input) => save(() => addSupplier(input), "Supplier saved and ready for purchases.")}
        />
      )}
      {modal === "purchaseOrder" && (
        <PurchaseOrderForm membership={membership} suppliers={base.suppliers} warehouses={base.warehouses} busy={busy} error={error} onClose={() => setModal(null)} onSave={(input) => save(() => createPurchaseOrder(input), "Purchase order created. Receive stock when the supplier delivers.")} />
      )}
      {modal === "adjust" && (
        <AdjustmentForm
          products={data.products}
          batches={data.batches}
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
          onSave={(p, b, q, r, n) =>
            save(
              () => adjustInventory(p, b, q, r, n),
              "Stock adjustment saved to the movement ledger.",
            )
          }
        />
      )}
      {modal === "expense" && (
        <ExpenseForm
          membership={membership}
          suppliers={base.suppliers}
          categories={data.categories}
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
          onSave={(input) =>
            save(
              () => addExpense(input),
              "Expense recorded and included in reports.",
            )
          }
        />
      )}
      {modal === "customerPayment" && (
        <CustomerPaymentForm
          customers={base.customers}
          sales={data.sales}
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
          onSave={(input) =>
            save(
              () => recordCustomerPayment(input),
              "Customer payment allocated and balances updated.",
            )
          }
        />
      )}
      {modal === "supplierPayment" && (
        <SupplierPaymentForm
          suppliers={base.suppliers}
          purchases={data.purchases}
          busy={busy}
          error={error}
          initialSupplierId={supplierPaymentId}
          onClose={() => { setModal(null); setSupplierPaymentId(undefined); }}
          onSave={(input) =>
            save(
              () => recordSupplierPayment(input),
              "Supplier payment recorded and balance updated.",
            )
          }
        />
      )}
      {modal === "return" && (
        <ReturnForm
          sales={data.sales}
          items={data.saleItems}
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
          onSave={(input) =>
            save(
              () => processReturn(input),
              "Return and credit note processed with stock history.",
            )
          }
        />
      )}
      {modal === "customer" && (
        <CustomerForm
          membership={membership}
          categories={data.categories}
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
          onSave={(input) =>
            save(() => addCustomer(input), "Customer account created.")
          }
        />
      )}
      {modal === "proforma" && (
        <ProformaForm
          membership={membership}
          customers={base.customers}
          products={data.products}
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
          onSave={(input) =>
            save(() => createProforma(input), "Proforma invoice created.")
          }
        />
      )}
      {modal === "dataTools" && (
        <DataToolsForm
          initialKind={dataToolKind}
          membership={membership}
          data={data}
          base={base}
          onClose={() => setModal(null)}
          onComplete={(message) => save(async () => undefined, message)}
        />
      )}
      {modal === "categories" && (
        <CategoryForm
          membership={membership}
          categories={data.categories}
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
          onSave={(input) => save(() => addCategory(input), "Category saved and available across AQAN.")}
        />
      )}
      {supplierDetailId && (
        <SupplierDetail
          supplier={base.suppliers.find((supplier) => supplier.id === supplierDetailId) || null}
          purchases={data.purchases}
          onClose={() => setSupplierDetailId(null)}
          onRecordPayment={(supplierId) => { setSupplierDetailId(null); openSupplierPayment(supplierId); }}
        />
      )}
    </div>
  );
}

function Products({
  data,
  products,
  filter,
  setFilter,
  query,
  setQuery,
  onSell,
  onReceive,
  onAdjust,
}: {
  data: OperationsData;
  products: OperationalProduct[];
  filter: string;
  setFilter: (v: string) => void;
  query: string;
  setQuery: (v: string) => void;
  onSell: () => void;
  onReceive: () => void;
  onAdjust: () => void;
}) {
  return (
    <>
      <div className="ops-filterbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product, SKU or barcode…"
        />
        <div>
          {[
            ["all", "All"],
            ["in", "In stock"],
            ["low", "Low stock"],
            ["out", "Out of stock"],
            ["expiring", "Expiring soon"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? "active" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="ops-table-wrap">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Stock</th>
              <th>Average cost</th>
              <th>Retail / wholesale</th>
              <th>Stock value</th>
              <th>Nearest expiry</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const batches = data.batches.filter((b) => b.product_id === p.id);
              const expiry = batches
                .map((b) => b.expiry_date)
                .filter(Boolean)
                .sort()[0];
              const status =
                p.stock <= 0
                  ? ["Out of stock", "bad"]
                  : p.stock <= p.reorder_level
                    ? ["Low stock", "warn"]
                    : ["In stock", "ok"];
              return (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <small>
                      {p.sku} · {p.category} · {p.unit_of_measure}
                    </small>
                  </td>
                  <td>
                    <strong>{p.stock.toLocaleString()}</strong>{" "}
                    {p.unit_of_measure}
                  </td>
                  <td>{money(p.average_cost || p.cost)}</td>
                  <td>
                    {money(p.price)}
                    <small>
                      {p.wholesale_price
                        ? `Wholesale ${money(p.wholesale_price)}`
                        : "No wholesale price"}
                    </small>
                  </td>
                  <td>{money(p.stock * (p.average_cost || p.cost))}</td>
                  <td>{date(expiry)}</td>
                  <td>
                    <Status tone={status[1] as "ok" | "warn" | "bad"}>
                      {status[0]}
                    </Status>
                  </td>
                  <td>
                    <div className="ops-row-actions">
                      <button onClick={onSell}>Sell</button>
                      <button onClick={onReceive}>Receive</button>
                      <button onClick={onAdjust}>Adjust</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!products.length && (
          <Empty
            title="No matching products"
            copy="Add a product or change the stock filters."
          />
        )}
      </div>
    </>
  );
}
function Purchases({
  data,
  suppliers,
  purchaseOrders,
  onReceive,
  onPay,
  onAddSupplier,
  onOpenSupplier,
}: {
  data: OperationsData;
  suppliers: AqanData["suppliers"];
  purchaseOrders: AqanData["purchaseOrders"];
  onReceive: () => void;
  onPay: () => void;
  onAddSupplier: () => void;
  onOpenSupplier: (supplierId: string) => void;
}) {
  return (
    <>
      <section className="ops-kpis">
        <article>
          <span>Total purchases</span>
          <strong>
            {money(data.purchases.reduce((a, p) => a + Number(p.total), 0))}
          </strong>
        </article>
        <article>
          <span>Supplier balance</span>
          <strong>
            {money(
              data.purchases.reduce((a, p) => a + Number(p.balance_due), 0),
            )}
          </strong>
        </article>
        <article>
          <span>Open purchase invoices</span>
          <strong>
            {data.purchases.filter((p) => p.balance_due > 0).length}
          </strong>
        </article>
        <article>
          <span>Active batches</span>
          <strong>{data.batches.length}</strong>
        </article>
      </section>
      <section className="ops-supplier-panel">
        <div>
          <span className="section-kicker">Suppliers</span>
          <h3>Where you buy from</h3>
          <p>Select a supplier when receiving stock. AQAN then keeps their purchase history and outstanding balance together.</p>
        </div>
        <div className="ops-supplier-chips">
          {suppliers.slice(0, 6).map((supplier) => <button type="button" key={supplier.id} onClick={() => onOpenSupplier(supplier.id)}><b>{supplier.name}</b><small>{supplier.payment_terms || "Payment terms not set"}</small></button>)}
          {!suppliers.length ? <span className="ops-empty-supplier">No suppliers yet</span> : null}
        </div>
        <button className="button secondary" onClick={onAddSupplier}>+ Add supplier</button>
      </section>
      <section className="ops-purchase-orders">
        <div className="panel-heading"><div><span className="section-kicker">Purchase orders</span><h2>Orders waiting for delivery</h2></div><span>{purchaseOrders.length} records</span></div>
        {purchaseOrders.length ? <div className="ops-po-list">{purchaseOrders.slice(0, 6).map((order) => <div key={order.id}><span><b>{order.po_number}</b><small>{order.supplier?.name || "Supplier"} · Expected {date(order.expected_on)}</small></span><strong>{money(order.total)}</strong><Status tone={order.status === "received" ? "ok" : "info"}>{order.status.replaceAll("_", " ")}</Status></div>)}</div> : <p className="ops-po-empty">Create a purchase order to track an intended supplier delivery, then use Receive stock when the goods arrive.</p>}
      </section>
      <div className="ops-table-wrap">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Purchase</th>
              <th>Supplier</th>
              <th>Date / due</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.purchases.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.purchase_number}</strong>
                  <small>
                    {p.supplier_invoice_number || "No supplier reference"}
                  </small>
                </td>
                <td>{p.supplier_id && p.supplier ? <button type="button" className="ops-link" onClick={() => onOpenSupplier(p.supplier_id!)}>{p.supplier.name}</button> : "—"}</td>
                <td>
                  {date(p.purchase_date)}
                  <small>Due {date(p.due_date)}</small>
                </td>
                <td>{money(p.total)}</td>
                <td>{money(p.amount_paid)}</td>
                <td>
                  <strong>{money(p.balance_due)}</strong>
                </td>
                <td>
                  <Status tone={p.balance_due ? "warn" : "ok"}>
                    {p.balance_due ? `${p.payment_status.replaceAll("_", " ")} · ${money(p.balance_due)} owed` : "Fully paid"}
                  </Status>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.purchases.length && (
          <Empty
            title="No purchases yet"
            copy="Receive stock to create supplier purchase history and inventory batches."
          />
        )}
      </div>
      <div className="ops-bottom-actions">
        <button className="button secondary" onClick={onPay}>
          Record supplier payment
        </button>
        <button className="button primary" onClick={onReceive}>
          Receive stock
        </button>
      </div>
    </>
  );
}

function SupplierDetail({
  supplier,
  purchases,
  onClose,
  onRecordPayment,
}: {
  supplier: AqanData["suppliers"][number] | null;
  purchases: OperationsData["purchases"];
  onClose: () => void;
  onRecordPayment: (supplierId: string) => void;
}) {
  if (!supplier) return null;
  const history = purchases.filter((purchase) => purchase.supplier_id === supplier.id);
  const total = history.reduce((sum, purchase) => sum + Number(purchase.total), 0);
  const paid = history.reduce((sum, purchase) => sum + Number(purchase.amount_paid), 0);
  const outstanding = history.reduce((sum, purchase) => sum + Number(purchase.balance_due), 0);
  const message = `Hello ${supplier.contact_name || supplier.name}, we are following up regarding the AQAN supplier account. Current outstanding balance: ${money(outstanding)}.`;
  const phone = supplier.phone?.replace(/\D/g, "");
  return (
    <Modal title={supplier.name} subtitle="Supplier account, purchase history and payment position." onClose={onClose}>
      <section className="ops-kpis">
        <article><span>Total purchased</span><strong>{money(total)}</strong></article>
        <article><span>Amount paid</span><strong>{money(paid)}</strong></article>
        <article><span>Outstanding</span><strong>{money(outstanding)}</strong></article>
        <article><span>Purchase invoices</span><strong>{history.length}</strong></article>
      </section>
      <section className="ops-subpanel">
        <div>
          <strong>{supplier.contact_name || "Supplier contact"}</strong>
          <p>{supplier.phone || "No phone"}{supplier.email ? ` · ${supplier.email}` : ""}</p>
          <small>{supplier.payment_terms || "No payment terms set"}</small>
        </div>
        {supplier.email ? <a className="button secondary" href={`mailto:${supplier.email}?subject=${encodeURIComponent(`Supplier account – ${supplier.name}`)}&body=${encodeURIComponent(message)}`}>Email</a> : null}
        {phone ? <a className="button secondary" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">WhatsApp</a> : null}
      </section>
      <div className="ops-table-wrap">
        <table className="ops-table">
          <thead><tr><th>Purchase</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
          <tbody>{history.map((purchase) => <tr key={purchase.id}><td><strong>{purchase.purchase_number}</strong><small>{purchase.supplier_invoice_number || "No supplier reference"}</small></td><td>{date(purchase.purchase_date)}</td><td>{money(purchase.total)}</td><td>{money(purchase.amount_paid)}</td><td>{money(purchase.balance_due)}</td><td><Status tone={purchase.balance_due ? "warn" : "ok"}>{purchase.balance_due ? "Amount due" : "Fully paid"}</Status></td></tr>)}</tbody>
        </table>
        {!history.length ? <Empty title="No purchase history" copy="Use Receive stock and select this supplier to start its live history." /> : null}
      </div>
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onClose}>Close</button>
        <button type="button" className="button primary" onClick={() => onRecordPayment(supplier.id)}>Record supplier payment</button>
      </div>
    </Modal>
  );
}

function Invoices({
  data,
  base,
  onToast,
  onConvert,
  onCreateProforma,
  onConvertProforma,
}: {
  data: OperationsData;
  base: AqanData;
  onToast: (m: string) => void;
  onConvert: (id: string) => void;
  onCreateProforma: () => void;
  onConvertProforma: (id: string) => void;
}) {
  const [tab, setTab] = useState<"invoices" | "quotes" | "proformas">(
    "invoices",
  );
  const print = (sale: OperationsData["sales"][number]) => {
    const w = window.open("", "_blank");
    if (!w) {
      onToast("Allow pop-ups to print this invoice.");
      return;
    }
    const settings = base.settings;
    const accent = settings?.quotation_accent || "#0f766e";
    const logo = brandLogoUrl(settings?.logo_path);
    const isCompact = settings?.document_layout === "compact";
    const isClassic = settings?.document_layout === "classic";
    w.document.write(
      `<html><head><title>${html(sale.invoice_number)}</title><style>body{font:${isCompact ? "13" : "15"}px ${isClassic ? "Georgia,serif" : "Arial,sans-serif"};padding:${isCompact ? "24" : "40"}px;max-width:800px;margin:auto;color:#17364b}.brand{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:3px solid ${accent};padding-bottom:18px}.brand h1{margin:0;color:${accent};font-size:${isCompact ? "24" : "31"}px}.brand img{max-width:100px;max-height:64px;object-fit:contain}.meta{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0}.meta b{display:block;font-size:11px;text-transform:uppercase;color:#58758a;margin-bottom:5px}table{width:100%;border-collapse:collapse}td,th{padding:${isCompact ? "8" : "11"}px;border-bottom:1px solid #d8e3e8;text-align:left}th{background:#f2f8fa;font-size:11px;text-transform:uppercase;color:#58758a}.total{margin-top:18px;margin-left:auto;width:min(330px,100%);font-size:15px}.total div{display:flex;justify-content:space-between;padding:5px 0}.total .due{border-top:2px solid ${accent};margin-top:6px;padding-top:9px;font-size:18px}.words,.terms{margin-top:25px;padding:14px;background:#f5f9fa;border-radius:8px;color:#426072}.footer{margin-top:28px;padding-top:12px;border-top:1px solid #d8e3e8;color:#58758a;font-size:12px}@media print{body{padding:0}}</style></head><body><section class='brand'><div><h1>${html(settings?.legal_name || "AQAN Biomedical")}</h1><p>${html(settings?.address || "")}<br>${settings?.tin ? `TIN ${html(settings.tin)}` : ""}${settings?.phone ? `<br>${html(settings.phone)}` : ""}</p></div>${logo ? `<img src='${html(logo)}' alt='Business logo'/>` : ""}</section><section class='meta'><div><b>Invoice</b><strong>${html(sale.invoice_number)}</strong><br>${date(sale.sold_at)}</div><div><b>Bill to</b><strong>${html(sale.customer?.name || "Walk-in Customer")}</strong><br>Due ${date(sale.due_date)}</div></section><table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>${data.saleItems
        .filter((i) => i.sale_id === sale.id)
        .map(
          (i) =>
            `<tr><td>${html(i.product_name)}<br><small>${html(i.sku)}</small></td><td>${i.quantity}</td><td>${money(i.unit_price)}</td><td>${money(i.line_total)}</td></tr>`,
        )
        .join(
          "",
        )}</table><section class='total'><div><span>Subtotal</span><b>${money(sale.subtotal)}</b></div><div><span>VAT / tax</span><b>${money(sale.vat_amount)}</b></div><div><span>Total</span><b>${money(sale.total)}</b></div><div><span>Amount paid</span><b>${money(sale.amount_paid)}</b></div><div class='due'><span>Balance due</span><b>${money(sale.balance_due)}</b></div></section><div class='words'><b>Amount in words:</b> ${html(amountInWords(sale.total))}</div>${settings?.payment_terms ? `<div class='terms'><b>Payment instructions:</b><br>${html(settings.payment_terms)}</div>` : ""}<div class='footer'>${html(settings?.invoice_footer || "Thank you for your business.")}</div></body></html>`,
    );
    w.document.close();
    w.print();
  };
  const share = (sale: OperationsData["sales"][number], channel: "email" | "whatsapp") => {
    const business = base.settings?.legal_name || "AQAN Biomedical";
    const message = `Hello ${sale.customer?.name || "Customer"}, your invoice ${sale.invoice_number} from ${business} totals ${money(sale.total)}. ${sale.balance_due ? `Balance due: ${money(sale.balance_due)}.` : "This invoice is fully paid."}`;
    if (channel === "email") {
      window.location.href = `mailto:${sale.customer?.email || ""}?subject=${encodeURIComponent(`Invoice ${sale.invoice_number}`)}&body=${encodeURIComponent(message)}`;
      return;
    }
    const phone = sale.customer?.phone?.replace(/\D/g, "");
    if (!phone) { onToast("This invoice has no customer WhatsApp number. Add one to the customer account first."); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };
  return (
    <>
      <div className="ops-doc-tabs">
        <button
          className={tab === "invoices" ? "active" : ""}
          onClick={() => setTab("invoices")}
        >
          Invoices
        </button>
        <button
          className={tab === "quotes" ? "active" : ""}
          onClick={() => setTab("quotes")}
        >
          Quotations ({base.quotations.length})
        </button>
        <button
          className={tab === "proformas" ? "active" : ""}
          onClick={() => setTab("proformas")}
        >
          Proformas ({data.proformas.length})
        </button>
        {tab === "proformas" && (
          <button className="button primary" onClick={onCreateProforma}>
            + New proforma
          </button>
        )}
      </div>
      {tab === "invoices" ? (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Document</th>
              </tr>
            </thead>
            <tbody>
              {data.sales.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.invoice_number}</strong>
                  </td>
                  <td>{s.customer?.name || "Walk-in Customer"}</td>
                  <td>{date(s.sold_at)}</td>
                  <td>{money(s.total)}</td>
                  <td>{money(s.amount_paid)}</td>
                  <td>{money(s.balance_due)}</td>
                  <td>
                    <Status tone={s.balance_due ? "warn" : "ok"}>
                      {s.status}
                    </Status>
                  </td>
                  <td>
                    <div className="ops-row-actions"><button className="ops-link" onClick={() => print(s)}>Print / PDF</button><button className="ops-link" onClick={() => share(s, "email")}>Email</button><button className="ops-link" onClick={() => share(s, "whatsapp")}>WhatsApp</button></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.sales.length && (
            <Empty
              title="No invoices yet"
              copy="Complete a sale to generate the first invoice or receipt."
            />
          )}
        </div>
      ) : tab === "quotes" ? (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Quotation</th>
                <th>Customer</th>
                <th>Valid until</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {base.quotations.map((q) => (
                <tr key={q.id}>
                  <td>
                    <strong>{q.quote_number}</strong>
                  </td>
                  <td>{q.customer?.name || "Customer"}</td>
                  <td>{date(q.valid_until)}</td>
                  <td>{money(q.total)}</td>
                  <td>
                    <Status tone={q.status === "converted" ? "ok" : "info"}>
                      {q.status}
                    </Status>
                  </td>
                  <td>
                    {q.status !== "converted" && (
                      <button
                        className="ops-link"
                        onClick={() => onConvert(q.id)}
                      >
                        Convert to invoice
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Proforma</th>
                <th>Customer</th>
                <th>Date / valid</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.proformas.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.proforma_number}</strong>
                  </td>
                  <td>{p.customer?.name || "Customer"}</td>
                  <td>
                    {date(p.issue_date)}
                    <small>Valid until {date(p.valid_until)}</small>
                  </td>
                  <td>{money(p.total)}</td>
                  <td>
                    <Status tone={p.status === "converted" ? "ok" : "info"}>
                      {p.status}
                    </Status>
                  </td>
                  <td>
                    {p.status !== "converted" && (
                      <button
                        className="ops-link"
                        onClick={() => onConvertProforma(p.id)}
                      >
                        Convert to final invoice
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.proformas.length && (
            <Empty
              title="No proformas yet"
              copy="Create a proforma with the customer, product, amount and validity, then convert it when payment is ready."
            />
          )}
        </div>
      )}
    </>
  );
}

function Payments({
  data,
  onReceive,
  onSupplier,
}: {
  data: OperationsData;
  onReceive: () => void;
  onSupplier: () => void;
}) {
  return (
    <>
      <section className="ops-kpis">
        <article>
          <span>Customer receivables</span>
          <strong>
            {money(data.sales.reduce((a, s) => a + s.balance_due, 0))}
          </strong>
        </article>
        <article>
          <span>Supplier payables</span>
          <strong>
            {money(data.purchases.reduce((a, p) => a + p.balance_due, 0))}
          </strong>
        </article>
        <article>
          <span>Payments recorded</span>
          <strong>
            {money(data.customerPayments.reduce((a, p) => a + p.amount, 0))}
          </strong>
        </article>
      </section>
      <div className="ops-split">
        <div className="ops-table-wrap">
          <h3>Recent customer payments</h3>
          <table className="ops-table">
            <tbody>
              {data.customerPayments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.customer?.name || "Customer"}</strong>
                    <small>
                      {date(p.received_at)} · {p.method}
                    </small>
                  </td>
                  <td>{p.reference || "—"}</td>
                  <td>
                    <strong>{money(p.amount)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.customerPayments.length && (
            <Empty
              title="No later payments"
              copy="Payments made during checkout remain on their invoice. Record later debt payments here."
            />
          )}
        </div>
        <div className="ops-card">
          <h3>Outstanding invoices</h3>
          {data.sales
            .filter((s) => s.balance_due > 0)
            .slice(0, 8)
            .map((s) => (
              <div className="ops-balance" key={s.id}>
                <span>
                  <strong>{s.customer?.name || "Walk-in"}</strong>
                  <small>
                    {s.invoice_number} · Due {date(s.due_date)}
                  </small>
                </span>
                <b>{money(s.balance_due)}</b>
              </div>
            ))}
        </div>
      </div>
      <div className="ops-bottom-actions">
        <button className="button secondary" onClick={onSupplier}>
          Pay supplier
        </button>
        <button className="button primary" onClick={onReceive}>
          Receive customer payment
        </button>
      </div>
    </>
  );
}

function Returns({
  data,
  onCreate,
}: {
  data: OperationsData;
  onCreate: () => void;
}) {
  return (
    <div className="ops-table-wrap">
      <table className="ops-table">
        <thead>
          <tr>
            <th>Credit note</th>
            <th>Invoice</th>
            <th>Date</th>
            <th>Resolution</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.returns.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.return_number}</strong>
              </td>
              <td>
                {data.sales.find((s) => s.id === r.sale_id)?.invoice_number ||
                  "—"}
              </td>
              <td>{date(r.created_at)}</td>
              <td>{r.action.replaceAll("_", " ")}</td>
              <td>{money(r.total)}</td>
              <td>
                <Status tone="ok">{r.status}</Status>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data.returns.length && (
        <Empty
          title="No returns or credit notes"
          copy="Open the return workflow to select an invoice, item, reason and inventory outcome."
        />
      )}
      <div className="ops-bottom-actions">
        <button className="button primary" onClick={onCreate}>
          Process return
        </button>
      </div>
    </div>
  );
}
function Expenses({
  data,
  onCreate,
}: {
  data: OperationsData;
  onCreate: () => void;
}) {
  const [period] = useState(() => new Date().toISOString().slice(0, 7));
  return (
    <>
      <section className="ops-kpis">
        <article>
          <span>This month</span>
          <strong>
            {money(
              data.expenses
                .filter((e) => e.expense_date.slice(0, 7) === period)
                .reduce((a, e) => a + e.amount + e.tax_amount, 0),
            )}
          </strong>
        </article>
        <article>
          <span>All posted expenses</span>
          <strong>
            {money(
              data.expenses.reduce((a, e) => a + e.amount + e.tax_amount, 0),
            )}
          </strong>
        </article>
      </section>
      <div className="ops-table-wrap">
        <table className="ops-table">
          <thead>
            <tr>
              <th>Expense</th>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Method</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.expenses.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.expense_number}</strong>
                </td>
                <td>{date(e.expense_date)}</td>
                <td>{e.category_name}</td>
                <td>{e.description}</td>
                <td>{e.payment_method}</td>
                <td>
                  <strong>{money(e.amount + e.tax_amount)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.expenses.length && (
          <Empty
            title="No expenses recorded"
            copy="Record rent, utilities, salaries, transport and other costs for accurate P&L."
          />
        )}
      </div>
    </>
  );
}
function Reports({
  data,
  metrics,
}: {
  data: OperationsData;
  metrics: {
    revenue: number;
    cogs: number;
    expenses: number;
    gross: number;
    net: number;
    receivable: number;
    payable: number;
  };
}) {
  const [now] = useState(() => Date.now());
  const [period, setPeriod] = useState<"month" | "week" | "today" | "custom">("month");
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const bounds = useMemo(() => {
    const end = new Date(`${to}T23:59:59`);
    if (period === "custom") return { start: new Date(`${from}T00:00:00`), end };
    const start = new Date();
    if (period === "month") start.setDate(1);
    else if (period === "week") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    return { start, end: new Date() };
  }, [from, period, to]);
  const inRange = (value: string) => {
    const point = new Date(value).getTime();
    return point >= bounds.start.getTime() && point <= bounds.end.getTime();
  };
  const reportSales = data.sales.filter((sale) => inRange(sale.sold_at));
  const reportItems = data.saleItems.filter((item) => reportSales.some((sale) => sale.id === item.sale_id));
  const reportExpenses = data.expenses.filter((expense) => inRange(expense.expense_date));
  const reportMetrics = {
    revenue: reportSales.reduce((sum, sale) => sum + Number(sale.total), 0),
    cogs: reportItems.reduce((sum, item) => sum + Number(item.cost_price) * Number(item.quantity - item.returned_quantity), 0),
    expenses: reportExpenses.filter((expense) => expense.status === "posted").reduce((sum, expense) => sum + Number(expense.amount) + Number(expense.tax_amount), 0),
  };
  const exportReport = () => downloadCsv("aqan-profit-report.csv", ["Period", "Sales revenue", "Cost of goods sold", "Gross profit", "Expenses", "Net operating profit"], [[`${from} to ${to}`, reportMetrics.revenue, reportMetrics.cogs, reportMetrics.revenue - reportMetrics.cogs, reportMetrics.expenses, reportMetrics.revenue - reportMetrics.cogs - reportMetrics.expenses]]);
  const inventory = data.products.reduce(
    (a, p) => a + p.stock * (p.average_cost || p.cost),
    0,
  );
  return (
    <>
      <div className="ops-filterbar">
        <div>
          {([ ["month", "This month"], ["week", "This week"], ["today", "Today"], ["custom", "Custom range"] ] as const).map(([key, label]) => <button key={key} className={period === key ? "active" : ""} onClick={() => setPeriod(key)}>{label}</button>)}
        </div>
        <div className="ops-report-actions">{period === "custom" ? <><input aria-label="Report start date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><input aria-label="Report end date" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></> : null}<button className="button secondary" onClick={exportReport}>Export CSV</button><button className="button secondary" onClick={() => window.print()}>Print / Save PDF</button></div>
      </div>
      <section className="ops-kpis report">
        <article>
          <span>Sales revenue</span>
          <strong>{money(reportMetrics.revenue)}</strong>
        </article>
        <article>
          <span>Cost of goods sold</span>
          <strong>{money(reportMetrics.cogs)}</strong>
        </article>
        <article>
          <span>Gross profit</span>
          <strong>{money(reportMetrics.revenue - reportMetrics.cogs)}</strong>
        </article>
        <article>
          <span>Operating expenses</span>
          <strong>{money(reportMetrics.expenses)}</strong>
        </article>
        <article>
          <span>Net operating profit</span>
          <strong>{money(reportMetrics.revenue - reportMetrics.cogs - reportMetrics.expenses)}</strong>
        </article>
        <article>
          <span>Inventory value</span>
          <strong>{money(inventory)}</strong>
        </article>
        <article>
          <span>Customer credit</span>
          <strong>{money(metrics.receivable)}</strong>
        </article>
        <article>
          <span>Supplier balances</span>
          <strong>{money(metrics.payable)}</strong>
        </article>
      </section>
      <div className="ops-split">
        <div className="ops-card">
          <h3>Sales by product</h3>
          {[...reportItems]
            .sort((a, b) => b.line_total - a.line_total)
            .slice(0, 8)
            .map((i) => (
              <div className="ops-balance" key={i.id}>
                <span>
                  <strong>{i.product_name}</strong>
                  <small>{i.quantity} sold</small>
                </span>
                <b>{money(i.line_total)}</b>
              </div>
            ))}
        </div>
        <div className="ops-card">
          <h3>Inventory attention</h3>
          <div className="ops-balance">
            <span>
              <strong>Low stock</strong>
              <small>At or below reorder level</small>
            </span>
            <b>
              {data.products.filter((p) => p.stock <= p.reorder_level).length}
            </b>
          </div>
          <div className="ops-balance">
            <span>
              <strong>Expiring within 90 days</strong>
              <small>Remaining batches</small>
            </span>
            <b>
              {
                data.batches.filter(
                  (b) =>
                    b.expiry_date &&
                    new Date(b.expiry_date).getTime() - now <= 90 * 86400000,
                ).length
              }
            </b>
          </div>
          <div className="ops-balance">
            <span>
              <strong>Expired stock</strong>
              <small>Requires write-off</small>
            </span>
            <b>
              {
                data.batches.filter(
                  (b) =>
                    b.expiry_date && new Date(b.expiry_date).getTime() < now,
                ).length
              }
            </b>
          </div>
        </div>
      </div>
    </>
  );
}

function Customers({
  data,
  base,
  onPayment,
  onSale,
  onQuote,
  onStatement,
  onCreate,
}: {
  data: OperationsData;
  base: AqanData;
  onPayment: () => void;
  onSale: () => void;
  onQuote: () => void;
  onStatement: () => void;
  onCreate: () => void;
}) {
  const printStatement = (customer: AqanData["customers"][number]) => {
    const sales = data.sales.filter((sale) => sale.customer_id === customer.id);
    const payments = data.customerPayments.filter((payment) => payment.customer_id === customer.id);
    const rows = [
      ...sales.map((sale) => ({ date: sale.sold_at, reference: sale.invoice_number, debit: sale.total, credit: sale.amount_paid, balance: sale.balance_due, type: "Invoice" })),
      ...payments.map((payment) => ({ date: payment.received_at, reference: payment.reference || "Customer payment", debit: 0, credit: payment.amount, balance: 0, type: "Payment" })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const body = rows.map((row) => {
      running += Number(row.debit) - Number(row.credit);
      return `<tr><td>${date(row.date)}</td><td>${row.type}</td><td>${row.reference}</td><td>${money(row.debit)}</td><td>${money(row.credit)}</td><td>${money(running)}</td></tr>`;
    }).join("");
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Statement - ${customer.name}</title><style>body{font:15px Arial;padding:36px;max-width:900px;margin:auto;color:#16364d}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{padding:10px;border-bottom:1px solid #dbe7ee;text-align:left}th{font-size:11px;text-transform:uppercase;color:#58758a}.total{margin-top:20px;text-align:right;font-size:18px;font-weight:bold}</style></head><body><h1>Customer statement</h1><p><b>${customer.name}</b><br>${customer.phone || customer.email || "Customer account"}<br>Generated ${date(today())}</p><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Invoice</th><th>Payment</th><th>Running balance</th></tr></thead><tbody>${body || "<tr><td colspan='6'>No transactions in this account.</td></tr>"}</tbody></table><p class='total'>Closing balance: ${money(running)}</p></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };
  return (
    <div className="ops-customer-grid">
      {base.customers.map((c) => {
        const sales = data.sales.filter((s) => s.customer_id === c.id);
        const outstanding = sales.reduce((a, s) => a + s.balance_due, 0);
        return (
          <article className="ops-customer" key={c.id}>
            <div>
              <span className="avatar">{c.name.slice(0, 2).toUpperCase()}</span>
              <span>
                <strong>{c.name}</strong>
                <small>
                  {c.customer_type} · {c.city}
                </small>
              </span>
              <Status tone={outstanding ? "warn" : "ok"}>
                {outstanding ? `${money(outstanding)} due` : "Paid up"}
              </Status>
            </div>
            <section>
              <span>
                <small>Lifetime sales</small>
                <b>{money(sales.reduce((a, s) => a + s.total, 0))}</b>
              </span>
              <span>
                <small>Invoices</small>
                <b>{sales.length}</b>
              </span>
              <span>
                <small>Last purchase</small>
                <b>{date(c.last_purchase_at)}</b>
              </span>
            </section>
            <footer>
              <button onClick={onSale}>New sale</button>
              <button onClick={onQuote}>New quote</button>
              <button onClick={onPayment}>Record payment</button>
              <button onClick={() => { printStatement(c); onStatement(); }}>Statement</button>
              {c.phone && (
                <a
                  href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              )}
              {c.email && <a href={`mailto:${c.email}`}>Email</a>}
            </footer>
          </article>
        );
      })}
      {!base.customers.length && (
        <Empty
          title="No customers"
          copy="Add a customer or create one quickly during a sale."
        />
      )}
      <button className="ops-add-card" onClick={onCreate}>
        + Add customer
      </button>
    </div>
  );
}

function DataToolsForm({
  initialKind,
  membership,
  data,
  base,
  onClose,
  onComplete,
}: {
  initialKind: DataToolKind;
  membership: Membership;
  data: OperationsData;
  base: AqanData;
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const [kind, setKind] = useState<DataToolKind>(initialKind);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canImport = ["owner", "admin", "manager", "inventory", "sales", "salesperson"].includes(membership.role);
  const exportRows = () => {
    if (kind === "products") {
      downloadCsv("aqan-products.csv", ["name", "sku", "barcode", "category", "description", "unit", "cost", "retail_price", "wholesale_price", "opening_stock", "reorder_level", "tax_rate"], data.products.map((product) => [product.name, product.sku, product.barcode, product.category, product.description, product.unit_of_measure, product.average_cost || product.cost, product.price, product.wholesale_price, product.stock, product.reorder_level, product.tax_rate * 100]));
    } else if (kind === "customers") {
      downloadCsv("aqan-customers.csv", ["name", "contact_name", "phone", "whatsapp", "email", "tax_number", "billing_address", "city", "region", "country", "category", "payment_terms", "credit_limit"], base.customers.map((customer) => [customer.name, customer.contact_name, customer.phone, customer.phone, customer.email, "", "", customer.city, "", "Tanzania", customer.customer_type, "", ""]));
    } else {
      downloadCsv("aqan-suppliers.csv", ["name", "contact_name", "phone", "whatsapp", "email", "tax_number", "address", "city", "region", "payment_terms", "notes"], base.suppliers.map((supplier) => [supplier.name, supplier.contact_name, supplier.phone, "", supplier.email, "", "", "", "", supplier.payment_terms, ""]));
    }
  };
  const exportBackup = () => {
    const payload = {
      product: "AQAN Biomedical POS",
      format: "aqan-operational-backup-v1",
      exported_at: new Date().toISOString(),
      organization_id: membership.organization_id,
      data: {
        business_settings: base.settings,
        products: data.products,
        customers: base.customers,
        suppliers: base.suppliers,
        quotations: base.quotations,
        invoices: data.sales,
        invoice_items: data.saleItems,
        purchases: data.purchases,
        stock_batches: data.batches,
        stock_movements: data.movements,
        customer_payments: data.customerPayments,
        returns: data.returns,
        expenses: data.expenses,
        categories: data.categories,
      },
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aqan-business-backup-${today()}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const templateRows: Record<DataToolKind, string> = {
    products: "name,sku,barcode,category,description,unit,cost,retail_price,wholesale_price,opening_stock,reorder_level,tax_rate\nExample product,SKU-001,123456789,Consumables,Optional description,piece,8500,12000,11000,0,5,18",
    customers: "name,contact_name,phone,whatsapp,email,tax_number,billing_address,city,region,country,category,payment_terms,credit_limit\nExample Customer,Jane,+255700000000,+255700000000,customer@example.com,,Dar es Salaam,Dar es Salaam,Dar es Salaam,Tanzania,Retail,30 days,0",
    suppliers: "name,contact_name,phone,whatsapp,email,tax_number,address,city,region,payment_terms,notes\nExample Supplier,John,+255700000000,+255700000000,supplier@example.com,,Dar es Salaam,Dar es Salaam,Dar es Salaam,30 days,Imported supplier",
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([templateRows[kind]], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `aqan-${kind}-template.csv`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const importRows = async () => {
    if (!rows.length) { setError("Choose a CSV file with at least one valid row."); return; }
    if (!canImport) { setError("Your role is read-only for imports."); return; }
    setBusy(true); setError("");
    try {
      for (const row of rows) {
        if (!row.name) throw new Error("Every imported row needs a name.");
        if (kind === "customers") {
          await addCustomer({ organization_id: membership.organization_id, name: row.name, contact_name: row.contact_name || null, phone: row.phone || null, whatsapp: row.whatsapp || row.phone || null, email: row.email || null, tax_number: row.tax_number || null, billing_address: row.billing_address || null, delivery_address: row.delivery_address || null, city: row.city || "Dar es Salaam", region: row.region || null, country: row.country || "Tanzania", customer_category: row.category || null, payment_terms: row.payment_terms || null, credit_limit: Number(row.credit_limit || 0), customer_type: row.customer_type || "Customer" });
        } else if (kind === "suppliers") {
          await addSupplier({ organization_id: membership.organization_id, name: row.name, contact_name: row.contact_name || null, phone: row.phone || null, whatsapp: row.whatsapp || row.phone || null, email: row.email || null, tax_number: row.tax_number || null, address: row.address || null, city: row.city || null, region: row.region || null, payment_terms: row.payment_terms || null, notes: row.notes || null, status: "active" });
        } else {
          const openingStock = Number(row.opening_stock || row.stock || 0);
          const cost = Number(row.cost || 0);
          await createOperationalProduct({ organization_id: membership.organization_id, name: row.name, sku: row.sku || "", barcode: row.barcode || "", category: row.category || "General", description: row.description || "", product_type: row.product_type || "product", unit: row.unit || "piece", purchase_unit: row.purchase_unit || row.unit || "piece", units_per_purchase: Number(row.units_per_purchase || 1), retail_price: Number(row.retail_price || row.selling_price || 0), wholesale_price: row.wholesale_price || null, distributor_price: row.distributor_price || null, minimum_price: row.minimum_price || null, cost, tax_code: row.tax_code || "vat18", tax_rate: Number(row.tax_rate || 18) / 100, tax_inclusive: row.tax_inclusive === "true", discount_eligible: row.discount_eligible !== "false", track_inventory: row.track_inventory !== "false", allow_negative_stock: row.allow_negative_stock === "true", reorder_level: Number(row.reorder_level || 0), reorder_quantity: row.reorder_quantity || null, serial_tracked: row.serial_tracked === "true", active: row.active !== "false" }, openingStock > 0 ? { supplier_id: "", purchase_date: today(), reference: "Opening inventory import", quantity: openingStock, purchase_unit: row.purchase_unit || row.unit || "piece", units_per_purchase: Number(row.units_per_purchase || 1), unit_cost: cost, cost_per_selling_unit: cost, batch_number: row.batch_number || "", manufacturing_date: row.manufacturing_date || "", expiry_date: row.expiry_date || "", payment_status: "paid", payment_method: "import" } : null);
        }
      }
      onComplete(`${rows.length} ${kind} imported into live AQAN records.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Import could not be completed."); }
    finally { setBusy(false); }
  };
  return <Modal title="Import, export & backup" subtitle="Use a reviewed CSV to migrate products, customers or suppliers. Export a portable snapshot before major changes; restoring live financial records is deliberately handled by an administrator, not a browser button." onClose={onClose}><div className="ops-import-tabs">{(["products", "customers", "suppliers"] as DataToolKind[]).map((option) => <button type="button" className={kind === option ? "active" : ""} onClick={() => { setKind(option); setRows([]); setError(""); }} key={option}>{option}</button>)}</div><div className="ops-import-actions"><button type="button" className="button secondary" onClick={downloadTemplate}>Download CSV template</button><button type="button" className="button secondary" onClick={exportRows}>Export live {kind}</button><button type="button" className="button secondary" onClick={exportBackup}>Download AQAN backup</button></div><Field label={`Import ${kind} CSV`}><input type="file" accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setError(""); setRows(parseCsv(await file.text())); }} /></Field>{rows.length ? <div className="ops-import-preview"><strong>{rows.length} rows ready to import</strong><small>Preview: {rows.slice(0, 3).map((row) => row.name).join(" · ")}{rows.length > 3 ? " …" : ""}</small></div> : <p className="form-note">Download the template first. AQAN validates each row and writes real customer, supplier or product records only after you confirm.</p>}{error ? <div className="form-error">{error}</div> : null}<div className="modal-actions"><button className="button secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button primary" type="button" onClick={() => void importRows()} disabled={busy || !rows.length || !canImport}>{busy ? "Importing live records…" : `Import ${rows.length || ""} ${kind}`}</button></div></Modal>;
}

function CategoryForm({
  membership,
  categories,
  busy,
  error,
  onClose,
  onSave,
}: {
  membership: Membership;
  categories: Category[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (input: { organization_id: string; entity_type: Category["entity_type"]; name: string }) => void;
}) {
  const [type, setType] = useState<Category["entity_type"]>("product");
  const visible = categories.filter((category) => category.entity_type === type);
  return (
    <Modal title="Categories" subtitle="Keep products, customers and expenses consistently grouped across search, imports and reports." onClose={onClose}>
      <form onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({ organization_id: membership.organization_id, entity_type: type, name: text(form, "name") });
      }}>
        <div className="ops-filterbar">
          <div>
            {(["product", "customer", "expense"] as Category["entity_type"][]).map((option) => <button key={option} type="button" className={type === option ? "active" : ""} onClick={() => setType(option)}>{option === "product" ? "Products" : option === "customer" ? "Customers" : "Expenses"}</button>)}
          </div>
        </div>
        <Field label={`New ${type} category`}>
          <input name="name" placeholder={type === "product" ? "e.g. Consumables" : type === "customer" ? "e.g. Hospitals" : "e.g. Transport"} required />
        </Field>
        <div className="ops-category-list" aria-live="polite">
          {visible.length ? visible.map((category) => <span className="ops-status info" key={category.id}>{category.name}</span>) : <p className="form-note">No saved {type} categories yet. Add one above; existing records remain unchanged.</p>}
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>Close</button>
          <button className="button primary" disabled={busy}>{busy ? "Saving…" : "Add category"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ProductForm({
  membership,
  suppliers,
  categories,
  busy,
  error,
  onClose,
  onSave,
}: {
  membership: Membership;
  suppliers: AqanData["suppliers"];
  categories: Category[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (
    p: Record<string, unknown>,
    purchase: Record<string, unknown> | null,
    image: File | null,
  ) => void;
}) {
  const [cost, setCost] = useState(0),
    [price, setPrice] = useState(0),
    [opening, setOpening] = useState(false);
  const profit = price - cost,
    markup = cost ? (profit / cost) * 100 : 0,
    margin = price ? (profit / price) * 100 : 0;
  return (
    <Modal
      title="Add product"
      subtitle="Create the catalogue record and optional opening purchase in one transaction."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave(
            {
              name: text(f, "name"),
              sku: text(f, "sku"),
              barcode: text(f, "barcode"),
              product_type: text(f, "product_type"),
              category: text(f, "category"),
              description: text(f, "description"),
              unit: text(f, "unit"),
              purchase_unit: text(f, "purchase_unit"),
              units_per_purchase: number(f, "units_per_purchase"),
              retail_price: number(f, "retail_price"),
              wholesale_price: text(f, "wholesale_price"),
              distributor_price: text(f, "distributor_price"),
              minimum_price: text(f, "minimum_price"),
              cost: number(f, "cost"),
              tax_code: text(f, "tax_code"),
              tax_rate: number(f, "tax_rate"),
              tax_inclusive: f.get("tax_inclusive") === "on",
              discount_eligible: f.get("discount_eligible") === "on",
              track_inventory: f.get("track_inventory") === "on",
              allow_negative_stock: f.get("allow_negative_stock") === "on",
              reorder_level: number(f, "reorder_level"),
              reorder_quantity: text(f, "reorder_quantity"),
              serial_tracked: f.get("serial_tracked") === "on",
              active: true,
              supplier_id: text(f, "supplier_id"),
            },
            opening
              ? {
                  supplier_id: text(f, "supplier_id"),
                  purchase_date: text(f, "purchase_date"),
                  reference: text(f, "reference"),
                  quantity: number(f, "quantity"),
                  purchase_unit: text(f, "purchase_unit"),
                  units_per_purchase: number(f, "units_per_purchase"),
                  unit_cost: number(f, "purchase_cost"),
                  cost_per_selling_unit: number(f, "cost"),
                  batch_number: text(f, "batch_number"),
                  manufacturing_date: text(f, "manufacturing_date"),
                  expiry_date: text(f, "expiry_date"),
                  payment_status: text(f, "payment_status"),
                  payment_method: text(f, "payment_method"),
                  amount_paid: number(f, "amount_paid"),
                }
              : null,
            f.get("image") instanceof File && (f.get("image") as File).size ? (f.get("image") as File) : null,
          );
        }}
      >
        <div className="ops-form-section">
          <h3>Basic information</h3>
          <div className="form-grid">
            <Field label="Product name" className="span-two">
              <input name="name" required />
            </Field>
            <Field label="SKU (auto if blank)">
              <input name="sku" />
            </Field>
            <Field label="Barcode">
              <input name="barcode" inputMode="numeric" />
            </Field>
            <Field label="Type">
              <select name="product_type">
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
            </Field>
            <Field label="Category">
              <input name="category" required list="product-category-list" placeholder="Consumables" />
              <datalist id="product-category-list">
                {categories.filter((category) => category.entity_type === "product").map((category) => <option key={category.id} value={category.name} />)}
              </datalist>
            </Field>
            <Field label="Unit of measure">
              <select name="unit">
                <option>piece</option>
                <option>tablet</option>
                <option>bottle</option>
                <option>box</option>
                <option>pack</option>
                <option>carton</option>
                <option>kg</option>
                <option>litre</option>
                <option>service</option>
              </select>
            </Field>
            <Field label="Description" className="span-two">
              <textarea name="description" rows={2} />
            </Field>
            <Field label="Product photo" className="span-two">
              <input name="image" type="file" accept="image/jpeg,image/png,image/webp" />
              <small>Optional JPG, PNG or WebP. It appears in product records, POS and quotations.</small>
            </Field>
          </div>
        </div>
        <div className="ops-form-section">
          <h3>Pricing & tax</h3>
          <div className="form-grid">
            <Field label="Cost per selling unit">
              <input
                name="cost"
                type="number"
                min="0"
                onChange={(e) => setCost(+e.target.value)}
                required
              />
            </Field>
            <Field label="Retail price">
              <input
                name="retail_price"
                type="number"
                min="0"
                onChange={(e) => setPrice(+e.target.value)}
                required
              />
            </Field>
            <Field label="Wholesale price">
              <input name="wholesale_price" type="number" min="0" />
            </Field>
            <Field label="Distributor price">
              <input name="distributor_price" type="number" min="0" />
            </Field>
            <Field label="Minimum allowed price">
              <input name="minimum_price" type="number" min="0" />
            </Field>
            <Field label="Tax">
              <select name="tax_code" defaultValue="vat18">
                <option value="vat18">VAT 18%</option>
                <option value="exempt">VAT exempt</option>
                <option value="zero">Zero rated</option>
                <option value="custom">Custom</option>
              </select>
              <input name="tax_rate" type="hidden" value="0.18" />
            </Field>
          </div>
          <div className="margin-preview">
            <span>
              Profit/unit <b>{money(profit)}</b>
            </span>
            <span>
              Markup <b>{markup.toFixed(1)}%</b>
            </span>
            <span>
              Gross margin <b>{margin.toFixed(1)}%</b>
            </span>
          </div>
          <div className="ops-checks">
            <label>
              <input name="tax_inclusive" type="checkbox" /> Price includes tax
            </label>
            <label>
              <input name="discount_eligible" type="checkbox" defaultChecked />{" "}
              Discounts allowed
            </label>
          </div>
        </div>
        <div className="ops-form-section">
          <h3>Inventory</h3>
          <div className="form-grid">
            <Field label="Reorder level">
              <input
                name="reorder_level"
                type="number"
                min="0"
                defaultValue="5"
              />
            </Field>
            <Field label="Suggested reorder quantity">
              <input name="reorder_quantity" type="number" min="0" />
            </Field>
          </div>
          <div className="ops-checks">
            <label>
              <input name="track_inventory" type="checkbox" defaultChecked />{" "}
              Track inventory
            </label>
            <label>
              <input name="serial_tracked" type="checkbox" /> Track serial
              numbers
            </label>
            <label>
              <input name="allow_negative_stock" type="checkbox" /> Allow
              negative stock
            </label>
          </div>
        </div>
        <label className="ops-reveal">
          <input
            type="checkbox"
            checked={opening}
            onChange={(e) => setOpening(e.target.checked)}
          />
          <span>
            <strong>Record initial purchase / opening stock</strong>
            <small>
              Supplier, cost, batch and expiry will be linked automatically.
            </small>
          </span>
        </label>
        {opening && (
          <div className="ops-form-section">
            <h3>Initial purchase</h3>
            <div className="form-grid">
              <Field label="Supplier">
                <select name="supplier_id" required defaultValue="">
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Purchase date">
                <input
                  name="purchase_date"
                  type="date"
                  defaultValue={today()}
                  required
                />
              </Field>
              <Field label="Supplier invoice / reference">
                <input name="reference" />
              </Field>
              <Field label="Quantity purchased">
                <input name="quantity" type="number" min="1" required />
              </Field>
              <Field label="Purchase unit">
                <select name="purchase_unit">
                  <option>piece</option>
                  <option>box</option>
                  <option>pack</option>
                  <option>carton</option>
                  <option>bottle</option>
                </select>
              </Field>
              <Field label="Units per purchase unit">
                <input
                  name="units_per_purchase"
                  type="number"
                  min="1"
                  defaultValue="1"
                />
              </Field>
              <Field label="Cost per purchase unit">
                <input name="purchase_cost" type="number" min="0" required />
              </Field>
              <Field label="Batch / lot">
                <input name="batch_number" />
              </Field>
              <Field label="Manufacturing date">
                <input name="manufacturing_date" type="date" />
              </Field>
              <Field label="Expiry date">
                <input name="expiry_date" type="date" />
              </Field>
              <Field label="Payment status">
                <select name="payment_status">
                  <option value="paid">Paid</option>
                  <option value="partially_paid">Partially paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </Field>
              <Field label="Amount paid">
                <input name="amount_paid" type="number" min="0" />
              </Field>
              <Field label="Payment method">
                <select name="payment_method">
                  <option>cash</option>
                  <option>mobile_money</option>
                  <option>card</option>
                  <option>bank_transfer</option>
                  <option>credit</option>
                </select>
              </Field>
            </div>
          </div>
        )}
        <input
          type="hidden"
          name="organization_id"
          value={membership.organization_id}
        />
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SupplierForm({ membership, busy, error, onClose, onSave }: { membership: Membership; busy: boolean; error: string; onClose: () => void; onSave: (input: Record<string, unknown>) => void }) {
  return <Modal title="Add supplier" subtitle="Save the vendor once, then select them whenever you receive stock or record a supplier payment." onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ organization_id: membership.organization_id, name: text(form, "name"), contact_name: text(form, "contact_name") || null, phone: text(form, "phone") || null, whatsapp: text(form, "whatsapp") || null, email: text(form, "email") || null, tax_number: text(form, "tax_number") || null, address: text(form, "address") || null, city: text(form, "city") || null, region: text(form, "region") || null, payment_terms: text(form, "payment_terms") || null, notes: text(form, "notes") || null, status: "active" }); }}><div className="form-grid"><Field label="Supplier / business name" className="span-two"><input name="name" required placeholder="e.g. MedTech Supplies Ltd" /></Field><Field label="Contact person"><input name="contact_name" /></Field><Field label="Phone"><input name="phone" type="tel" /></Field><Field label="WhatsApp"><input name="whatsapp" type="tel" /></Field><Field label="Email"><input name="email" type="email" /></Field><Field label="TIN / tax number"><input name="tax_number" /></Field><Field label="Payment terms"><input name="payment_terms" placeholder="e.g. 30 days" /></Field><Field label="Address" className="span-two"><input name="address" /></Field><Field label="City"><input name="city" /></Field><Field label="Region"><input name="region" /></Field><Field label="Notes" className="span-two"><textarea name="notes" rows={3} /></Field></div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save supplier"}</button></div></form></Modal>;
}

function PurchaseOrderForm({ membership, suppliers, warehouses, busy, error, onClose, onSave }: { membership: Membership; suppliers: AqanData["suppliers"]; warehouses: AqanData["warehouses"]; busy: boolean; error: string; onClose: () => void; onSave: (input: { organizationId: string; supplierId: string; warehouseId?: string; expectedOn?: string; notes?: string }) => void }) {
  return <Modal title="New purchase order" subtitle="Record the supplier order first. Stock is not increased until you confirm the goods have arrived through Receive stock." onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ organizationId: membership.organization_id, supplierId: text(form, "supplier_id"), warehouseId: text(form, "warehouse_id") || undefined, expectedOn: text(form, "expected_on") || undefined, notes: text(form, "notes") || undefined }); }}><div className="form-grid"><Field label="Supplier" className="span-two"><select name="supplier_id" required defaultValue=""><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field><Field label="Receive into"><select name="warehouse_id"><option value="">Default location</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></Field><Field label="Expected delivery"><input name="expected_on" type="date" /></Field><Field label="Order notes" className="span-two"><textarea name="notes" rows={3} placeholder="Supplier reference, required items or delivery instructions" /></Field></div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Creating…" : "Create purchase order"}</button></div></form></Modal>;
}

function PurchaseForm({
  membership,
  products,
  suppliers,
  warehouses,
  busy,
  error,
  onClose,
  onSave,
}: {
  membership: Membership;
  products: OperationalProduct[];
  suppliers: AqanData["suppliers"];
  warehouses: AqanData["warehouses"];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (
    h: Record<string, unknown>,
    i: Array<Record<string, unknown>>,
  ) => void;
}) {
  const [lines, setLines] = useState([
    {
      key: crypto.randomUUID(),
      product_id: "",
      quantity: 1,
      units: 1,
      cost: 0,
      discount: 0,
      tax: 0,
      batch: "",
      expiry: "",
      mfg: "",
    },
  ]);
  const subtotal = lines.reduce(
    (a, l) => a + l.quantity * l.units * l.cost - l.discount,
    0,
  );
  return (
    <Modal
      title="Receive stock / new purchase"
      subtitle="One save updates purchase history, batches, moving-average cost, stock and supplier balance."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave(
            {
              supplier_id: text(f, "supplier_id"),
              warehouse_id: text(f, "warehouse_id"),
              reference: text(f, "reference"),
              purchase_date: text(f, "purchase_date"),
              due_date: text(f, "due_date"),
              payment_method: text(f, "payment_method"),
              amount_paid: number(f, "amount_paid"),
              discount_amount: number(f, "discount_amount"),
              tax_amount: number(f, "tax_amount"),
              shipping_amount: number(f, "shipping_amount"),
              additional_costs: number(f, "additional_costs"),
              notes: text(f, "notes"),
            },
            lines.map((l) => ({
              product_id: l.product_id,
              quantity: l.quantity,
              purchase_unit:
                products.find((p) => p.id === l.product_id)?.purchase_unit ||
                "piece",
              units_per_purchase: l.units,
              unit_cost: l.cost * l.units,
              discount_amount: l.discount,
              tax_rate: l.tax / 100,
              tax_amount: 0,
              line_total: l.quantity * l.units * l.cost - l.discount,
              batch_number: l.batch,
              manufacturing_date: l.mfg,
              expiry_date: l.expiry,
            })),
          );
        }}
      >
        <div className="form-grid">
          <Field label="Supplier">
            <select name="supplier_id" required defaultValue="">
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Warehouse">
            <select name="warehouse_id">
              <option value="">Default location</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier invoice / reference">
            <input name="reference" required />
          </Field>
          <Field label="Purchase date">
            <input
              name="purchase_date"
              type="date"
              defaultValue={today()}
              required
            />
          </Field>
          <Field label="Due date">
            <input name="due_date" type="date" />
          </Field>
          <Field label="Payment method">
            <select name="payment_method">
              <option>cash</option>
              <option>mobile_money</option>
              <option>bank_transfer</option>
              <option>card</option>
              <option>credit</option>
            </select>
          </Field>
        </div>
        <div className="purchase-lines">
          <div className="purchase-line-head">
            <h3>Purchase items</h3>
            <button
              type="button"
              onClick={() =>
                setLines([
                  ...lines,
                  {
                    key: crypto.randomUUID(),
                    product_id: "",
                    quantity: 1,
                    units: 1,
                    cost: 0,
                    discount: 0,
                    tax: 0,
                    batch: "",
                    expiry: "",
                    mfg: "",
                  },
                ])
              }
            >
              + Add line
            </button>
          </div>
          {lines.map((l, index) => (
            <div className="purchase-line" key={l.key}>
              <select
                aria-label="Product"
                value={l.product_id}
                onChange={(e) =>
                  setLines(
                    lines.map((x) =>
                      x.key === l.key
                        ? { ...x, product_id: e.target.value }
                        : x,
                    ),
                  )
                }
                required
              >
                <option value="">Select product</option>
                {products
                  .filter((p) => p.product_type === "product")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
              </select>
              <input
                aria-label="Quantity"
                title="Purchase quantity"
                type="number"
                min="1"
                value={l.quantity}
                onChange={(e) =>
                  setLines(
                    lines.map((x) =>
                      x.key === l.key ? { ...x, quantity: +e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                aria-label="Units per pack"
                title="Units per pack/carton"
                type="number"
                min="1"
                value={l.units}
                onChange={(e) =>
                  setLines(
                    lines.map((x) =>
                      x.key === l.key ? { ...x, units: +e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                aria-label="Cost per selling unit"
                title="Cost per selling unit"
                type="number"
                min="0"
                placeholder="Unit cost"
                value={l.cost || ""}
                onChange={(e) =>
                  setLines(
                    lines.map((x) =>
                      x.key === l.key ? { ...x, cost: +e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                aria-label="Batch"
                title="Batch / lot"
                placeholder="Batch"
                value={l.batch}
                onChange={(e) =>
                  setLines(
                    lines.map((x) =>
                      x.key === l.key ? { ...x, batch: e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                aria-label="Expiry"
                title="Expiry date"
                type="date"
                value={l.expiry}
                onChange={(e) =>
                  setLines(
                    lines.map((x) =>
                      x.key === l.key ? { ...x, expiry: e.target.value } : x,
                    ),
                  )
                }
              />
              <strong>
                {money(l.quantity * l.units * l.cost - l.discount)}
              </strong>
              <button
                type="button"
                aria-label={`Remove line ${index + 1}`}
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((x) => x.key !== l.key))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="form-grid">
          <Field label="Purchase discount">
            <input
              name="discount_amount"
              type="number"
              min="0"
              defaultValue="0"
            />
          </Field>
          <Field label="Tax">
            <input name="tax_amount" type="number" min="0" defaultValue="0" />
          </Field>
          <Field label="Shipping / transport">
            <input
              name="shipping_amount"
              type="number"
              min="0"
              defaultValue="0"
            />
          </Field>
          <Field label="Additional costs">
            <input
              name="additional_costs"
              type="number"
              min="0"
              defaultValue="0"
            />
          </Field>
          <Field label="Amount paid">
            <input name="amount_paid" type="number" min="0" defaultValue="0" />
          </Field>
          <Field label="Notes">
            <input name="notes" />
          </Field>
        </div>
        <div className="purchase-total">
          <span>Items subtotal</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <input
          type="hidden"
          name="organization_id"
          value={membership.organization_id}
        />
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy || lines.some((l) => !l.product_id)}
          >
            {busy ? "Receiving…" : "Save purchase & receive stock"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProformaForm({
  membership,
  customers,
  products,
  busy,
  error,
  onClose,
  onSave,
}: {
  membership: Membership;
  customers: AqanData["customers"];
  products: OperationalProduct[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (input: {
    organizationId: string;
    customerId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    validUntil: string;
    notes?: string;
  }) => void;
}) {
  const [productId, setProductId] = useState("");
  const [validUntil] = useState(() =>
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  );
  const product = products.find((p) => p.id === productId);
  return (
    <Modal
      title="New proforma invoice"
      subtitle="Prepare a pre-payment commercial document, then convert it to a final invoice without retyping."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            organizationId: membership.organization_id,
            customerId: text(f, "customer_id"),
            productId: text(f, "product_id"),
            quantity: number(f, "quantity"),
            unitPrice: number(f, "unit_price"),
            validUntil: text(f, "valid_until"),
            notes: text(f, "notes"),
          });
        }}
      >
        <div className="form-grid">
          <Field label="Customer" className="span-two">
            <select name="customer_id" required defaultValue="">
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product / service" className="span-two">
            <select
              name="product_id"
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {money(p.price)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity">
            <input
              name="quantity"
              type="number"
              min="1"
              defaultValue="1"
              required
            />
          </Field>
          <Field label="Unit price">
            <input
              name="unit_price"
              type="number"
              min="0"
              defaultValue={product?.price || 0}
              required
            />
          </Field>
          <Field label="Valid until">
            <input
              name="valid_until"
              type="date"
              defaultValue={validUntil}
              required
            />
          </Field>
          <Field label="Notes">
            <input name="notes" placeholder="Payment or delivery notes" />
          </Field>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || !productId}>
            {busy ? "Saving…" : "Create proforma"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AdjustmentForm({
  products,
  batches,
  busy,
  error,
  onClose,
  onSave,
}: {
  products: OperationalProduct[];
  batches: OperationsData["batches"];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (
    p: string,
    b: string | null,
    q: number,
    r: string,
    n: string,
  ) => void;
}) {
  const [product, setProduct] = useState("");
  return (
    <Modal
      title="Adjust stock"
      subtitle="AQAN never silently overwrites stock. Every adjustment creates an auditable movement."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave(
            text(f, "product_id"),
            text(f, "batch_id") || null,
            number(f, "quantity"),
            text(f, "reason"),
            text(f, "notes"),
          );
        }}
      >
        <div className="form-grid">
          <Field label="Product" className="span-two">
            <select
              name="product_id"
              required
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              <option value="">Choose product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.stock} in stock
                </option>
              ))}
            </select>
          </Field>
          <Field label="Batch (optional)">
            <select name="batch_id">
              <option value="">No specific batch</option>
              {batches
                .filter((b) => b.product_id === product)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number || "Unnumbered"} · {b.quantity_on_hand} ·
                    exp {date(b.expiry_date)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Quantity change (+ or -)">
            <input
              name="quantity"
              type="number"
              step="1"
              required
              placeholder="e.g. -2 or 10"
            />
          </Field>
          <Field label="Reason">
            <select name="reason">
              <option value="stocktake">Stocktake/count correction</option>
              <option value="damaged">Damaged</option>
              <option value="expired">Expired</option>
              <option value="lost">Lost</option>
              <option value="internal_use">Internal use</option>
              <option value="found_stock">Found stock</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Notes" className="span-two">
            <textarea name="notes" rows={3} />
          </Field>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Post adjustment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ExpenseForm({
  membership,
  suppliers,
  categories,
  busy,
  error,
  onClose,
  onSave,
}: {
  membership: Membership;
  suppliers: AqanData["suppliers"];
  categories: Category[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (i: Record<string, unknown>) => void;
}) {
  return (
    <Modal
      title="Add expense"
      subtitle="Posted expenses feed the profit and loss report immediately."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            organization_id: membership.organization_id,
            expense_date: text(f, "expense_date"),
            category_name: text(f, "category_name"),
            description: text(f, "description"),
            amount: number(f, "amount"),
            tax_amount: number(f, "tax_amount"),
            payment_method: text(f, "payment_method"),
            supplier_id: text(f, "supplier_id") || null,
            notes: text(f, "notes"),
            status: "posted",
          });
        }}
      >
        <div className="form-grid">
          <Field label="Date">
            <input
              name="expense_date"
              type="date"
              defaultValue={today()}
              required
            />
          </Field>
          <Field label="Category">
            <input name="category_name" list="expense-category-list" defaultValue="Other" required />
            <datalist id="expense-category-list">
              {["Rent", "Utilities", "Salaries", "Transport", "Internet", "Repairs", "Marketing", "Other", ...categories.filter((category) => category.entity_type === "expense").map((category) => category.name)].filter((name, index, all) => all.indexOf(name) === index).map((name) => <option key={name} value={name} />)}
            </datalist>
          </Field>
          <Field label="Description" className="span-two">
            <input name="description" required />
          </Field>
          <Field label="Amount">
            <input name="amount" type="number" min="1" required />
          </Field>
          <Field label="Tax">
            <input name="tax_amount" type="number" min="0" defaultValue="0" />
          </Field>
          <Field label="Payment method">
            <select name="payment_method">
              <option>cash</option>
              <option>mobile_money</option>
              <option>card</option>
              <option>bank_transfer</option>
              <option>other</option>
            </select>
          </Field>
          <Field label="Vendor / supplier (optional)">
            <select name="supplier_id">
              <option value="">None</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes" className="span-two">
            <textarea name="notes" rows={3} />
          </Field>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Record expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CustomerPaymentForm({
  customers,
  sales,
  busy,
  error,
  onClose,
  onSave,
}: {
  customers: AqanData["customers"];
  sales: OperationsData["sales"];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (i: {
    customerId: string;
    amount: number;
    method: string;
    reference?: string;
    notes?: string;
    saleIds?: string[];
  }) => void;
}) {
  const [customer, setCustomer] = useState("");
  return (
    <Modal
      title="Record customer payment"
      subtitle="Allocate to a selected invoice or automatically to the oldest outstanding invoice first."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            customerId: text(f, "customer_id"),
            amount: number(f, "amount"),
            method: text(f, "method"),
            reference: text(f, "reference"),
            notes: text(f, "notes"),
            saleIds: text(f, "sale_id") ? [text(f, "sale_id")] : undefined,
          });
        }}
      >
        <div className="form-grid">
          <Field label="Customer" className="span-two">
            <select
              name="customer_id"
              required
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Allocate to">
            <select name="sale_id">
              <option value="">Oldest invoices first</option>
              {sales
                .filter((s) => s.customer_id === customer && s.balance_due > 0)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.invoice_number} · {money(s.balance_due)} due
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Amount">
            <input name="amount" type="number" min="1" required />
          </Field>
          <Field label="Payment method">
            <select name="method">
              <option>cash</option>
              <option>mobile_money</option>
              <option>card</option>
              <option>bank_transfer</option>
              <option>other</option>
            </select>
          </Field>
          <Field label="Reference">
            <input name="reference" />
          </Field>
          <Field label="Notes" className="span-two">
            <textarea name="notes" rows={3} />
          </Field>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Allocating…" : "Record payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function SupplierPaymentForm({
  suppliers,
  purchases,
  initialSupplierId,
  busy,
  error,
  onClose,
  onSave,
}: {
  suppliers: AqanData["suppliers"];
  purchases: OperationsData["purchases"];
  initialSupplierId?: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (i: {
    supplierId: string;
    amount: number;
    method: string;
    reference?: string;
    notes?: string;
    purchaseId?: string;
  }) => void;
}) {
  const [supplier, setSupplier] = useState(initialSupplierId || "");
  return (
    <Modal
      title="Record supplier payment"
      subtitle="Settle a purchase invoice or allocate to the oldest supplier balance first."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            supplierId: text(f, "supplier_id"),
            amount: number(f, "amount"),
            method: text(f, "method"),
            reference: text(f, "reference"),
            notes: text(f, "notes"),
            purchaseId: text(f, "purchase_id") || undefined,
          });
        }}
      >
        <div className="form-grid">
          <Field label="Supplier" className="span-two">
            <select
              name="supplier_id"
              required
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            >
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Purchase invoice">
            <select name="purchase_id">
              <option value="">Oldest balances first</option>
              {purchases
                .filter((p) => p.supplier_id === supplier && p.balance_due > 0)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.purchase_number} · {money(p.balance_due)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Amount">
            <input name="amount" type="number" min="1" required />
          </Field>
          <Field label="Method">
            <select name="method">
              <option>cash</option>
              <option>mobile_money</option>
              <option>bank_transfer</option>
              <option>card</option>
              <option>other</option>
            </select>
          </Field>
          <Field label="Reference">
            <input name="reference" />
          </Field>
          <Field label="Notes" className="span-two">
            <textarea name="notes" rows={3} />
          </Field>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Record supplier payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReturnForm({
  sales,
  items,
  busy,
  error,
  onClose,
  onSave,
}: {
  sales: OperationsData["sales"];
  items: OperationsData["saleItems"];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (i: {
    saleId: string;
    action: string;
    items: Array<Record<string, unknown>>;
    refundMethod?: string;
    notes?: string;
  }) => void;
}) {
  const [sale, setSale] = useState(""),
    [item, setItem] = useState("");
  const chosen = items.find((i) => i.id === item);
  return (
    <Modal
      title="Return items / credit note"
      subtitle="Returns stay linked to the original invoice and update inventory according to the selected outcome."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            saleId: text(f, "sale_id"),
            action: text(f, "action"),
            refundMethod: text(f, "refund_method"),
            notes: text(f, "notes"),
            items: [
              {
                sale_item_id: text(f, "sale_item_id"),
                quantity: number(f, "quantity"),
                reason: text(f, "reason"),
                inventory_action: text(f, "inventory_action"),
              },
            ],
          });
        }}
      >
        <div className="form-grid">
          <Field label="Original invoice" className="span-two">
            <select
              name="sale_id"
              required
              value={sale}
              onChange={(e) => {
                setSale(e.target.value);
                setItem("");
              }}
            >
              <option value="">Select invoice</option>
              {sales
                .filter((s) => s.status !== "void")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.invoice_number} · {s.customer?.name || "Walk-in"} ·{" "}
                    {money(s.total)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Item" className="span-two">
            <select
              name="sale_item_id"
              required
              value={item}
              onChange={(e) => setItem(e.target.value)}
            >
              <option value="">Select item</option>
              {items
                .filter(
                  (i) => i.sale_id === sale && i.returned_quantity < i.quantity,
                )
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.product_name} · {i.quantity - i.returned_quantity}{" "}
                    returnable
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Quantity">
            <input
              name="quantity"
              type="number"
              min="1"
              max={chosen ? chosen.quantity - chosen.returned_quantity : 1}
              required
            />
          </Field>
          <Field label="Reason">
            <select name="reason">
              <option value="customer_return">Customer return</option>
              <option value="damaged">Damaged</option>
              <option value="expired">Expired</option>
              <option value="wrong_item">Wrong item</option>
              <option value="defect">Defect</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Resolution">
            <select name="action">
              <option value="refund">Refund</option>
              <option value="customer_credit">Customer credit</option>
              <option value="replace">Replace</option>
              <option value="no_refund">No refund</option>
            </select>
          </Field>
          <Field label="Inventory outcome">
            <select name="inventory_action">
              <option value="sellable">Return to sellable stock</option>
              <option value="damaged_writeoff">Damaged / write off</option>
              <option value="expired_writeoff">Expired / write off</option>
              <option value="none">No stock return</option>
            </select>
          </Field>
          <Field label="Refund method">
            <select name="refund_method">
              <option>cash</option>
              <option>mobile_money</option>
              <option>bank_transfer</option>
              <option>customer_credit</option>
            </select>
          </Field>
          <Field label="Notes">
            <input name="notes" />
          </Field>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || !item}>
            {busy ? "Processing…" : "Process return"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CustomerForm({
  membership,
  categories,
  busy,
  error,
  onClose,
  onSave,
}: {
  membership: Membership;
  categories: Category[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (i: Record<string, unknown>) => void;
}) {
  return (
    <Modal
      title="New customer"
      subtitle="Only a name is required. Tax, address and credit details can be completed when relevant."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            organization_id: membership.organization_id,
            name: text(f, "name"),
            customer_type: text(f, "customer_type"),
            contact_name: text(f, "contact_name") || null,
            phone: text(f, "phone") || null,
            whatsapp: text(f, "whatsapp") || null,
            email: text(f, "email") || null,
            tax_number: text(f, "tax_number") || null,
            billing_address: text(f, "billing_address") || null,
            delivery_address: text(f, "delivery_address") || null,
            city: text(f, "city") || "Dar es Salaam",
            region: text(f, "region") || null,
            country: text(f, "country") || "Tanzania",
            customer_category: text(f, "category") || null,
            payment_terms: text(f, "payment_terms") || null,
            credit_limit: number(f, "credit_limit"),
          });
        }}
      >
        <div className="form-grid">
          <Field label="Customer / company name" className="span-two">
            <input name="name" required />
          </Field>
          <Field label="Customer type">
            <select name="customer_type">
              <option>Walk-in</option>
              <option>Hospital</option>
              <option>Clinic</option>
              <option>Diagnostic centre</option>
              <option>Pharmacy</option>
              <option>NGO</option>
              <option>Distributor</option>
            </select>
          </Field>
          <Field label="Contact person">
            <input name="contact_name" />
          </Field>
          <Field label="Phone">
            <input name="phone" type="tel" />
          </Field>
          <Field label="WhatsApp">
            <input name="whatsapp" type="tel" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" />
          </Field>
          <Field label="TIN / tax number">
            <input name="tax_number" />
          </Field>
          <Field label="Billing address">
            <input name="billing_address" />
          </Field>
          <Field label="Delivery address">
            <input name="delivery_address" />
          </Field>
          <Field label="City">
            <input name="city" defaultValue="Dar es Salaam" />
          </Field>
          <Field label="Region">
            <input name="region" />
          </Field>
          <Field label="Country">
            <input name="country" defaultValue="Tanzania" />
          </Field>
          <Field label="Category">
            <input
              name="category"
              list="customer-category-list"
              placeholder="Retail / corporate / hospital"
            />
            <datalist id="customer-category-list">
              {categories.filter((category) => category.entity_type === "customer").map((category) => <option key={category.id} value={category.name} />)}
            </datalist>
          </Field>
          <Field label="Payment terms">
            <input name="payment_terms" placeholder="30 days" />
          </Field>
          <Field label="Credit limit">
            <input name="credit_limit" type="number" min="0" defaultValue="0" />
          </Field>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Create customer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
