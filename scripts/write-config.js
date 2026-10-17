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
  "tutor-training.html",
  "teacher-tips.html"
].forEach(function (file) {
  fs.copyFileSync(path.join(root, file), path.join(publicDir, file));
});
fs.cpSync(path.join(root, "assets"), path.join(publicDir, "assets"), {
  recursive: true
});
console.log("Copied site files into public/ for Vercel.");
