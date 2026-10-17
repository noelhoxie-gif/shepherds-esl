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

  document.addEventListener("esl:portal-ready", function () {
    window.ESLPortal
      .api("teacher-tips")
      .then(function (data) {
        var tips = data.items || [];
        empty.hidden = tips.length > 0;
        list.replaceChildren();
        tips.forEach(function (tip) {
          list.appendChild(tipCard(tip));
        });
      })
      .catch(function (error) {
        window.ESLPortal.showMessage(
          (error && error.message) || "Could not load teacher tips.",
          true
        );
      });
  });
})();
