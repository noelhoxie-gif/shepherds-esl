const supabase = require("../lib/supabase");

const ALLOWED = {
  announcements: true,
  "class-sessions": true,
  "bible-studies": true,
  curriculum: true,
  training: true,
  "teacher-tips": true,
  "week-off": true
};

const send = supabase.send;
const readBody = supabase.readBody;

function rest(url, key, pathname, options) {
  return supabase.request({ url: url, key: key }, pathname, options);
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

async function handleGet(resource, query, url, key) {
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
    const rows =
      (await rest(
        url,
        key,
        "/rest/v1/class_sessions?select=id,session_date,starts_at,class_name,building,room,volunteer_assignment" +
          "&session_date=gte." +
          encodeURIComponent(from) +
          "&session_date=lte." +
          encodeURIComponent(to) +
          "&order=session_date.asc,starts_at.asc"
      )) || [];
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

  if (resource === "teacher-tips") {
    const rows =
      (await rest(
        url,
        key,
        "/rest/v1/teacher_tips?select=id,display_order,title,body&active=eq.true&order=display_order.asc"
      )) || [];
    return { items: rows };
  }

  if (resource === "week-off") {
    const rows =
      (await rest(
        url,
        key,
        "/rest/v1/week_off_requests?select=id,week_of,volunteer_name,assignment,note,status,created_at&order=week_of.desc"
      )) || [];
    return { items: rows };
  }

  throw new Error("Unknown resource.");
}

async function handleWeekOff(body, url, key) {
  const payload = {
    volunteer_name: String((body && body.volunteer_name) || "").trim(),
    volunteer_email: String((body && body.volunteer_email) || "").trim(),
    week_of: String((body && body.week_of) || "").trim(),
    assignment: String((body && body.assignment) || "").trim() || null,
    note: String((body && body.note) || "").trim() || null,
    status: "submitted"
  };
  if (!payload.volunteer_name || !payload.volunteer_email || !payload.week_of) {
    const error = new Error("Name, email, and Friday date are required.");
    error.status = 400;
    throw error;
  }
  const rows = await rest(
    url,
    key,
    "/rest/v1/week_off_requests?on_conflict=volunteer_email,week_of",
    {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: payload
  });
  return { item: (rows && rows[0]) || payload };
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
      return send(res, 200, await handleGet(resource, query, cfg.url, cfg.key));
    }

    if (req.method === "POST" && resource === "week-off") {
      const body = await readBody(req);
      body.volunteer_email = user.email;
      return send(res, 200, await handleWeekOff(body, cfg.url, cfg.key));
    }

    return send(res, 405, { error: "Method not allowed." });
  } catch (err) {
    const message = (err && err.message) || "Could not load volunteer data.";
    const status = err && err.status ? err.status : 500;
    return send(res, status, { error: message });
  }
};
