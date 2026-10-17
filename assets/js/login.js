(function () {
  "use strict";

  var loginForm = document.getElementById("login-form");
  var signupForm = document.getElementById("signup-form");
  var loginSubmit = document.getElementById("login-submit");
  var signupSubmit = document.getElementById("signup-submit");
  var errorBox = document.getElementById("login-error");
  var heading = document.getElementById("auth-heading");
  var copy = document.getElementById("auth-copy");
  var tabs = document.querySelectorAll(".auth-method");

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

  function setBusy(button, busy, idleLabel, busyLabel) {
    button.disabled = busy;
    button.textContent = busy ? busyLabel : idleLabel;
  }

  function postAuth(action, body) {
    return fetch("/api/auth?action=" + action, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (result) {
      return result.json().then(function (data) {
        if (!result.ok) throw new Error(data.error || "Could not complete the request.");
        window.location.replace(nextPage());
      });
    });
  }

  function showPanel(name) {
    var signingIn = name === "signin";
    heading.textContent = signingIn ? "Sign in" : "Create account";
    copy.textContent = signingIn
      ? "Use your username or email and password to open the volunteer pages."
      : "Choose a username, email, and password. You can sign in with either the username or the email.";
    loginForm.hidden = !signingIn;
    signupForm.hidden = signingIn;
    showError("");
    tabs.forEach(function (tab) {
      var active = tab.getAttribute("data-panel") === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  fetch("/api/auth?action=session", { headers: { Accept: "application/json" } })
    .then(function (result) {
      if (result.ok) window.location.replace(nextPage());
    })
    .catch(function () {});

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      showPanel(tab.getAttribute("data-panel"));
    });
  });

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showError("");

    var login = loginForm.elements.login.value.trim();
    var password = loginForm.elements.password.value;
    if (!login || !password) {
      showError("Enter your username and password.");
      return;
    }

    setBusy(loginSubmit, true, "Sign in", "Signing in…");
    postAuth("login", { login: login, password: password }).catch(function (error) {
      showError((error && error.message) || "Could not sign in.");
      setBusy(loginSubmit, false, "Sign in", "Signing in…");
    });
  });

  signupForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showError("");

    var username = signupForm.elements.username.value.trim();
    var email = signupForm.elements.email.value.trim();
    var password = signupForm.elements.password.value;
    var displayName = signupForm.elements.displayName.value.trim();
    if (!username || !email || !password) {
      showError("Enter a username, email, and password.");
      return;
    }

    setBusy(signupSubmit, true, "Create account", "Creating account…");
    postAuth("signup", {
      username: username,
      email: email,
      password: password,
      displayName: displayName
    }).catch(function (error) {
      showError((error && error.message) || "Could not create the account.");
      setBusy(signupSubmit, false, "Create account", "Creating account…");
    });
  });
})();
