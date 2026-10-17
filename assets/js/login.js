(function () {
  "use strict";

  var form = document.getElementById("login-form");
  var submit = document.getElementById("login-submit");
  var errorBox = document.getElementById("login-error");

  function showError(message) {
    errorBox.hidden = !message;
    errorBox.textContent = message || "";
  }

  function nextPage() {
    var next = new URLSearchParams(window.location.search).get("next") || "volunteer.html";
    if (!/^[a-z0-9-]+(\.html)?$/i.test(next)) return "volunteer.html";
    if (next.indexOf(".html") === -1) next += ".html";
    return next;
  }

  fetch("/api/auth?action=session", { headers: { Accept: "application/json" } })
    .then(function (result) {
      if (result.ok) window.location.replace(nextPage());
    })
    .catch(function () {});

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    showError("");

    var login = form.elements.login.value.trim();
    var password = form.elements.password.value;
    if (!login || !password) {
      showError("Enter your username and password.");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Signing in…";

    fetch("/api/auth?action=login", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ login: login, password: password })
    })
      .then(function (result) {
        return result.json().then(function (data) {
          if (!result.ok) throw new Error(data.error || "Could not sign in.");
          window.location.replace(nextPage());
        });
      })
      .catch(function (error) {
        showError((error && error.message) || "Could not sign in.");
        submit.disabled = false;
        submit.textContent = "Sign in";
      });
  });
})();
