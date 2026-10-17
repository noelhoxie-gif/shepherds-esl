const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const outPath = path.join(root, "assets", "js", "env.js");

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadDotEnv(envPath);

function jwtRole(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const data = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return data.role || null;
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

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let key =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

if (isSecretApiKey(key)) {
  console.error(
    "SUPABASE_ANON_KEY is a secret/service_role key. Use the anon or publishable key from Project Settings → API. Secret keys cannot be used in the browser."
  );
  process.exit(1);
}

const contents =
  "window.ESL_CONFIG = " +
  JSON.stringify(
    {
      supabaseUrl: url,
      supabaseAnonKey: key
    },
    null,
    2
  ) +
  ";\n";

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, contents);
console.log(
  url
    ? "Wrote assets/js/env.js with Supabase URL."
    : "Wrote assets/js/env.js with empty Supabase settings. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env or Vercel."
);

const publicDir = path.join(root, "public");
fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });
[
  "index.html",
  "login.html",
  "volunteer.html",
  "class-calendar.html",
  "bible-studies.html",
  "week-off.html",
  "curriculum.html",
  "teacher-training.html",
  "tutor-training.html",
  "teacher-tips.html"
].forEach(function (file) {
  fs.copyFileSync(path.join(root, file), path.join(publicDir, file));
});
fs.cpSync(path.join(root, "assets"), path.join(publicDir, "assets"), {
  recursive: true
});
console.log("Copied site files into public/ for Vercel.");
