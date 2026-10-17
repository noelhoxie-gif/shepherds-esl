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

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

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
["index.html", "login.html", "volunteer.html"].forEach(function (file) {
  fs.copyFileSync(path.join(root, file), path.join(publicDir, file));
});
fs.cpSync(path.join(root, "assets"), path.join(publicDir, "assets"), {
  recursive: true
});
console.log("Copied site files into public/ for Vercel.");
