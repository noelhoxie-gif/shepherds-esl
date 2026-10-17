(function () {
  "use strict";

  var form = document.getElementById("login-form");
  var username = document.getElementById("username");
  var password = document.getElementById("password");
  var submit = document.getElementById("login-submit");
  var errorBox = document.getElementById("login-error");
  var setupBox = document.getElementById("login-setup");
  var methodButtons = document.querySelectorAll("[data-method]");
  var panels = document.querySelectorAll("[data-panel]");
  var googleButton = document.getElementById("google-login");
  var appleButton = document.getElementById("apple-login");

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
    return next;
  }

  function showMethod(method) {
    methodButtons.forEach(function (button) {
      var active = button.getAttribute("data-method") === method;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach(function (panel) {
      var active = panel.getAttribute("data-panel") === method;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    showError("");
    var url = new URL(window.location.href);
    url.searchParams.set("experience", method);
    window.history.replaceState({}, "", url);
  }

  function oauthLabel(provider, busy) {
    if (provider === "google") {
      return busy ? "Opening Google…" : "Continue with Google";
    }
    return busy ? "Opening Apple…" : "Continue with Apple";
  }

  function startOAuth(provider, button) {
    showError("");
    button.disabled = true;
    button.textContent = oauthLabel(provider, true);
    window.ESL
      .signInWithProvider(provider)
      .catch(function (err) {
        var message = (err && err.message) || "Could not start social login.";
        if (/provider is not enabled/i.test(message) || /unsupported provider/i.test(message)) {
          message =
            "The " +
            provider +
            " provider is not enabled yet. Turn it on in Supabase Authentication → Providers.";
        }
        showError(message);
        button.disabled = false;
        button.textContent = oauthLabel(provider, false);
      });
  }

  var configured = window.ESL.isConfigured();
  if (!configured) {
    setupBox.hidden = false;
    setupBox.textContent = window.ESL.setupMessage();
    submit.disabled = true;
    googleButton.disabled = true;
    appleButton.disabled = true;
  }

  var requested = new URLSearchParams(window.location.search).get("experience");
  if (requested === "google" || requested === "apple" || requested === "password") {
    showMethod(requested);
  }

  methodButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      showMethod(button.getAttribute("data-method"));
    });
  });

  googleButton.addEventListener("click", function () {
    startOAuth("google", googleButton);
  });
  appleButton.addEventListener("click", function () {
    startOAuth("apple", appleButton);
  });

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
