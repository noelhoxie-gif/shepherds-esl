(function () {
  "use strict";

  var form = document.getElementById("login-form");
  var username = document.getElementById("username");
  var password = document.getElementById("password");
  var submit = document.getElementById("login-submit");
  var errorBox = document.getElementById("login-error");
  var setupBox = document.getElementById("login-setup");

  function showError(message) {
    errorBox.hidden = !message;
    errorBox.textContent = message || "";
  }

  function nextPage() {
    var params = new URLSearchParams(window.location.search);
    var next = params.get("next") || "volunteer.html";
    if (next.charAt(0) === "/" || next.indexOf("://") !== -1) {
      return "volunteer.html";
    }
    if (next.indexOf(".html") === -1) next += ".html";
    return next;
  }

  var configured = window.ESL.isConfigured();
  if (!configured) {
    setupBox.hidden = false;
    setupBox.textContent = window.ESL.setupMessage();
    submit.disabled = true;
  }

  window.ESL.currentSession()
    .then(function (session) {
      if (session) window.location.replace(nextPage());
    })
    .catch(function () {});

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    showError("");
    submit.disabled = true;
    submit.textContent = "Signing in…";

    window.ESL
      .signIn(username.value.trim(), password.value)
      .then(function () {
        window.location.replace(nextPage());
      })
      .catch(function (err) {
        var message = (err && err.message) || "Could not sign in. Check your email and password.";
        if (/invalid login/i.test(message)) {
          message = "That email or password is not correct.";
        }
        showError(message);
        submit.disabled = !configured;
        submit.textContent = "Sign in";
      });
  });
})();
