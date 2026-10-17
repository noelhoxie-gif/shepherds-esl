const ACCESS_COOKIE = "esl_at";
const REFRESH_COOKIE = "esl_rt";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function config() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return { url: url.replace(/\/$/, ""), key };
}

function isOpaqueKey(key) {
  return key.indexOf("sb_secret_") === 0 || key.indexOf("sb_publishable_") === 0;
}

async function request(cfg, pathname, options) {
  const opts = options || {};
  const headers = {
    apikey: cfg.key,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  if (opts.token) {
    headers.Authorization = "Bearer " + opts.token;
  } else if (!isOpaqueKey(cfg.key)) {
    headers.Authorization = "Bearer " + cfg.key;
  }
  Object.assign(headers, opts.headers || {});

  const response = await fetch(cfg.url + pathname, {
    method: opts.method || "GET",
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = { message: text };
    }
  }
  if (!response.ok) {
    const message =
      (data && (data.msg || data.message || data.error_description || data.error)) ||
      "Supabase request failed.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    req.on("data", function (chunk) {
      chunks.push(chunk);
    });
    req.on("end", function () {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function readCookies(req) {
  const out = {};
  String(req.headers.cookie || "")
    .split(";")
    .forEach(function (part) {
      const eq = part.indexOf("=");
      if (eq === -1) return;
      out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
    });
  return out;
}

function isLocal(req) {
  return /^(localhost|127\.0\.0\.1)(:|$)/.test(String(req.headers.host || ""));
}

function cookie(req, name, value, maxAge) {
  const parts = [
    name + "=" + encodeURIComponent(value),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=" + maxAge
  ];
  if (!isLocal(req)) parts.push("Secure");
  return parts.join("; ");
}

function setSessionCookies(req, res, session) {
  res.setHeader("Set-Cookie", [
    cookie(req, ACCESS_COOKIE, session.access_token, session.expires_in || 3600),
    cookie(req, REFRESH_COOKIE, session.refresh_token, REFRESH_MAX_AGE)
  ]);
}

function clearSessionCookies(req, res) {
  res.setHeader("Set-Cookie", [
    cookie(req, ACCESS_COOKIE, "", 0),
    cookie(req, REFRESH_COOKIE, "", 0)
  ]);
}

async function profileFor(cfg, userId) {
  try {
    const rows = await request(
      cfg,
      "/rest/v1/volunteer_profiles?select=username,display_name&user_id=eq." +
        encodeURIComponent(userId)
    );
    return (rows && rows[0]) || null;
  } catch (err) {
    return null;
  }
}

async function describe(cfg, user) {
  const profile = await profileFor(cfg, user.id);
  return {
    id: user.id,
    email: user.email,
    username: profile ? profile.username : null,
    displayName: profile ? profile.display_name : null
  };
}

async function currentUser(req, res) {
  const cfg = config();
  if (!cfg.url || !cfg.key) return null;
  const cookies = readCookies(req);

  if (cookies[ACCESS_COOKIE]) {
    try {
      const user = await request(cfg, "/auth/v1/user", { token: cookies[ACCESS_COOKIE] });
      if (user && user.id) return describe(cfg, user);
    } catch (err) {
      if (err.status && err.status !== 401 && err.status !== 403) throw err;
    }
  }

  if (!cookies[REFRESH_COOKIE]) return null;
  try {
    const session = await request(cfg, "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: cookies[REFRESH_COOKIE] }
    });
    setSessionCookies(req, res, session);
    return describe(cfg, session.user);
  } catch (err) {
    clearSessionCookies(req, res);
    return null;
  }
}

async function emailForLogin(cfg, login) {
  const value = String(login || "").trim();
  if (value.indexOf("@") !== -1) return value.toLowerCase();
  if (!value) return null;
  const rows = await request(
    cfg,
    "/rest/v1/volunteer_profiles?select=email&username=eq." +
      encodeURIComponent(value.toLowerCase())
  );
  return rows && rows[0] ? rows[0].email : null;
}

async function signIn(req, res, login, password) {
  const cfg = config();
  const email = await emailForLogin(cfg, login);
  if (!email || !password) return null;
  try {
    const session = await request(cfg, "/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email: email, password: password }
    });
    setSessionCookies(req, res, session);
    return describe(cfg, session.user);
  } catch (err) {
    if (err.status === 400 || err.status === 401) return null;
    throw err;
  }
}

async function signOut(req, res) {
  const cfg = config();
  const cookies = readCookies(req);
  if (cfg.url && cfg.key && cookies[ACCESS_COOKIE]) {
    try {
      await request(cfg, "/auth/v1/logout", {
        method: "POST",
        token: cookies[ACCESS_COOKIE]
      });
    } catch (err) {
      // The cookies are cleared below even if Supabase already expired the session.
    }
  }
  clearSessionCookies(req, res);
}

module.exports = {
  config,
  request,
  send,
  readBody,
  currentUser,
  signIn,
  signOut
};
