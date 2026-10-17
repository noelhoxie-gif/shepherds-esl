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

function publicAuthConfig() {
  const url = config().url;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  return { url: url, key: key };
}

function isOpaqueKey(key) {
  return String(key || "").indexOf("sb_secret_") === 0 || String(key || "").indexOf("sb_publishable_") === 0;
}

function isJwt(key) {
  return String(key || "").indexOf("eyJ") === 0;
}

function jwtAdminKey() {
  const keys = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_ANON_KEY
  ];
  for (let i = 0; i < keys.length; i++) {
    if (isJwt(keys[i])) return keys[i];
  }
  return "";
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
  } else if (isJwt(cfg.key)) {
    headers.Authorization = "Bearer " + cfg.key;
  }
  Object.assign(headers, opts.headers || {});
  if (headers.Authorization && isOpaqueKey(String(headers.Authorization).replace(/^Bearer\s+/i, ""))) {
    delete headers.Authorization;
  }

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

function siteOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || (isLocal(req) ? "http" : "https")).split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return proto + "://" + host;
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
  try {
    const email = await request(cfg, "/rest/v1/rpc/email_for_volunteer_username", {
      method: "POST",
      body: { p_username: value.toLowerCase() }
    });
    if (typeof email === "string" && email) return email;
  } catch (err) {
    // Older databases may not have the helper yet.
  }
  const rows = await request(
    cfg,
    "/rest/v1/volunteer_profiles?select=email&username=eq." +
      encodeURIComponent(value.toLowerCase())
  );
  return rows && rows[0] ? rows[0].email : null;
}

async function passwordSession(cfg, email, password) {
  if (!email || !password) return null;
  try {
    return await request(cfg, "/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email: email, password: password }
    });
  } catch (err) {
    if (err.status === 400 || err.status === 401) return null;
    throw err;
  }
}

async function signIn(req, res, login, password) {
  const cfg = config();
  const email = await emailForLogin(cfg, login);
  const session = await passwordSession(cfg, email, password);
  if (!session) return null;
  setSessionCookies(req, res, session);
  return describe(cfg, session.user);
}

const USERNAME_PATTERN = /^[a-z0-9._-]{2,40}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message, status) {
  const error = new Error(message);
  error.status = status || 400;
  throw error;
}

async function usernameTaken(cfg, username) {
  const email = await emailForLogin(cfg, username);
  return !!email;
}

async function deleteAuthUser(cfg, userId) {
  const jwt = jwtAdminKey();
  if (!jwt) return;
  try {
    await request(cfg, "/auth/v1/admin/users/" + encodeURIComponent(userId), {
      method: "DELETE",
      headers: { Authorization: "Bearer " + jwt }
    });
  } catch (err) {
    // Best-effort cleanup if the profile row could not be saved.
  }
}

async function saveVolunteerProfile(cfg, user, username, email, displayName, accessToken) {
  const rpcBody = {
    p_user_id: user.id,
    p_username: username,
    p_email: email,
    p_display_name: displayName || null
  };

  try {
    await request(cfg, "/rest/v1/rpc/register_volunteer_profile", {
      method: "POST",
      token: accessToken,
      body: rpcBody
    });
    return;
  } catch (err) {
    const message = String((err && err.message) || "");
    if (
      err.status !== 404 &&
      !/could not find the function|invalid user/i.test(message)
    ) {
      throw err;
    }
  }

  const insert = {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: {
      user_id: user.id,
      username: username,
      email: email,
      display_name: displayName || null
    }
  };
  const jwt = jwtAdminKey();
  if (accessToken) insert.token = accessToken;
  else if (jwt) insert.headers.Authorization = "Bearer " + jwt;
  await request(cfg, "/rest/v1/volunteer_profiles", insert);
}

async function createAuthUser(cfg, email, password, metadata) {
  const jwt = jwtAdminKey();
  if (jwt) {
    return request(cfg, "/auth/v1/admin/users", {
      method: "POST",
      headers: { Authorization: "Bearer " + jwt },
      body: {
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: metadata
      }
    });
  }

  return request(cfg, "/auth/v1/signup", {
    method: "POST",
    body: {
      email: email,
      password: password,
      data: metadata
    }
  });
}

async function signUp(req, res, input) {
  const cfg = config();
  const username = String((input && input.username) || "").trim().toLowerCase();
  const email = String((input && input.email) || "").trim().toLowerCase();
  const password = String((input && input.password) || "");
  const displayName = String((input && input.displayName) || "").trim();

  if (!USERNAME_PATTERN.test(username)) {
    badRequest("Choose a username with 2–40 letters, numbers, dots, underscores, or hyphens.");
  }
  if (!EMAIL_PATTERN.test(email)) {
    badRequest("Enter a valid email address.");
  }
  if (password.length < 8) {
    badRequest("Choose a password with at least 8 characters.");
  }
  if (await usernameTaken(cfg, username)) {
    badRequest("That username is already taken.", 409);
  }

  let created;
  try {
    created = await createAuthUser(cfg, email, password, {
      username: username,
      display_name: displayName || username
    });
  } catch (err) {
    const message = String((err && err.message) || "").toLowerCase();
    if (/signups? not allowed|disabled/.test(message)) {
      badRequest(
        "New accounts are turned off in Supabase. In Authentication → Providers, turn on Email and allow new users to sign up.",
        403
      );
    }
    if (/bearer token|jwt|authorization/.test(message)) {
      badRequest(
        "Supabase Auth needs a JWT service_role key for this step, or Email signups turned on. Add the legacy service_role key as SUPABASE_SERVICE_ROLE_KEY in Vercel, or allow new users to sign up.",
        401
      );
    }
    if (err.status === 422 || /already|registered|exists/.test(message)) {
      const session = await passwordSession(cfg, email, password);
      if (!session || !session.user) {
        badRequest("That username or email is already in use.", 409);
      }
      try {
        await saveVolunteerProfile(
          cfg,
          session.user,
          username,
          email,
          displayName,
          session.access_token
        );
      } catch (saveErr) {
        if (saveErr.status !== 409 && !/duplicate|unique/.test(String(saveErr.message || ""))) {
          throw saveErr;
        }
      }
      setSessionCookies(req, res, session);
      return describe(cfg, session.user);
    }
    if (/password/.test(message)) {
      badRequest("Choose a password with at least 8 characters.");
    }
    throw err;
  }

  const user = (created && created.user) || created;
  if (!user || !user.id) {
    badRequest("Could not create the account.", 500);
  }

  try {
    await saveVolunteerProfile(cfg, user, username, email, displayName, created.access_token);
  } catch (err) {
    await deleteAuthUser(cfg, user.id);
    if (err.status === 409 || /duplicate|unique/.test(String(err.message || ""))) {
      badRequest("That username or email is already in use.", 409);
    }
    throw err;
  }

  if (created.access_token && created.refresh_token) {
    setSessionCookies(req, res, created);
    return describe(cfg, user);
  }

  const signedIn = await signIn(req, res, email, password);
  if (!signedIn) {
    badRequest(
      "The account was created. If Confirm email is on in Supabase, confirm the email, then sign in.",
      400
    );
  }
  return signedIn;
}

function resetRedirect(req) {
  const site = String(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (site) return site + "/login.html";
  return siteOrigin(req) + "/login.html";
}

async function sendRecoveryEmail(cfg, email, redirect) {
  const recoverPath = "/auth/v1/recover?redirect_to=" + encodeURIComponent(redirect);
  try {
    await request(cfg, recoverPath, { method: "POST", body: { email: email } });
  } catch (err) {
    const message = String((err && err.message) || "").toLowerCase();
    if (/redirect/.test(message)) {
      await request(cfg, "/auth/v1/recover", { method: "POST", body: { email: email } });
      return;
    }
    throw err;
  }
}

async function requestPasswordReset(req, login) {
  const cfg = config();
  const email = await emailForLogin(cfg, login);
  if (!email) return;
  const redirect = resetRedirect(req);
  const jwt = jwtAdminKey();
  let lastError = null;

  if (jwt) {
    try {
      await request(cfg, "/auth/v1/admin/generate_link", {
        method: "POST",
        headers: { Authorization: "Bearer " + jwt },
        body: {
          type: "recovery",
          email: email,
          redirect_to: redirect
        }
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }

  try {
    await sendRecoveryEmail(publicAuthConfig(), email, redirect);
    return;
  } catch (err) {
    lastError = err;
  }

  const message = String((lastError && lastError.message) || "").toLowerCase();
  if (/redirect/.test(message)) {
    badRequest(
      "Supabase rejected the reset link address. In Authentication → URL Configuration, set Site URL to this website and add /login.html to Redirect URLs.",
      400
    );
  }
  if ((lastError && lastError.status === 429) || /rate/.test(message)) {
    badRequest("Too many reset emails were requested. Wait a few minutes and try again.", 429);
  }
  badRequest(
    "Could not send the reset email. In Supabase, turn on Email under Authentication → Providers, and confirm the Reset Password template is enabled. Check the spam folder too.",
    lastError && lastError.status >= 400 ? lastError.status : 502
  );
}

async function completePasswordReset(req, res, input) {
  const cfg = config();
  const password = String((input && input.password) || "");
  if (password.length < 8) {
    badRequest("Choose a password with at least 8 characters.");
  }

  let session = null;
  const recoveryToken = String((input && input.token) || "").trim();
  const accessToken = String((input && input.accessToken) || "").trim();
  const refreshToken = String((input && input.refreshToken) || "").trim();

  if (recoveryToken) {
    try {
      session = await request(cfg, "/auth/v1/verify", {
        method: "POST",
        body: { type: "recovery", token: recoveryToken }
      });
    } catch (err) {
      badRequest("That reset link is missing or has expired. Request a new one.", 401);
    }
  }

  const access = (session && session.access_token) || accessToken;
  if (!access) {
    badRequest("That reset link is missing or has expired. Request a new one.", 401);
  }

  try {
    await request(cfg, "/auth/v1/user", {
      method: "PUT",
      token: access,
      body: { password: password }
    });
  } catch (err) {
    const message = String((err && err.message) || "").toLowerCase();
    if (/password/.test(message)) {
      badRequest("Choose a password with at least 8 characters.");
    }
    if (err.status === 401 || err.status === 403) {
      badRequest("That reset link is missing or has expired. Request a new one.", 401);
    }
    throw err;
  }

  const refresh = (session && session.refresh_token) || refreshToken;
  if (refresh) {
    setSessionCookies(req, res, {
      access_token: access,
      refresh_token: refresh,
      expires_in: (session && session.expires_in) || 3600
    });
  }

  const user = (session && session.user) || (await request(cfg, "/auth/v1/user", { token: access }));
  return describe(cfg, user);
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
  signUp,
  requestPasswordReset,
  completePasswordReset,
  signOut
};
