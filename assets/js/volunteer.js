(function () {
  "use strict";

  var list = document.getElementById("announcement-list");
  var empty = document.getElementById("announcement-empty");
  var form = document.getElementById("announcement-form");
  var status = document.getElementById("announcement-status");

  function card(item) {
    var article = document.createElement("article");
    article.className = "card announcement-card";

    var when = item.created_at
      ? new Date(item.created_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric"
        })
      : "";

    var h3 = document.createElement("h3");
    h3.textContent = item.title;
    article.appendChild(h3);

    if (when) {
      var time = document.createElement("p");
      time.className = "announcement-date";
      time.textContent = when;
      article.appendChild(time);
    }

    var body = document.createElement("p");
    body.textContent = item.body;
    article.appendChild(body);

    if (item.videoUrl) {
      var video = document.createElement("video");
      video.controls = true;
      video.preload = "metadata";
      video.src = item.videoUrl;
      article.appendChild(video);
    }

    return article;
  }

  function render(rows) {
    list.replaceChildren();
    empty.hidden = rows.length > 0;
    rows.forEach(function (item) {
      list.appendChild(card(item));
    });
  }

  function loadAnnouncements() {
    return window.ESLPortal.api("announcements").then(function (data) {
      render(data.items || []);
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    status.textContent = "Posting…";
    window.ESLPortal
      .api("announcements", {
        method: "POST",
        body: {
          title: form.elements.title.value.trim(),
          body: form.elements.body.value.trim()
        }
      })
      .then(function () {
        form.reset();
        status.textContent = "Announcement posted.";
        return loadAnnouncements();
      })
      .catch(function (err) {
        status.textContent = "";
        window.ESLPortal.showMessage(
          (err && err.message) || "Could not post the announcement.",
          true
        );
      })
      .finally(function () {
        submit.disabled = false;
      });
  });

  document.addEventListener("esl:portal-ready", function (event) {
    var user = (event.detail && event.detail.user) || {};
    document.getElementById("announcement-composer").hidden = !user.canPostAnnouncements;
    loadAnnouncements().catch(function (err) {
      window.ESLPortal.showMessage(
        (err && err.message) || "Could not load announcements.",
        true
      );
    });
  });
})();
