(function (global) {
  "use strict";

  function config() {
    return global.ESL_CONFIG || {};
  }

  function jwtRole(token) {
    var parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    try {
      var payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      var padded = payload + "===".slice((payload.length + 3) % 4);
      return JSON.parse(atob(padded)).role || null;
    } catch (err) {
      return null;
    }
  }

  function isSecretApiKey(key) {
    if (!key) return false;
    if (key.indexOf("sb_secret_") === 0) return true;
    if (key.indexOf("service_role") !== -1) return true;
    return jwtRole(key) === "service_role";
  }

  function isConfigured() {
    var c = config();
    return Boolean(c.supabaseUrl && c.supabaseAnonKey && !isSecretApiKey(c.supabaseAnonKey));
  }

  function client() {
    if (!isConfigured()) return null;
    if (!global.supabase || !global.supabase.createClient) {
      throw new Error("Supabase library failed to load.");
    }
    if (!global.__eslSupabase) {
      global.__eslSupabase = global.supabase.createClient(
        config().supabaseUrl,
        config().supabaseAnonKey
      );
    }
    return global.__eslSupabase;
  }

  async function currentSession() {
    var db = client();
    if (!db) return null;
    var result = await db.auth.getSession();
    if (result.error) throw result.error;
    return result.data.session;
  }

  async function signIn(email, password) {
    var db = client();
    if (!db) {
      throw new Error(setupMessage());
    }
    var result = await db.auth.signInWithPassword({
      email: email,
      password: password
    });
    if (result.error) throw result.error;
    return result.data.session;
  }

  async function signOut() {
    var db = client();
    if (!db) return;
    await db.auth.signOut();
  }

  function setupMessage() {
    var c = config();
    if (isSecretApiKey(c.supabaseAnonKey)) {
      return "A secret Supabase API key was added to this site. In Vercel and .env, set SUPABASE_ANON_KEY to the anon/public or publishable key from Project Settings → API. Never use the service_role or secret key in the browser.";
    }
    return "This volunteer portal is not connected to Supabase yet. Add SUPABASE_URL and SUPABASE_ANON_KEY in a local .env file or in the Vercel project settings, then run the SQL in supabase/schema.sql.";
  }

  global.ESL = {
    isConfigured: isConfigured,
    client: client,
    currentSession: currentSession,
    signIn: signIn,
    signOut: signOut,
    setupMessage: setupMessage
  };
})(window);
