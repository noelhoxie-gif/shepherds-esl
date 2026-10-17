(function (global) {
  "use strict";

  function config() {
    return global.ESL_CONFIG || {};
  }

  function isConfigured() {
    var c = config();
    return Boolean(c.supabaseUrl && c.supabaseAnonKey);
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
      throw new Error("Supabase is not configured yet.");
    }
    var result = await db.auth.signInWithPassword({
      email: email,
      password: password
    });
    if (result.error) throw result.error;
    return result.data.session;
  }

  function redirectTarget() {
    return new URL("volunteer.html", window.location.href).href;
  }

  async function signInWithProvider(provider) {
    var db = client();
    if (!db) {
      throw new Error("Supabase is not configured yet.");
    }
    var result = await db.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: redirectTarget()
      }
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signOut() {
    var db = client();
    if (!db) return;
    await db.auth.signOut();
  }

  function setupMessage() {
    return "This volunteer portal is not connected to Supabase yet. Add SUPABASE_URL and SUPABASE_ANON_KEY in a local .env file or in the Vercel project settings, then run the SQL in supabase/schema.sql.";
  }

  global.ESL = {
    isConfigured: isConfigured,
    client: client,
    currentSession: currentSession,
    signIn: signIn,
    signInWithProvider: signInWithProvider,
    signOut: signOut,
    setupMessage: setupMessage
  };
})(window);
