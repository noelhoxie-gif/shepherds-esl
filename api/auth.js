const supabase = require("../lib/supabase");

module.exports = async function handler(req, res) {
  try {
    const cfg = supabase.config();
    if (!cfg.url || !cfg.key) {
      return supabase.send(res, 503, {
        error:
          "Volunteer login is not connected to Supabase yet. In Vercel, set SUPABASE_URL and SUPABASE_SECRET_KEY, then run supabase/schema.sql."
      });
    }

    const action = new URL(req.url, "http://localhost").searchParams.get("action") || "";

    if (req.method === "GET" && action === "session") {
      const user = await supabase.currentUser(req, res);
      if (!user) return supabase.send(res, 401, { error: "Not signed in." });
      return supabase.send(res, 200, { user: user });
    }

    if (req.method === "POST" && action === "login") {
      const body = await supabase.readBody(req);
      const user = await supabase.signIn(req, res, body.login, body.password);
      if (!user) {
        return supabase.send(res, 401, {
          error: "That username or password is not correct."
        });
      }
      return supabase.send(res, 200, { user: user });
    }

    if (req.method === "POST" && action === "logout") {
      await supabase.signOut(req, res);
      return supabase.send(res, 200, { ok: true });
    }

    return supabase.send(res, 404, { error: "Unknown action." });
  } catch (err) {
    return supabase.send(res, (err && err.status) || 500, {
      error: (err && err.message) || "Could not complete the request."
    });
  }
};
