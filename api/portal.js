const supabase = require("../lib/supabase");

const ALLOWED = {
  announcements: true,
  "class-sessions": true,
  "bible-studies": true,
  curriculum: true,
  training: true,
  "week-off": true,
  admin: true
};

const send = supabase.send;
const readBody = supabase.readBody;

function rest(url, key, pathname, options) {
  return supabase.request({ url: url, key: key }, pathname, options);
}

function userToken(req) {
  const cookies = supabase.readCookies(req);
  return cookies[supabase.ACCESS_COOKIE] || "";
}

function dayKey(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function asItems(rows) {
  if (Array.isArray(rows)) return rows;
  if (rows && Array.isArray(rows.items)) return rows.items;
  return [];
}

async function restWithAuth(req, url, key, pathname, options) {
  const opts = options || {};
  const token = userToken(req);
  const admin = supabase.jwtAdminKey();
  const attempts = [];
  if (token) attempts.push(Object.assign({}, opts, { token: token }));
  if (admin) attempts.push(Object.assign({}, opts, { token: admin }));
  attempts.push(opts);

  let lastError = null;
  for (let i = 0; i < attempts.length; i++) {
    try {
      return await rest(url, key, pathname, attempts[i]);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Supabase request failed.");
}

async function signedUrl(url, key, path) {
  if (!path) return null;
  const data = await rest(
    url,
    key,
    "/storage/v1/object/sign/volunteer-media/" + encodeURI(path.replace(/^\/+/, "")),
    { method: "POST", body: { expiresIn: 3600 } }
  );
  if (!data || !data.signedURL) return null;
  if (data.signedURL.indexOf("http") === 0) return data.signedURL;
  return url + "/storage/v1" + data.signedURL;
}

async function handleGet(resource, query, url, key, req, user) {
  if (resource === "announcements") {
    const rows =
      (await rest(
        url,
        key,
        "/rest/v1/announcements?select=id,title,body,video_path,created_at&published=eq.true&order=created_at.desc"
      )) || [];
    const items = [];
    for (var i = 0; i < rows.length; i++) {
      items.push({
        id: rows[i].id,
        title: rows[i].title,
        body: rows[i].body,
        created_at: rows[i].created_at,
        videoUrl: await signedUrl(url, key, rows[i].video_path)
      });
    }
    return { items: items };
  }

  if (resource === "class-sessions") {
    const from = query.from || "1900-01-01";
    const to = query.to || "2100-12-31";
    const range =
      "&session_date=gte." +
      encodeURIComponent(from) +
      "&session_date=lte." +
      encodeURIComponent(to) +
      "&order=session_date.asc,starts_at.asc";
    let rows = [];
    try {
      rows =
        (await rest(
          url,
          key,
          "/rest/v1/class_sessions?select=id,session_date,starts_at,class_name,class_level,building,room,volunteer_assignment" +
            range
        )) || [];
    } catch (err) {
      rows =
        (await rest(
          url,
          key,
          "/rest/v1/class_sessions?select=id,session_date,starts_at,class_name,building,room,volunteer_assignment" +
            range
        )) || [];
    }
    return { items: rows };
  }

  if (resource === "bible-studies") {
    const rows =
      (await rest(
        url,
        key,
        "/rest/v1/bible_studies?select=id,display_order,name,meeting_time,location,contact_name,contact_email,contact_phone&active=eq.true&order=display_order.asc&limit=10"
      )) || [];
    return { items: rows };
  }

  if (resource === "curriculum") {
    const rows =
      (await rest(
        url,
        key,
        "/rest/v1/curriculum_items?select=id,display_order,title,description,url,file_path&active=eq.true&order=display_order.asc"
      )) || [];
    const items = [];
    for (var c = 0; c < rows.length; c++) {
      items.push({
        id: rows[c].id,
        display_order: rows[c].display_order,
        title: rows[c].title,
        description: rows[c].description,
        url: rows[c].url,
        fileUrl: await signedUrl(url, key, rows[c].file_path)
      });
    }
    return { items: items };
  }

  if (resource === "training") {
    const kind = query.kind === "tutor" ? "tutor" : "teacher";
    let rows = [];
    try {
      rows =
        (await rest(
          url,
          key,
          "/rest/v1/training_videos?select=kind,title,description,vimeo_id,video_path,video_url&kind=eq." +
            encodeURIComponent(kind)
        )) || [];
    } catch (err) {
      rows =
        (await rest(
          url,
          key,
          "/rest/v1/training_videos?select=kind,title,description,vimeo_id,video_path&kind=eq." +
            encodeURIComponent(kind)
        )) || [];
    }
    const row = rows[0] || null;
    if (!row) return { item: null };
    return {
      item: {
        kind: row.kind,
        title: row.title,
        description: row.description,
        vimeo_id: row.vimeo_id,
        videoUrl: row.video_url || (await signedUrl(url, key, row.video_path))
      }
    };
  }

  if (resource === "week-off") {
    return { items: await loadWeekOff(req, url, key) };
  }

  if (resource === "admin") {
    return handleAdminGet(query, url, key, req);
  }

  throw new Error("Unknown resource.");
}

function normalizeWeekOff(row) {
  if (!row) return null;
  const item = {
    id: row.id || null,
    week_of: dayKey(row.week_of),
    volunteer_name: row.volunteer_name || "",
    volunteer_email: row.volunteer_email || "",
    class_level: row.class_level || "",
    assignment: row.assignment || "",
    note: row.note || "",
    status: row.status || "submitted",
    created_at: row.created_at || null
  };
  return item;
}

async function loadWeekOff(req, url, key) {
  try {
    const listed = await rest(url, key, "/rest/v1/rpc/list_week_off_requests", {
      method: "POST",
      body: {}
    });
    return asItems(listed).map(normalizeWeekOff).filter(Boolean);
  } catch (err) {
    const selects = [
      "/rest/v1/week_off_requests?select=id,week_of,volunteer_name,volunteer_email,class_level,assignment,note,status,created_at&order=week_of.desc",
      "/rest/v1/week_off_requests?select=id,week_of,volunteer_name,volunteer_email,assignment,note,status,created_at&order=week_of.desc"
    ];
    let lastError = err;
    for (let i = 0; i < selects.length; i++) {
      try {
        const rows = await restWithAuth(req, url, key, selects[i]);
        return asItems(rows).map(normalizeWeekOff).filter(Boolean);
      } catch (inner) {
        lastError = inner;
      }
    }
    throw lastError;
  }
}

async function insertWeekOff(req, url, key, payload) {
  try {
    const saved = await rest(url, key, "/rest/v1/rpc/submit_week_off_request", {
      method: "POST",
      body: {
        p_volunteer_name: payload.volunteer_name,
        p_volunteer_email: payload.volunteer_email,
        p_week_of: payload.week_of,
        p_class_level: payload.class_level,
        p_assignment: payload.assignment,
        p_note: payload.note
      }
    });
    return normalizeWeekOff(saved) || payload;
  } catch (err) {
    const prefer = {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: payload
    };
    try {
      const rows = await restWithAuth(
        req,
        url,
        key,
        "/rest/v1/week_off_requests?on_conflict=volunteer_email,week_of",
        prefer
      );
      return normalizeWeekOff(asItems(rows)[0]) || payload;
    } catch (inner) {
      const fallback = Object.assign({}, payload);
      fallback.assignment = [payload.class_level, payload.assignment].filter(Boolean).join(" · ") || null;
      delete fallback.class_level;
      const rows = await restWithAuth(
        req,
        url,
        key,
        "/rest/v1/week_off_requests?on_conflict=volunteer_email,week_of",
        Object.assign({}, prefer, { body: fallback })
      );
      const item = normalizeWeekOff(asItems(rows)[0]) || fallback;
      item.class_level = payload.class_level;
      return item;
    }
  }
}

async function handleWeekOff(body, url, key, req) {
  const payload = {
    volunteer_name: String((body && body.volunteer_name) || "").trim(),
    volunteer_email: String((body && body.volunteer_email) || "").trim().toLowerCase(),
    week_of: dayKey(body && body.week_of),
    class_level: String((body && body.class_level) || "").trim() || null,
    assignment: String((body && body.assignment) || "").trim() || null,
    note: String((body && body.note) || "").trim() || null,
    status: "submitted"
  };
  if (!payload.volunteer_name || !payload.volunteer_email || !payload.week_of) {
    const error = new Error("Name, email, and Friday date are required.");
    error.status = 400;
    throw error;
  }
  const friday = new Date(payload.week_of + "T12:00:00");
  if (friday.getDay() !== 5) {
    const error = new Error("Please choose a Friday.");
    error.status = 400;
    throw error;
  }
  if (!payload.class_level) {
    const error = new Error("Choose the level you normally teach.");
    error.status = 400;
    throw error;
  }

  const saved = await insertWeekOff(req, url, key, payload);
  const items = await loadWeekOff(req, url, key);
  const confirmed = items.find(function (item) {
    return (
      item.week_of === payload.week_of &&
      String(item.volunteer_email || "").toLowerCase() === payload.volunteer_email
    );
  });
  if (!confirmed) {
    const error = new Error(
      "The request could not be saved to the database. In Supabase, run supabase/schema.sql so week-off requests can be stored."
    );
    error.status = 500;
    throw error;
  }
  return { item: confirmed || saved, items: items };
}

function asList(value) {
  return asItems(value).filter(Boolean);
}

function timeValue(value) {
  const match = String(value || "").match(/^(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function normalizeClass(row) {
  if (!row) return null;
  return {
    id: row.id || null,
    session_date: dayKey(row.session_date),
    starts_at: timeValue(row.starts_at),
    class_name: row.class_name || "",
    class_level: row.class_level || "",
    building: row.building || "",
    room: row.room || "",
    volunteer_assignment: row.volunteer_assignment || "",
    notes: row.notes || ""
  };
}

function normalizeAnnouncement(row) {
  if (!row) return null;
  return {
    id: row.id || null,
    title: row.title || "",
    body: row.body || "",
    published: row.published !== false,
    created_at: row.created_at || null
  };
}

async function loadAdminAnnouncements(url, key) {
  try {
    const listed = await rest(url, key, "/rest/v1/rpc/list_announcements_admin", {
      method: "POST",
      body: {}
    });
    return asList(listed).map(normalizeAnnouncement).filter(Boolean);
  } catch (err) {
    const rows = await rest(
      url,
      key,
      "/rest/v1/announcements?select=id,title,body,published,created_at&order=created_at.desc"
    );
    return asList(rows).map(normalizeAnnouncement).filter(Boolean);
  }
}

async function loadAdminClasses(url, key, query) {
  const from = query.from || "1900-01-01";
  const to = query.to || "2100-12-31";
  const range =
    "&session_date=gte." +
    encodeURIComponent(from) +
    "&session_date=lte." +
    encodeURIComponent(to) +
    "&order=session_date.asc,starts_at.asc";
  let rows = [];
  try {
    rows = await rest(
      url,
      key,
      "/rest/v1/class_sessions?select=id,session_date,starts_at,class_name,class_level,building,room,volunteer_assignment,notes" +
        range
    );
  } catch (err) {
    rows = await rest(
      url,
      key,
      "/rest/v1/class_sessions?select=id,session_date,starts_at,class_name,building,room,volunteer_assignment,notes" +
        range
    );
  }
  return asList(rows).map(normalizeClass).filter(Boolean);
}

async function handleAdminGet(query, url, key, req) {
  const kind = query.kind || "announcements";
  if (kind === "announcements") return { items: await loadAdminAnnouncements(url, key) };
  if (kind === "classes") return { items: await loadAdminClasses(url, key, query) };
  if (kind === "requests") return { items: await loadWeekOff(req, url, key) };
  const error = new Error("Unknown admin list.");
  error.status = 400;
  throw error;
}

async function rpcOrRest(url, key, rpcPath, rpcBody, restPath, restOptions) {
  try {
    return await rest(url, key, rpcPath, { method: "POST", body: rpcBody });
  } catch (err) {
    return rest(url, key, restPath, restOptions);
  }
}

async function handleAdminPost(body, url, key, req) {
  const action = String((body && body.action) || "").trim();

  if (action === "save-announcement") {
    const title = String((body && body.title) || "").trim();
    const text = String((body && body.body) || "").trim();
    if (!title || !text) {
      const error = new Error("Title and announcement text are required.");
      error.status = 400;
      throw error;
    }
    const payload = {
      p_id: body.id || null,
      p_title: title,
      p_body: text,
      p_published: body.published !== false
    };
    const saved = await rpcOrRest(
      url,
      key,
      "/rest/v1/rpc/save_announcement",
      payload,
      body.id
        ? "/rest/v1/announcements?id=eq." + encodeURIComponent(body.id)
        : "/rest/v1/announcements",
      body.id
        ? {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: { title: title, body: text, published: body.published !== false }
          }
        : {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: { title: title, body: text, published: body.published !== false }
          }
    );
    return {
      item: normalizeAnnouncement(Array.isArray(saved) ? saved[0] : saved),
      items: await loadAdminAnnouncements(url, key)
    };
  }

  if (action === "delete-announcement") {
    if (!body.id) {
      const error = new Error("Choose an announcement to remove.");
      error.status = 400;
      throw error;
    }
    await rpcOrRest(
      url,
      key,
      "/rest/v1/rpc/delete_announcement",
      { p_id: body.id },
      "/rest/v1/announcements?id=eq." + encodeURIComponent(body.id),
      { method: "DELETE" }
    );
    return { items: await loadAdminAnnouncements(url, key) };
  }

  if (action === "save-class") {
    const sessionDate = dayKey(body && body.session_date);
    const className = String((body && body.class_name) || "").trim();
    if (!sessionDate || !className) {
      const error = new Error("Friday date and class name are required.");
      error.status = 400;
      throw error;
    }
    const friday = new Date(sessionDate + "T12:00:00");
    if (friday.getDay() !== 5) {
      const error = new Error("Classes should be scheduled on a Friday.");
      error.status = 400;
      throw error;
    }
    const payload = {
      p_id: body.id || null,
      p_session_date: sessionDate,
      p_starts_at: String((body && body.starts_at) || "").trim() || null,
      p_class_name: className,
      p_class_level: String((body && body.class_level) || "").trim() || null,
      p_building: String((body && body.building) || "").trim() || null,
      p_room: String((body && body.room) || "").trim() || null,
      p_volunteer_assignment: String((body && body.volunteer_assignment) || "").trim() || null,
      p_notes: String((body && body.notes) || "").trim() || null
    };
    const row = {
      session_date: sessionDate,
      starts_at: payload.p_starts_at,
      class_name: className,
      class_level: payload.p_class_level,
      building: payload.p_building,
      room: payload.p_room,
      volunteer_assignment: payload.p_volunteer_assignment,
      notes: payload.p_notes
    };
    const saved = await rpcOrRest(
      url,
      key,
      "/rest/v1/rpc/save_class_session",
      payload,
      body.id
        ? "/rest/v1/class_sessions?id=eq." + encodeURIComponent(body.id)
        : "/rest/v1/class_sessions",
      body.id
        ? { method: "PATCH", headers: { Prefer: "return=representation" }, body: row }
        : { method: "POST", headers: { Prefer: "return=representation" }, body: row }
    );
    return {
      item: normalizeClass(Array.isArray(saved) ? saved[0] : saved),
      items: await loadAdminClasses(url, key, body)
    };
  }

  if (action === "delete-class") {
    if (!body.id) {
      const error = new Error("Choose a class to remove.");
      error.status = 400;
      throw error;
    }
    await rpcOrRest(
      url,
      key,
      "/rest/v1/rpc/delete_class_session",
      { p_id: body.id },
      "/rest/v1/class_sessions?id=eq." + encodeURIComponent(body.id),
      { method: "DELETE" }
    );
    return { items: await loadAdminClasses(url, key, body) };
  }

  if (action === "copy-classes") {
    const from = dayKey(body && body.from);
    const to = dayKey(body && body.to);
    if (!from || !to || from === to) {
      const error = new Error("Choose the Friday to copy from and the Friday to copy to.");
      error.status = 400;
      throw error;
    }
    const source = await loadAdminClasses(url, key, { from: from, to: from });
    if (!source.length) {
      const error = new Error("There are no classes on that Friday to copy.");
      error.status = 400;
      throw error;
    }
    for (let i = 0; i < source.length; i++) {
      await handleAdminPost(
        {
          action: "save-class",
          session_date: to,
          starts_at: source[i].starts_at,
          class_name: source[i].class_name,
          class_level: source[i].class_level,
          building: source[i].building,
          room: source[i].room,
          volunteer_assignment: source[i].volunteer_assignment,
          notes: source[i].notes
        },
        url,
        key,
        req
      );
    }
    return { items: await loadAdminClasses(url, key, { from: to, to: to }) };
  }

  if (action === "update-request") {
    const status = String((body && body.status) || "").trim().toLowerCase();
    if (!body.id || ["submitted", "reviewed", "approved"].indexOf(status) === -1) {
      const error = new Error("Choose a request and a valid status.");
      error.status = 400;
      throw error;
    }
    await rpcOrRest(
      url,
      key,
      "/rest/v1/rpc/update_week_off_status",
      { p_id: body.id, p_status: status },
      "/rest/v1/week_off_requests?id=eq." + encodeURIComponent(body.id),
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: { status: status }
      }
    );
    return { items: await loadWeekOff(req, url, key) };
  }

  const error = new Error("Unknown admin action.");
  error.status = 400;
  throw error;
}

module.exports = async function handler(req, res) {
  try {
    const requestUrl = new URL(req.url, "http://localhost");
    const resource = requestUrl.searchParams.get("resource") || "";
    if (!ALLOWED[resource]) {
      return send(res, 404, { error: "Unknown resource." });
    }

    const cfg = supabase.config();
    if (!cfg.url || !cfg.key) {
      return send(res, 503, {
        error:
          "Volunteer pages are not connected to Supabase yet. In Vercel, set SUPABASE_URL and SUPABASE_SECRET_KEY, then run supabase/schema.sql."
      });
    }

    const user = await supabase.currentUser(req, res);
    if (!user) {
      return send(res, 401, { error: "Please sign in to view volunteer pages." });
    }

    if (req.method === "GET") {
      const query = Object.fromEntries(requestUrl.searchParams.entries());
      return send(res, 200, await handleGet(resource, query, cfg.url, cfg.key, req, user));
    }

    if (req.method === "POST" && resource === "week-off") {
      const body = await readBody(req);
      body.volunteer_email = user.email;
      return send(res, 200, await handleWeekOff(body, cfg.url, cfg.key, req));
    }

    if (req.method === "POST" && resource === "admin") {
      const body = await readBody(req);
      return send(res, 200, await handleAdminPost(body, cfg.url, cfg.key, req));
    }

    return send(res, 405, { error: "Method not allowed." });
  } catch (err) {
    const message = (err && err.message) || "Could not load volunteer data.";
    const status = err && err.status ? err.status : 500;
    return send(res, status, { error: message });
  }
};
