(function () {
  "use strict";

  var kind = document.body.getAttribute("data-training-kind");
  var title = document.getElementById("training-title");
  var description = document.getElementById("training-description");
  var player = document.getElementById("training-player");
  var empty = document.getElementById("training-empty");

  function iframePlayer(src) {
    var wrap = document.createElement("div");
    wrap.className = "video-embed";
    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = title.textContent;
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    wrap.appendChild(iframe);
    return wrap;
  }

  function vimeoEmbed(id) {
    return iframePlayer("https://player.vimeo.com/video/" + encodeURIComponent(String(id).replace(/\D/g, "")));
  }

  function driveEmbed(url) {
    var match = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
    var id = match ? match[1] : "";
    if (!id) return null;
    return iframePlayer("https://drive.google.com/file/d/" + id + "/preview");
  }

  function filePlayer(url) {
    if (/drive\.google\.com/.test(url)) return driveEmbed(url);
    var video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata";
    video.src = url;
    video.className = "training-video";
    return video;
  }

  function showPlayer(node) {
    if (!node) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    player.replaceChildren();
    player.appendChild(node);
  }

  async function loadVideo() {
    var fallback = document.body.getAttribute("data-default-video");
    var row = null;
    try {
      var result = await window.ESLPortal.api("training", { query: { kind: kind } });
      row = result.item;
    } catch (err) {
      if (!fallback) throw err;
    }

    if (row) {
      if (row.title) title.textContent = row.title;
      if (row.description) description.textContent = row.description;
      if (row.vimeo_id) {
        showPlayer(vimeoEmbed(row.vimeo_id));
        return;
      }
      if (row.videoUrl) {
        showPlayer(filePlayer(row.videoUrl));
        return;
      }
    }

    if (fallback) {
      showPlayer(filePlayer(fallback));
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
