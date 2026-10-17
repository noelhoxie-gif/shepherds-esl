(function () {
  "use strict";

  // Every <section class="tab-panel"> becomes a tab. Order in the menu
  // follows the order of sections in index.html.
  var panels = Array.prototype.slice.call(document.querySelectorAll(".tab-panel"));
  var navList = document.getElementById("main-nav-list");
  var footerList = document.getElementById("footer-nav-list");
  var nav = document.getElementById("main-nav");
  var toggle = document.getElementById("nav-toggle");

  if (!panels.length) return;

  function makeLink(panel) {
    var a = document.createElement("a");
    a.href = "#" + panel.id;
    a.textContent = panel.getAttribute("data-tab-title") || panel.id;
    return a;
  }

  panels.forEach(function (panel) {
    if (panel.hasAttribute("data-hide-from-menu")) return;
    var li = document.createElement("li");
    li.appendChild(makeLink(panel));
    navList.appendChild(li);

    if (footerList) {
      var fli = document.createElement("li");
      fli.appendChild(makeLink(panel));
      footerList.appendChild(fli);
    }
  });

  var loginItem = document.createElement("li");
  var loginLink = document.createElement("a");
  loginLink.href = "login.html";
  loginLink.textContent = "Volunteer Login";
  loginItem.appendChild(loginLink);
  navList.appendChild(loginItem);

  if (footerList) {
    var footerLogin = document.createElement("li");
    var footerLoginLink = document.createElement("a");
    footerLoginLink.href = "login.html";
    footerLoginLink.textContent = "Volunteer Login";
    footerLogin.appendChild(footerLoginLink);
    footerList.appendChild(footerLogin);
  }

  function showTab(id, focus) {
    var target = document.getElementById(id);
    if (!target || !target.classList.contains("tab-panel")) {
      target = panels[0];
    }

    panels.forEach(function (panel) {
      var active = panel === target;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    navList.querySelectorAll("a").forEach(function (a) {
      if (a.getAttribute("href") === "#" + target.id) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });

    var title = target.getAttribute("data-tab-title");
    document.title = (title ? title + " | " : "") + "ESL Ministry | The Shepherd's Church";

    window.scrollTo(0, 0);
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");

    if (focus) {
      var heading = target.querySelector("h1, h2");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
  }

  window.addEventListener("hashchange", function () {
    showTab(location.hash.slice(1), true);
  });

  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  showTab(location.hash.slice(1), false);
  // The browser jumps to the matching #id after load; undo that jump.
  window.addEventListener("load", function () {
    window.scrollTo(0, 0);
  });
})();
