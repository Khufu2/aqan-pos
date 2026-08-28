import { supabase } from "./supabase";

function client() {
  if (!supabase) throw new Error("Supabase is not configured for this deployment.");
  return supabase;
}

export type OperationalProduct = {
  id: string; name: string; sku: string; barcode: string | null; category: string; description: string | null;
  product_type: "product" | "service"; unit_of_measure: string; purchase_unit: string | null; units_per_purchase: number;
  price: number; wholesale_price: number | null; distributor_price: number | null; custom_price: number | null; minimum_selling_price: number | null;
  cost: number; average_cost: number; stock: number; reorder_level: number; reorder_quantity: number | null;
  tax_code: string; tax_rate: number; tax_inclusive: boolean; discount_eligible: boolean; track_inventory: boolean;
  allow_negative_stock: boolean; serial_tracked: boolean; active: boolean; image_path: string | null; preferred_supplier_id: string | null;
};
export type StockBatch = { id: string; product_id: string; supplier_id: string | null; warehouse_id: string | null; batch_number: string | null; received_quantity: number; quantity_on_hand: number; cost_per_unit: number; manufacturing_date: string | null; received_date: string; expiry_date: string | null; status: string; supplier?: { name: string } | null; product?: { name: string; sku: string } | null };
export type StockMovement = { id: string; product_id: string; batch_id: string | null; movement_type: string; quantity_change: number; unit_cost: number | null; reference_number: string | null; notes: string | null; created_at: string; product?: { name: string; sku: string } | null };
export type Purchase = { id: string; purchase_number: string; supplier_id: string | null; supplier_invoice_number: string | null; purchase_date: string; due_date: string | null; status: string; payment_status: string; total: number; amount_paid: number; balance_due: number; notes: string | null; supplier?: { name: string } | null };
export type Expense = { id: string; expense_number: string; expense_date: string; category_name: string; description: string; amount: number; tax_amount: number; payment_method: string; status: string; supplier?: { name: string } | null };
export type CustomerPayment = { id: string; customer_id: string; amount: number; method: string; reference: string | null; received_at: string; customer?: { name: string } | null };
export type ReturnRecord = { id: string; return_number: string; sale_id: string; action: string; total: number; status: string; created_at: string };
export type TaxRate = { id: string; name: string; code: string; rate: number; active: boolean; is_default: boolean };
export type SaleItem = { id: string; sale_id: string; product_id: string; product_name: string; sku: string; quantity: number; unit_price: number; cost_price: number; returned_quantity: number; line_total: number };
export type Proforma = { id: string; proforma_number: string; customer_id: string; status: string; issue_date: string; valid_until: string; total: number; customer?: { name: string } | null };
export type FullSale = { id: string; invoice_number: string; customer_id: string | null; subtotal: number; discount_amount: number; shipping_amount: number; vat_amount: number; total: number; amount_paid: number; balance_due: number; status: string; due_date: string | null; sold_at: string; customer?: { name: string; phone: string | null; email: string | null } | null };

export type OperationsData = {
  products: OperationalProduct[]; batches: StockBatch[]; movements: StockMovement[]; purchases: Purchase[]; expenses: Expense[];
  customerPayments: CustomerPayment[]; returns: ReturnRecord[]; taxRates: TaxRate[]; saleItems: SaleItem[]; sales: FullSale[]; proformas: Proforma[];
};

export const emptyOperationsData: OperationsData = { products: [], batches: [], movements: [], purchases: [], expenses: [], customerPayments: [], returns: [], taxRates: [], saleItems: [], sales: [], proformas: [] };

async function rows<T>(promise: PromiseLike<{ data: unknown; error: { message: string } | null }>, label: string): Promise<T[]> {
  const result = await promise;
  if (result.error) {
    if (/does not exist|schema cache|column .* not found/i.test(result.error.message)) return [];
    throw new Error(`${label}: ${result.error.message}`);
  }
  return (result.data ?? []) as T[];
}

export async function loadOperationsData(): Promise<OperationsData> {
  const db = client();
  const [products,batches,movements,purchases,expenses,customerPayments,returns,taxRates,saleItems,sales,proformas] = await Promise.all([
    rows<OperationalProduct>(db.from("aqan_products").select("id,name,sku,barcode,category,description,product_type,unit_of_measure,purchase_unit,units_per_purchase,price,wholesale_price,distributor_price,custom_price,minimum_selling_price,cost,average_cost,stock,reorder_level,reorder_quantity,tax_code,tax_rate,tax_inclusive,discount_eligible,track_inventory,allow_negative_stock,serial_tracked,active,image_path,preferred_supplier_id").order("name"),"Products"),
    rows<StockBatch>(db.from("aqan_stock_batches").select("id,product_id,supplier_id,warehouse_id,batch_number,received_quantity,quantity_on_hand,cost_per_unit,manufacturing_date,received_date,expiry_date,status,supplier:aqan_suppliers(name),product:aqan_products(name,sku)").gt("quantity_on_hand",0).order("expiry_date"),"Batches"),
    rows<StockMovement>(db.from("aqan_stock_movements").select("id,product_id,batch_id,movement_type,quantity_change,unit_cost,reference_number,notes,created_at,product:aqan_products(name,sku)").order("created_at",{ascending:false}).limit(500),"Stock movements"),
    rows<Purchase>(db.from("aqan_goods_receipts").select("id,purchase_number,supplier_id,supplier_invoice_number,purchase_date,due_date,status,payment_status,total,amount_paid,balance_due,notes,supplier:aqan_suppliers(name)").order("purchase_date",{ascending:false}).limit(200),"Purchases"),
    rows<Expense>(db.from("aqan_expenses").select("id,expense_number,expense_date,category_name,description,amount,tax_amount,payment_method,status,supplier:aqan_suppliers(name)").order("expense_date",{ascending:false}).limit(300),"Expenses"),
    rows<CustomerPayment>(db.from("aqan_customer_payments").select("id,customer_id,amount,method,reference,received_at,customer:aqan_customers(name)").order("received_at",{ascending:false}).limit(300),"Customer payments"),
    rows<ReturnRecord>(db.from("aqan_returns").select("id,return_number,sale_id,action,total,status,created_at").order("created_at",{ascending:false}).limit(200),"Returns"),
    rows<TaxRate>(db.from("aqan_tax_rates").select("id,name,code,rate,active,is_default").order("rate"),"Tax rates"),
    rows<SaleItem>(db.from("aqan_sale_items").select("id,sale_id,product_id,product_name,sku,quantity,unit_price,cost_price,returned_quantity,line_total").limit(1000),"Sale items"),
    rows<FullSale>(db.from("aqan_sales").select("id,invoice_number,customer_id,subtotal,discount_amount,shipping_amount,vat_amount,total,amount_paid,balance_due,status,due_date,sold_at,customer:aqan_customers(name,phone,email)").order("sold_at",{ascending:false}).limit(300),"Invoices"),
    rows<Proforma>(db.from("aqan_proformas").select("id,proforma_number,customer_id,status,issue_date,valid_until,total,customer:aqan_customers(name)").order("created_at",{ascending:false}).limit(100),"Proformas"),
  ]);
  return { products,batches,movements,purchases,expenses,customerPayments,returns,taxRates,saleItems,sales,proformas };
}

export async function createOperationalProduct(product: Record<string, unknown>, purchase?: Record<string, unknown> | null) {
  const { data,error } = await client().rpc("aqan_create_product_with_opening_stock",{p_product:product,p_purchase:purchase ?? null});
  if (error) throw error; return data as string;
}
export async function receivePurchase(header: Record<string, unknown>, items: Array<Record<string, unknown>>) {
  const { data,error } = await client().rpc("aqan_receive_purchase",{p_header:header,p_items:items}); if(error) throw error; return data as string;
}
export async function adjustInventory(productId: string,batchId: string|null,quantityChange: number,reason: string,notes?: string) {
  const {data,error}=await client().rpc("aqan_adjust_stock",{p_product_id:productId,p_batch_id:batchId,p_quantity_change:quantityChange,p_reason:reason,p_notes:notes||null}); if(error) throw error; return data as string;
}
export async function recordCustomerPayment(input:{customerId:string;amount:number;method:string;reference?:string;notes?:string;saleIds?:string[]}) {
  const {data,error}=await client().rpc("aqan_record_customer_payment",{p_customer_id:input.customerId,p_amount:input.amount,p_method:input.method,p_reference:input.reference||null,p_notes:input.notes||null,p_sale_ids:input.saleIds?.length?input.saleIds:null}); if(error) throw error; return data as string;
}
export async function recordSupplierPayment(input:{supplierId:string;amount:number;method:string;reference?:string;notes?:string;purchaseId?:string}) {
  const {data,error}=await client().rpc("aqan_record_supplier_payment",{p_supplier_id:input.supplierId,p_amount:input.amount,p_method:input.method,p_reference:input.reference||null,p_notes:input.notes||null,p_purchase_id:input.purchaseId||null}); if(error) throw error; return data as string;
}
export async function convertQuotation(quotationId:string) { const {data,error}=await client().rpc("aqan_convert_quotation_to_invoice",{p_quotation_id:quotationId,p_payments:[]}); if(error) throw error; return data; }
export async function convertProforma(proformaId:string) { const {data,error}=await client().rpc("aqan_convert_proforma_to_invoice",{p_proforma_id:proformaId,p_payments:[]}); if(error) throw error; return data; }
export async function createProforma(input:{organizationId:string;customerId:string;productId:string;quantity:number;unitPrice:number;validUntil:string;notes?:string}) {
  const db=client();
  const {data:proforma,error}=await db.from("aqan_proformas").insert({organization_id:input.organizationId,customer_id:input.customerId,valid_until:input.validUntil,notes:input.notes||null,status:"draft",subtotal:input.quantity*input.unitPrice,total:input.quantity*input.unitPrice}).select("id,proforma_number").single();
  if(error||!proforma) throw error||new Error("Proforma could not be created.");
  const {data:product,error:productError}=await db.from("aqan_products").select("name,unit_of_measure,tax_rate").eq("id",input.productId).single(); if(productError||!product) throw productError||new Error("Product could not be loaded.");
  const lineTotal=input.quantity*input.unitPrice;
  const {error:itemError}=await db.from("aqan_proforma_items").insert({organization_id:input.organizationId,proforma_id:proforma.id,product_id:input.productId,description:product.name,quantity:input.quantity,unit:product.unit_of_measure||"piece",unit_price:input.unitPrice,tax_rate:product.tax_rate||0,tax_amount:0,line_total:lineTotal});
  if(itemError) throw itemError; return proforma as {id:string;proforma_number:string};
}
export async function processReturn(input:{saleId:string;action:string;items:Array<Record<string,unknown>>;refundMethod?:string;notes?:string}) { const {data,error}=await client().rpc("aqan_process_return",{p_sale_id:input.saleId,p_action:input.action,p_items:input.items,p_refund_method:input.refundMethod||null,p_notes:input.notes||null}); if(error) throw error; return data as string; }
export async function addExpense(input:Record<string,unknown>) { const {data:{user}}=await client().auth.getUser(); const {data:errorData,error}=await client().from("aqan_expenses").insert({...input,created_by:user?.id}).select("id").single(); if(error) throw error; return errorData.id as string; }
export async function addSupplier(input:Record<string,unknown>) { const {data,error}=await client().from("aqan_suppliers").insert(input).select("id").single(); if(error) throw error; return data.id as string; }
export async function addCustomer(input:Record<string,unknown>) { const {data,error}=await client().from("aqan_customers").insert(input).select("id").single(); if(error) throw error; return data.id as string; }

export async function completeOperationalSale(input:{customerId:string|null;items:Array<Record<string,unknown>>;payments:Array<Record<string,unknown>>;discount:number;shipping:number;dueDate?:string;notes?:string;salesperson?:string}) {
  const {data,error}=await client().rpc("aqan_complete_sale_v2",{p_customer_id:input.customerId,p_items:input.items,p_payments:input.payments,p_discount:input.discount,p_shipping:input.shipping,p_due_date:input.dueDate||null,p_notes:input.notes||null,p_salesperson:input.salesperson||null}); if(error) throw error; return data as {sale_id:string;invoice_number:string;total:number;amount_paid:number;balance_due:number};
}
