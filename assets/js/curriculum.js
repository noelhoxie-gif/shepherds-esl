(function () {
  "use strict";

  var list = document.getElementById("curriculum-list");
  var empty = document.getElementById("curriculum-empty");

  function itemCard(item) {
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
    } else if (item.fileUrl) {
      var fileLink = document.createElement("a");
      fileLink.href = item.fileUrl;
      fileLink.target = "_blank";
      fileLink.rel = "noopener";
      fileLink.textContent = "Open file";
      article.appendChild(fileLink);
    }

    return article;
  }

  document.addEventListener("esl:portal-ready", function () {
    window.ESLPortal
      .api("curriculum")
      .then(function (data) {
        var items = data.items || [];
        empty.hidden = items.length > 0;
        list.replaceChildren();
        items.forEach(function (item) {
          list.appendChild(itemCard(item));
        });
      })
      .catch(function (error) {
        window.ESLPortal.showMessage(
          (error && error.message) || "Could not load the curriculum.",
          true
        );
      });
  });
})();
