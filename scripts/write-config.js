const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });
[
  "index.html",
  "login.html",
  "volunteer.html",
  "core-values.html",
  "esl-leadership.html",
  "class-calendar.html",
  "bible-studies.html",
  "week-off.html",
  "curriculum.html",
  "teacher-training.html",
  "tutor-training.html"
].forEach(function (file) {
  fs.copyFileSync(path.join(root, file), path.join(publicDir, file));
});
fs.cpSync(path.join(root, "assets"), path.join(publicDir, "assets"), {
  recursive: true
});
const DEFAULT_WEB3FORMS_KEY = "61fc4699-58c5-4d9f-94b0-0f013fa44cc4";
const notify = {
  web3formsKey: String(process.env.WEB3FORMS_ACCESS_KEY || DEFAULT_WEB3FORMS_KEY).trim(),
  emails: ["noel.hoxie@gmail.com", "larryphoxie@gmail.com"]
};
const notifyJs = "window.ESL_NOTIFY = " + JSON.stringify(notify) + ";\n";
fs.writeFileSync(path.join(publicDir, "assets/js/notify-config.js"), notifyJs);
console.log("Copied site files into public/ for Vercel.");
