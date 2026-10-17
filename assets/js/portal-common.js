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

  function buildNav() {
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
  }

  async function signedMediaUrl(path) {
    if (!path) return null;
    var result = await window.ESL.client()
      .storage.from("volunteer-media")
      .createSignedUrl(path, 3600);
    if (result.error) return null;
    return result.data && result.data.signedUrl;
  }

  buildNav();

  window.ESLPortal = {
    showMessage: showMessage,
    signedMediaUrl: signedMediaUrl
  };

  if (!window.ESL.isConfigured()) {
    showMessage(window.ESL.setupMessage(), true);
    return;
  }

  if (portalContent) portalContent.hidden = false;
  document.dispatchEvent(new CustomEvent("esl:portal-ready"));
})();
