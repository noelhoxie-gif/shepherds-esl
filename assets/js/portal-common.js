(function () {
  "use strict";

  var setupBox = document.getElementById("volunteer-setup");
  var portalContent = document.getElementById("portal-content");
  var currentPage = (window.location.pathname.split("/").pop() || "volunteer.html").split("?")[0];
  if (currentPage && currentPage.indexOf(".html") === -1) {
    currentPage += ".html";
  }

  var portalPages = [
    { href: "index.html", label: "Home" },
    { href: "volunteer.html", label: "Announcements" },
    { href: "class-calendar.html", label: "Class Calendar" },
    { href: "curriculum.html", label: "Curriculum" },
    { href: "teacher-training.html", label: "Teacher Training" },
    { href: "tutor-training.html", label: "Tutor Training" },
    { href: "teacher-tips.html", label: "Teacher Tips" },
    { href: "bible-studies.html", label: "Bible Studies" },
    { href: "week-off.html", label: "Week Off" }
  ];

  function showMessage(message, isError) {
    if (!setupBox) return;
    setupBox.hidden = false;
    setupBox.classList.toggle("form-error", Boolean(isError));
    setupBox.textContent = message;
  }

  function buildNav(user) {
    var list = document.querySelector(".portal-nav ul");
    if (!list) return;
    list.replaceChildren();

    portalPages.forEach(function (page) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = page.href;
      link.textContent = page.label;
      if (page.href === currentPage) {
        link.setAttribute("aria-current", "page");
      }
      item.appendChild(link);
      list.appendChild(item);
    });

    var userItem = document.createElement("li");
    var userLabel = document.createElement("span");
    userLabel.className = "nav-user";
    userLabel.textContent = user.displayName || user.username || user.email;
    userItem.appendChild(userLabel);
    list.appendChild(userItem);

    var logoutItem = document.createElement("li");
    var logout = document.createElement("button");
    logout.type = "button";
    logout.className = "text-button";
    logout.textContent = "Sign out";
    logout.addEventListener("click", function () {
      fetch("/api/auth?action=logout", { method: "POST" }).finally(function () {
        window.location.replace("login.html");
      });
    });
    logoutItem.appendChild(logout);
    list.appendChild(logoutItem);
  }

  function goToLogin() {
    window.location.replace("login.html?next=" + encodeURIComponent(currentPage));
  }

  async function api(resource, options) {
    var params = new URLSearchParams((options && options.query) || {});
    params.set("resource", resource);
    var result = await fetch("/api/portal?" + params.toString(), {
      method: (options && options.method) || "GET",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: options && options.body ? JSON.stringify(options.body) : undefined
    });
    var data = {};
    try {
      data = await result.json();
    } catch (err) {
      data = {};
    }
    if (result.status === 401) {
      goToLogin();
      throw new Error("Please sign in.");
    }
    if (!result.ok) {
      throw new Error(data.error || "Could not load volunteer data.");
    }
    return data;
  }

  window.ESLPortal = {
    showMessage: showMessage,
    api: api
  };

  fetch("/api/auth?action=session", { headers: { Accept: "application/json" } })
    .then(function (result) {
      if (result.status === 401) {
        goToLogin();
        return null;
      }
      return result.json().then(function (data) {
        if (!result.ok) throw new Error(data.error || "Could not check your sign-in.");
        return data.user;
      });
    })
    .then(function (user) {
      if (!user) return;
      buildNav(user);
      if (portalContent) portalContent.hidden = false;
      document.dispatchEvent(new CustomEvent("esl:portal-ready", { detail: { user: user } }));
    })
    .catch(function (error) {
      showMessage((error && error.message) || "Could not check your sign-in.", true);
    });
})();
