(function () {
  "use strict";

  var setupBox = document.getElementById("volunteer-setup");
  var userLabel = document.getElementById("volunteer-user");
  var logout = document.getElementById("logout-button");
  var portalContent = document.getElementById("portal-content");

  function showMessage(message, isError) {
    if (!setupBox) return;
    setupBox.hidden = false;
    setupBox.classList.toggle("form-error", Boolean(isError));
    setupBox.textContent = message;
  }

  window.ESLPortal = {
    showMessage: showMessage
  };

  if (logout) {
    logout.addEventListener("click", function () {
      window.ESL.signOut().finally(function () {
        window.location.replace("login.html");
      });
    });
  }

  if (!window.ESL.isConfigured()) {
    showMessage(window.ESL.setupMessage(), true);
    if (logout) logout.hidden = true;
    return;
  }

  window.ESL
    .currentSession()
    .then(function (session) {
      if (!session) {
        window.location.replace(
          "login.html?next=" + encodeURIComponent(window.location.pathname.split("/").pop())
        );
        return;
      }

      if (userLabel) {
        userLabel.textContent = session.user.email || "Volunteer";
      }
      if (portalContent) portalContent.hidden = false;

      document.dispatchEvent(
        new CustomEvent("esl:portal-ready", { detail: { session: session } })
      );
    })
    .catch(function (error) {
      showMessage(
        (error && error.message) || "The volunteer portal could not be loaded.",
        true
      );
    });
})();
