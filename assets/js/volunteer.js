(function () {
  "use strict";

  var list = document.getElementById("announcement-list");
  var empty = document.getElementById("announcement-empty");

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

  document.addEventListener("esl:portal-ready", function () {
    window.ESLPortal
      .api("announcements")
      .then(function (data) {
        var rows = data.items || [];
        if (!rows.length) {
          empty.hidden = false;
          return;
        }
        rows.forEach(function (item) {
          list.appendChild(card(item));
        });
      })
      .catch(function (err) {
        window.ESLPortal.showMessage(
          (err && err.message) || "Could not load announcements.",
          true
        );
      });
  });
})();
