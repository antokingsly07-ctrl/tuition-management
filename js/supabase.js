/* ============================================================================
   SUPABASE CONFIGURATION - THE ONLY PLACE YOU EDIT THINGS
   ============================================================================
   The Supabase JS library (js/supabase-js.min.js) is loaded LOCALLY before
   this file in app.html / index.html - no external CDN is used.

   HOW TO POINT AT YOUR OWN PROJECT:
   1. Create a free project at https://supabase.com
   2. Open the SQL Editor and run the file  supabase/schema.sql
   3. Go to Dashboard -> Settings -> API
   4. Copy the "Project URL"   into SUPABASE_URL  below
   5. Copy the "anon" / "public" key (NOT the service_role key)
      into SUPABASE_KEY below

   IMPORTANT:
   - Use the PUBLIC (anon) key ONLY. Never use the service_role key here.
   - The anon key is public by design and is safe to commit for a small
     internal tool, because Row Level Security (RLS) controls access.
   ============================================================================ */

const SUPABASE_URL = "https://znxtqxhecnmpxylqiqyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_A8ui08QptY1z3J-YW19pHw_ZjY1nEKW";

/* Diagnostic info so the UI badge (and you) can see exactly WHY the app is
   or isn't connected. Inspect window.SUPABASE_DIAG in the browser console. */
window.SUPABASE_DIAG = {
  build: "v12",
  libGlobalType: typeof window.supabase,
  createClientType: typeof (window.supabase && window.supabase.createClient),
  error: null
};

/* Build the shared Supabase client. Never throws - on any problem the app
   safely falls back to demo mode and the reason is recorded above. */
let supabase = null;
try {
  if (window.supabase && typeof window.supabase.createClient === "function") {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (err) {
  window.SUPABASE_DIAG.error = String(err && err.message ? err.message : err);
  supabase = null;
}

const supabaseConfigured = Boolean(supabase);
window.SUPABASE_CONFIGURED = supabaseConfigured;
window.SUPABASE_DIAG.configured = supabaseConfigured;