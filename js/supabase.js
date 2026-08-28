/* ============================================================================
   SUPABASE CONFIGURATION — THE ONLY PLACE YOU EDIT THINGS
   ============================================================================
   All Supabase setup is done in this single file. The Supabase JavaScript
   client is loaded from a CDN in app.html and index.html.

   HOW TO CONNECT (10 minutes):
   1. Create a free project at https://supabase.com
   2. Open the SQL Editor and run the file  supabase/schema.sql
   3. Go to Dashboard -> Settings -> API
   4. Copy the "Project URL"   into SUPABASE_URL  below
   5. Copy the "anon" / "public" key (NOT the service_role key)
      into SUPABASE_KEY below
   6. Save, then open the app. Students & attendance now live in
      PostgreSQL (Supabase) and persist across devices.

   IMPORTANT:
   - Use the PUBLIC (anon) key ONLY. Never use the service_role key here.
   - The anon key is public by design and is safe to commit for a small
     internal tool, because Row Level Security (RLS) controls access.
   ============================================================================ */

const SUPABASE_URL = "YOUR_SUPABASE_URL";        // <-- replace with your URL
const SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY"; // <-- replace with your anon key

/* Create the shared Supabase client used by the whole app.
   Do not edit below this line unless you know what you're doing. */
const supabase = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let supabaseConfigured = Boolean(supabase);
window.SUPABASE_CONFIGURED = supabaseConfigured;
