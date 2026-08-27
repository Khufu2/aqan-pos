import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type Lead = {
  facility_name: string;
  lead_score: number;
  lead_status: string;
  region: string | null;
  specialty: string | null;
  equipment_summary: string | null;
  next_action_at: string | null;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const apiUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!apiUrl || !serviceKey) return json({ error: "AQAN AI is not configured on the server." }, 503);
    if (!geminiKey) return json({ error: "AQAN AI needs GEMINI_API_KEY in Supabase Edge Function secrets." }, 503);
    if (!token) return json({ error: "Sign in to use AQAN AI." }, 401);

    const body = await request.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 2400) return json({ error: "Ask a clear question of up to 2,400 characters." }, 400);

    const database = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await database.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Your AQAN session has expired. Sign in again." }, 401);

    const { data: membership, error: membershipError } = await database
      .from("aqan_memberships")
      .select("organization_id, role")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (membershipError || !membership) return json({ error: "You do not have access to an AQAN workspace." }, 403);

    const orgId = membership.organization_id;
    const [productsResult, customersResult, salesResult, quotesResult, leadsResult, servicesResult] = await Promise.all([
      database.from("aqan_products").select("name,sku,category,price,stock,reorder_level,serial_tracked").eq("organization_id", orgId).eq("active", true).order("stock", { ascending: true }).limit(250),
      database.from("aqan_customers").select("name,customer_type,city,total_spend,last_purchase_at,status").eq("organization_id", orgId).order("total_spend", { ascending: false }).limit(100),
      database.from("aqan_sales").select("invoice_number,total,status,sold_at").eq("organization_id", orgId).order("sold_at", { ascending: false }).limit(100),
      database.from("aqan_quotations").select("quote_number,total,status,valid_until,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
      database.from("aqan_crm_leads").select("facility_name,lead_score,lead_status,region,specialty,equipment_summary,next_action_at").eq("organization_id", orgId).order("lead_score", { ascending: false }).limit(120),
      database.from("aqan_service_requests").select("equipment_name,priority,status,scheduled_for").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    ]);
    for (const result of [productsResult, customersResult, salesResult, quotesResult, leadsResult, servicesResult]) {
      if (result.error) throw new Error("Could not read the secured AQAN workspace data.");
    }

    const products = productsResult.data ?? [];
    const sales = salesResult.data ?? [];
    const context = {
      organisation: "AQAN Biomedical",
      userRole: membership.role,
      productCount: products.length,
      lowStock: products.filter((item) => Number(item.stock) <= Number(item.reorder_level)),
      products,
      customers: customersResult.data ?? [],
      recentSales: sales,
      salesValue: sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
      quotations: quotesResult.data ?? [],
      facilities: leadsResult.data ?? [],
      serviceRequests: servicesResult.data ?? [],
    };

    const prompt = `Question: ${question}\n\nSecure AQAN workspace data (use only this data; do not invent records):\n${JSON.stringify(context)}`;
    const systemInstruction = "You are AQAN BIOMEDICAL POS Intelligence, a concise commercial operations analyst for a Tanzanian biomedical equipment supplier. Give decisive, practical answers from the supplied workspace data. For facility leads, rank relevant accounts and offer a tailored outreach sequence. For stock, identify exact products and operational next steps. Never claim that a payment, email, WhatsApp message, TRA fiscal receipt, delivery, or medical procedure was completed unless the data says so. Do not provide clinical diagnosis or patient-treatment advice. Use short headings and bullets where helpful; mention uncertainty plainly.";
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.7-flash";
    const gemini = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: prompt, system_instruction: systemInstruction, generation_config: { thinking_level: "low", temperature: 0.35 } }),
    });
    const payload = await gemini.json().catch(() => ({}));
    if (!gemini.ok) {
      console.error("[aqan-ai] Gemini request failed", { status: gemini.status, model });
      return json({ error: "Gemini could not complete this request. Check the configured key, model access and quota." }, 502);
    }
    const answer = typeof payload.output_text === "string" ? payload.output_text.trim() : "";
    if (!answer) return json({ error: "Gemini returned no usable answer. Please try again." }, 502);

    const leads = (leadsResult.data ?? []) as Lead[];
    return json({
      answer,
      model,
      leads: leads.slice(0, 5).map((lead) => ({
        facility_name: lead.facility_name,
        lead_score: lead.lead_score,
        lead_status: lead.lead_status,
        suggested_action: lead.next_action_at ? `Follow up by ${new Date(lead.next_action_at).toLocaleDateString("en-TZ")}.` : "Plan a discovery contact and log the outcome.",
      })),
    });
  } catch (error) {
    console.error("[aqan-ai] unexpected failure", error);
    return json({ error: "AQAN AI could not analyse the workspace right now. Please try again." }, 500);
  }
});
