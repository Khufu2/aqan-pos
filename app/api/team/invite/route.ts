import { createClient } from "@supabase/supabase-js";

const allowedRoles = new Set(["admin", "manager", "cashier", "sales", "salesperson", "inventory", "service", "accountant", "viewer"]);

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!url || !serviceRole) {
    return response({ error: "Staff invitations are not configured. Add SUPABASE_SERVICE_ROLE_KEY to Vercel, then redeploy." }, 503);
  }
  if (!bearer) return response({ error: "Sign in again before inviting staff." }, 401);

  let payload: { email?: unknown; fullName?: unknown; role?: unknown };
  try { payload = await request.json(); } catch { return response({ error: "Invalid invitation request." }, 400); }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
  const role = typeof payload.role === "string" ? payload.role : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || !fullName || fullName.length > 120 || !allowedRoles.has(role)) {
    return response({ error: "Provide a valid work email, staff name and permission." }, 400);
  }

  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(bearer);
  if (authError || !authData.user) return response({ error: "Your session has expired. Please sign in again." }, 401);

  const { data: inviter, error: membershipError } = await admin
    .from("aqan_memberships")
    .select("organization_id,role")
    .eq("user_id", authData.user.id)
    .in("role", ["owner", "admin"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError || !inviter) return response({ error: "Only AQAN owners and administrators can invite staff." }, 403);
  if (inviter.role === "admin" && (role === "admin" || role === "manager")) {
    return response({ error: "Only the workspace owner can invite an administrator or manager." }, 403);
  }

  const redirectTo = new URL("/", request.url);
  redirectTo.searchParams.set("setup", "staff");
  const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectTo.toString(),
    data: { full_name: fullName },
  });
  if (inviteError || !invitation.user) {
    const message = inviteError?.message || "The invitation could not be sent.";
    return response({ error: /already.*registered|already.*exists/i.test(message) ? "This email already has a Supabase account. Ask the owner to add its existing user profile, or use a new work email." : message }, 400);
  }

  const userId = invitation.user.id;
  const { error: profileError } = await admin.from("aqan_profiles").upsert({ id: userId, full_name: fullName });
  if (profileError) return response({ error: "Invite email was sent, but the staff profile could not be prepared. Contact AQAN support before the user signs in." }, 500);
  const { error: roleError } = await admin.from("aqan_memberships").upsert({ organization_id: inviter.organization_id, user_id: userId, role });
  if (roleError) return response({ error: "Invite email was sent, but the AQAN permission could not be assigned. Contact AQAN support before the user signs in." }, 500);

  return response({ ok: true, email, role });
}
