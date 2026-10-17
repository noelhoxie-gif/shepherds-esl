(function () {
  "use strict";

  var list = document.getElementById("curriculum-list");
  var empty = document.getElementById("curriculum-empty");

  function itemCard(item, fileUrl) {
    var article = document.createElement("article");
    article.className = "card";

    var title = document.createElement("h3");
    title.textContent = item.title;
    article.appendChild(title);

    if (item.description) {
      var body = document.createElement("p");
      body.textContent = item.description;
      article.appendChild(body);
    }

    if (item.url) {
      var link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Open material";
      article.appendChild(link);
    } else if (fileUrl) {
      var fileLink = document.createElement("a");
      fileLink.href = fileUrl;
      fileLink.target = "_blank";
      fileLink.rel = "noopener";
      fileLink.textContent = "Open file";
      article.appendChild(fileLink);
    }

    return article;
  }

  async function loadCurriculum() {
    var result = await window.ESL.client()
      .from("curriculum_items")
      .select("id, display_order, title, description, url, file_path")
      .eq("active", true)
      .order("display_order");

    if (result.error) throw result.error;
    var items = result.data || [];
    empty.hidden = items.length > 0;
    list.replaceChildren();

    for (var i = 0; i < items.length; i++) {
      var fileUrl = await window.ESLPortal.signedMediaUrl(items[i].file_path);
      list.appendChild(itemCard(items[i], fileUrl));
    }
  }

  document.addEventListener("esl:portal-ready", function () {
    loadCurriculum().catch(function (error) {
      var message = (error && error.message) || "Could not load the curriculum.";
      if (/curriculum_items/i.test(message)) {
        message = "The curriculum page is not set up yet. Run supabase/schema.sql in the Supabase SQL Editor.";
      }
      window.ESLPortal.showMessage(message, true);
    });
  });
})();
