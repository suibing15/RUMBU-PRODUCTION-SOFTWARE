// ============================================================
// SHARED AUTH HELPER — include this on every page that needs
// to know who is logged in (index.html and, later, modules).
// Requires the Supabase JS library to be loaded first:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// ============================================================

const SUPABASE_URL = "https://betfhunzmhtdzgvufmfk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AfDp1FlHghu9TOfqEUj20Q_Pke7GlTp";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Redirects to login.html if not signed in. Otherwise resolves with the
// full profile: { id, username, role, super_admin_type, section_id,
// section_name, department_ids, department_names }
// Throws a descriptive Error on any failure — callers should wrap this in
// try/catch and show err.message somewhere visible, rather than letting
// it fail silently.
async function requireAuth(loginPath) {
  loginPath = loginPath || "login.html";

  let session;
  try {
    const sessRes = await sb.auth.getSession();
    session = sessRes.data.session;
  } catch (e) {
    throw new Error("Could not reach Supabase Auth: " + e.message);
  }

  if (!session) {
    window.location.href = loginPath;
    return null;
  }

  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("id, username, role, super_admin_type, section_id, can_self_manage_todos")
    .eq("id", session.user.id)
    .single();

  if (profErr || !profile) {
    throw new Error("Could not load profile: " + (profErr ? profErr.message : "no profile row for this account"));
  }

  let sectionIds = [];
  let sectionNames = [];
  const { data: ps, error: psErr } = await sb.from("profile_sections").select("section_id, app_sections(name)").eq("profile_id", profile.id);
  if (psErr) throw new Error("Could not load Section assignments: " + psErr.message);
  sectionIds = (ps || []).map(r => r.section_id);
  sectionNames = (ps || []).map(r => r.app_sections ? r.app_sections.name : null).filter(Boolean);

  let departmentIds = [];
  let departmentNames = [];
  if (profile.role === "user") {
    const { data: ud, error: udErr } = await sb.from("user_departments").select("department_id").eq("profile_id", profile.id);
    if (udErr) throw new Error("Could not load department assignments: " + udErr.message);
    departmentIds = (ud || []).map(r => r.department_id);
    if (departmentIds.length) {
      const { data: depts, error: deptErr } = await sb.from("app_departments").select("id,name").in("id", departmentIds);
      if (deptErr) throw new Error("Could not load departments: " + deptErr.message);
      departmentNames = (depts || []).map(d => d.name);
    }
  }

  return {
    id: profile.id,
    username: profile.username,
    role: profile.role,
    superAdminType: profile.super_admin_type,
    sectionId: sectionIds.length ? sectionIds[0] : null,
    sectionName: sectionNames.length ? sectionNames.join(", ") : null,
    sectionIds: sectionIds,
    sectionNames: sectionNames,
    departmentIds: departmentIds,
    departmentNames: departmentNames,
    canSelfManageTodos: !!profile.can_self_manage_todos
  };
}

async function logout(loginPath) {
  await sb.auth.signOut();
  window.location.href = loginPath || "login.html";
}
