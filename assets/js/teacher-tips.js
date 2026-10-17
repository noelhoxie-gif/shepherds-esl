(function () {
  "use strict";

  var list = document.getElementById("teacher-tips-list");
  var empty = document.getElementById("teacher-tips-empty");

  function tipCard(tip) {
    var article = document.createElement("article");
    article.className = "card announcement-card";

    var heading = document.createElement("h3");
    heading.textContent = tip.title;
    article.appendChild(heading);

    var body = document.createElement("p");
    body.textContent = tip.body;
    article.appendChild(body);
    return article;
  }

  async function loadTips() {
    var result = await window.ESL.client()
      .from("teacher_tips")
      .select("id, display_order, title, body")
      .eq("active", true)
      .order("display_order");

    if (result.error) throw result.error;
    var tips = result.data || [];
    empty.hidden = tips.length > 0;
    list.replaceChildren();
    tips.forEach(function (tip) {
      list.appendChild(tipCard(tip));
    });
  }

  document.addEventListener("esl:portal-ready", function () {
    loadTips().catch(function (error) {
      var message = (error && error.message) || "Could not load teacher tips.";
      if (/teacher_tips/i.test(message)) {
        message = "The teacher tips page is not set up yet. Run supabase/schema.sql in the Supabase SQL Editor.";
      }
      window.ESLPortal.showMessage(message, true);
    });
  });
})();
