(function () {
  "use strict";

  var list = document.getElementById("bible-study-list");
  var empty = document.getElementById("bible-study-empty");

  function detail(label, value) {
    if (!value) return null;
    var paragraph = document.createElement("p");
    var strong = document.createElement("strong");
    strong.textContent = label + ": ";
    paragraph.appendChild(strong);
    paragraph.appendChild(document.createTextNode(value));
    return paragraph;
  }

  function studyCard(study) {
    var article = document.createElement("article");
    article.className = "card bible-study-card";

    var number = document.createElement("span");
    number.className = "pill";
    number.textContent = "Bible Study " + study.display_order;
    article.appendChild(number);

    var title = document.createElement("h3");
    title.textContent = study.name;
    article.appendChild(title);

    [
      detail("Meets", study.meeting_time),
      detail("Location", study.location),
      detail("Contact", study.contact_name)
    ].forEach(function (node) {
      if (node) article.appendChild(node);
    });

    if (study.contact_email) {
      var email = document.createElement("a");
      email.href = "mailto:" + study.contact_email;
      email.textContent = study.contact_email;
      article.appendChild(email);
    }

    if (study.contact_phone) {
      var phone = document.createElement("p");
      var link = document.createElement("a");
      link.href = "tel:" + study.contact_phone.replace(/[^\d+]/g, "");
      link.textContent = study.contact_phone;
      phone.appendChild(link);
      article.appendChild(phone);
    }

    return article;
  }

  async function loadStudies() {
    var result = await window.ESL.client()
      .from("bible_studies")
      .select("id, display_order, name, meeting_time, location, contact_name, contact_email, contact_phone")
      .eq("active", true)
      .order("display_order")
      .limit(10);

    if (result.error) throw result.error;
    var studies = result.data || [];
    empty.hidden = studies.length > 0;
    list.replaceChildren();
    studies.forEach(function (study) {
      list.appendChild(studyCard(study));
    });
  }

  document.addEventListener("esl:portal-ready", function () {
    loadStudies().catch(function (error) {
      var message = (error && error.message) || "Could not load Bible studies.";
      if (/bible_studies/i.test(message)) {
        message = "The Bible study directory is not set up yet. Run supabase/schema.sql in the Supabase SQL Editor.";
      }
      window.ESLPortal.showMessage(message, true);
    });
  });
})();
