(function () {
  "use strict";

  var loginForm = document.getElementById("login-form");
  var signupForm = document.getElementById("signup-form");
  var recoverForm = document.getElementById("recover-form");
  var resetForm = document.getElementById("reset-form");
  var loginSubmit = document.getElementById("login-submit");
  var signupSubmit = document.getElementById("signup-submit");
  var recoverSubmit = document.getElementById("recover-submit");
  var resetSubmit = document.getElementById("reset-submit");
  var errorBox = document.getElementById("login-error");
  var successBox = document.getElementById("login-success");
  var heading = document.getElementById("auth-heading");
  var copy = document.getElementById("auth-copy");
  var tabs = document.querySelectorAll(".auth-method");
  var tabList = document.querySelector(".auth-tabs");
  var recovery = recoveryFromUrl();

  function showError(message) {
    errorBox.hidden = !message;
    errorBox.textContent = message || "";
    if (message) successBox.hidden = true;
  }

  function showSuccess(message) {
    successBox.hidden = !message;
    successBox.textContent = message || "";
    if (message) errorBox.hidden = true;
  }

  function nextPage() {
    var next = new URLSearchParams(window.location.search).get("next") || "volunteer.html";
    if (!/^[a-z0-9-]+(\.html)?$/i.test(next)) return "volunteer.html";
    if (next.indexOf(".html") === -1) next += ".html";
    return next;
  }

  function recoveryFromUrl() {
    var hash = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
    var query = new URLSearchParams(window.location.search);
    var type = hash.get("type") || query.get("type");
    if (type !== "recovery") return null;
    return {
      accessToken: hash.get("access_token") || "",
      refreshToken: hash.get("refresh_token") || "",
      token: query.get("token") || ""
    };
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
        return data;
      });
    });
  }

  function showPanel(name) {
    heading.textContent =
      name === "signup" ? "Create account" : name === "recover" ? "Reset password" : name === "reset" ? "Choose a new password" : "Sign in";
    copy.textContent =
      name === "signup"
        ? "Choose a username, email, and password. You can sign in with either the username or the email."
        : name === "recover"
          ? "Enter your username or email and we will send a reset link if an account exists."
          : name === "reset"
            ? "Enter a new password for your volunteer account."
            : "Use your username or email and password to open the volunteer pages.";
    loginForm.hidden = name !== "signin";
    signupForm.hidden = name !== "signup";
    recoverForm.hidden = name !== "recover";
    resetForm.hidden = name !== "reset";
    if (tabList) tabList.hidden = name === "recover" || name === "reset";
    showError("");
    if (name !== "recover") showSuccess("");
    tabs.forEach(function (tab) {
      var active = tab.getAttribute("data-panel") === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  if (!recovery) {
    fetch("/api/auth?action=session", { headers: { Accept: "application/json" } })
      .then(function (result) {
        if (result.ok) window.location.replace(nextPage());
      })
      .catch(function () {});
  } else {
    showPanel("reset");
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search.replace(/([?&])token=[^&]+/, "").replace(/[?&]$/, ""));
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      showPanel(tab.getAttribute("data-panel"));
    });
  });

  document.getElementById("forgot-link").addEventListener("click", function () {
    showPanel("recover");
  });
  document.getElementById("recover-back").addEventListener("click", function () {
    showPanel("signin");
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
    postAuth("login", { login: login, password: password })
      .then(function () {
        window.location.replace(nextPage());
      })
      .catch(function (error) {
        showError((error && error.message) || "Could not sign in.");
        setBusy(loginSubmit, false, "Sign in", "Signing in…");
      });
  });

  recoverForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showError("");
    showSuccess("");

    var login = recoverForm.elements.login.value.trim();
    if (!login) {
      showError("Enter your username or email.");
      return;
    }

    setBusy(recoverSubmit, true, "Send reset email", "Sending…");
    postAuth("recover", { login: login })
      .then(function (data) {
        showSuccess(data.message || "If that account exists, we sent a password reset email.");
        setBusy(recoverSubmit, false, "Send reset email", "Sending…");
      })
      .catch(function (error) {
        showError((error && error.message) || "Could not send the reset email.");
        setBusy(recoverSubmit, false, "Send reset email", "Sending…");
      });
  });

  resetForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showError("");

    var password = resetForm.elements.password.value;
    var confirm = resetForm.elements.confirm.value;
    if (!password || password.length < 8) {
      showError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      showError("The new passwords do not match.");
      return;
    }

    setBusy(resetSubmit, true, "Save new password", "Saving…");
    postAuth("update-password", {
      password: password,
      accessToken: recovery && recovery.accessToken,
      refreshToken: recovery && recovery.refreshToken,
      token: recovery && recovery.token
    })
      .then(function () {
        window.location.replace(nextPage());
      })
      .catch(function (error) {
        showError((error && error.message) || "Could not save the new password.");
        setBusy(resetSubmit, false, "Save new password", "Saving…");
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
    })
      .then(function () {
        window.location.replace(nextPage());
      })
      .catch(function (error) {
        showError((error && error.message) || "Could not create the account.");
        setBusy(signupSubmit, false, "Create account", "Creating account…");
      });
  });
})();
