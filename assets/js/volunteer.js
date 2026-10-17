(function () {
  "use strict";

  var list = document.getElementById("announcement-list");
  var empty = document.getElementById("announcement-empty");
  var setupBox = document.getElementById("volunteer-setup");
  var userLabel = document.getElementById("volunteer-user");
  var logout = document.getElementById("logout-button");

  function card(item, videoUrl) {
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

    if (videoUrl) {
      var video = document.createElement("video");
      video.controls = true;
      video.preload = "metadata";
      video.src = videoUrl;
      article.appendChild(video);
    }

    return article;
  }

  function showSetup(message) {
    setupBox.hidden = false;
    setupBox.textContent = message;
  }

  async function signedVideoUrl(path) {
    if (!path) return null;
    var result = await window.ESL.client()
      .storage.from("volunteer-media")
      .createSignedUrl(path, 3600);
    if (result.error) return null;
    return result.data && result.data.signedUrl;
  }

  async function loadAnnouncements() {
    var result = await window.ESL.client()
      .from("announcements")
      .select("id, title, body, video_path, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (result.error) {
      throw result.error;
    }

    var rows = result.data || [];
    if (!rows.length) {
      empty.hidden = false;
      return;
    }

    for (var i = 0; i < rows.length; i++) {
      var videoUrl = await signedVideoUrl(rows[i].video_path);
      list.appendChild(card(rows[i], videoUrl));
    }
  }

  logout.addEventListener("click", function () {
    window.ESL.signOut().finally(function () {
      window.location.replace("login.html");
    });
  });

  if (!window.ESL.isConfigured()) {
    showSetup(window.ESL.setupMessage());
    logout.hidden = true;
    return;
  }

  window.ESL
    .currentSession()
    .then(function (session) {
      if (!session) {
        window.location.replace("login.html?next=volunteer.html");
        return null;
      }
      userLabel.textContent = session.user.email || "Volunteer";
      return loadAnnouncements();
    })
    .catch(function (err) {
      var message = (err && err.message) || "Could not load announcements.";
      if (/relation .*announcements/i.test(message) || /could not find the table/i.test(message)) {
        message =
          "The announcements table is missing. Run supabase/schema.sql in the Supabase SQL Editor.";
      }
      showSetup(message);
    });
})();
