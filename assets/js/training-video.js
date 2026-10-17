(function () {
  "use strict";

  var kind = document.body.getAttribute("data-training-kind");
  var title = document.getElementById("training-title");
  var description = document.getElementById("training-description");
  var player = document.getElementById("training-player");
  var empty = document.getElementById("training-empty");

  function vimeoEmbed(id) {
    var wrap = document.createElement("div");
    wrap.className = "video-embed";
    var iframe = document.createElement("iframe");
    iframe.src = "https://player.vimeo.com/video/" + encodeURIComponent(String(id).replace(/\D/g, ""));
    iframe.title = title.textContent;
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    wrap.appendChild(iframe);
    return wrap;
  }

  function filePlayer(url) {
    var video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata";
    video.src = url;
    video.className = "training-video";
    return video;
  }

  async function loadVideo() {
    var result = await window.ESLPortal.api("training", { query: { kind: kind } });
    var row = result.item;
    if (!row) {
      empty.hidden = false;
      return;
    }

    if (row.title) title.textContent = row.title;
    if (row.description) description.textContent = row.description;

    player.replaceChildren();
    if (row.vimeo_id) {
      empty.hidden = true;
      player.appendChild(vimeoEmbed(row.vimeo_id));
      return;
    }

    if (row.videoUrl) {
      empty.hidden = true;
      player.appendChild(filePlayer(row.videoUrl));
      return;
    }

    empty.hidden = false;
  }

  document.addEventListener("esl:portal-ready", function () {
    loadVideo().catch(function (error) {
      var message = (error && error.message) || "Could not load the training video.";
      if (/training_videos/i.test(message)) {
        message = "Training videos are not set up yet. Run supabase/schema.sql in the Supabase SQL Editor.";
      }
      window.ESLPortal.showMessage(message, true);
    });
  });
})();
