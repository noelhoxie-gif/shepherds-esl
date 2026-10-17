(function () {
  "use strict";

  var form = document.getElementById("week-off-form");
  var dateInput = document.getElementById("week-off-date");
  var status = document.getElementById("week-off-status");
  var list = document.getElementById("week-off-list");
  var empty = document.getElementById("week-off-empty");

  function formatDate(value) {
    return new Date(value + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  function requestCard(request) {
    var article = document.createElement("article");
    article.className = "card request-item";

    var label = document.createElement("span");
    label.className = "pill";
    label.textContent = request.status || "Submitted";
    article.appendChild(label);

    var heading = document.createElement("h3");
    heading.textContent = formatDate(request.week_of);
    article.appendChild(heading);

    if (request.volunteer_name) {
      var name = document.createElement("p");
      name.textContent = request.volunteer_name;
      article.appendChild(name);
    }
    if (request.class_level) {
      var level = document.createElement("p");
      level.textContent = "Level " + request.class_level;
      article.appendChild(level);
    }
    if (request.assignment) {
      var assignment = document.createElement("p");
      assignment.textContent = request.assignment;
      article.appendChild(assignment);
    }
    if (request.note) {
      var note = document.createElement("p");
      note.textContent = request.note;
      article.appendChild(note);
    }
    return article;
  }

  async function loadRequests() {
    var result = await window.ESLPortal.api("week-off");
    var requests = result.items || [];
    empty.hidden = requests.length > 0;
    list.replaceChildren();
    requests.forEach(function (request) {
      list.appendChild(requestCard(request));
    });
  }

  function showError(error) {
    status.textContent = "";
    window.ESLPortal.showMessage(
      (error && error.message) || "Could not save the request.",
      true
    );
  }

  dateInput.addEventListener("change", function () {
    if (!dateInput.value) return;
    var selected = new Date(dateInput.value + "T12:00:00");
    dateInput.setCustomValidity(
      selected.getDay() === 5 ? "" : "Please select the Friday you will miss."
    );
    dateInput.reportValidity();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    status.textContent = "Submitting…";
    var submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    var requestedDate = dateInput.value;

    window.ESLPortal
      .api("week-off", {
        method: "POST",
        body: {
          volunteer_name: form.elements.volunteer_name.value.trim(),
          volunteer_email: form.elements.volunteer_email.value.trim(),
          week_of: dateInput.value,
          class_level: form.elements.class_level.value,
          assignment: form.elements.assignment.value.trim(),
          note: form.elements.note.value.trim()
        }
      })
      .then(function () {
        status.textContent = "Your week-off request has been submitted. Opening the calendar…";
        window.location.assign("class-calendar.html?month=" + requestedDate.slice(0, 7));
      })
      .catch(function (error) {
        showError(error);
        submit.disabled = false;
      });
  });

  var signedInUser = null;

  function prefill() {
    if (!signedInUser) return;
    form.elements.volunteer_email.value = signedInUser.email || "";
    if (!form.elements.volunteer_name.value) {
      form.elements.volunteer_name.value = signedInUser.displayName || signedInUser.username || "";
    }
  }

  form.addEventListener("reset", function () {
    setTimeout(prefill, 0);
  });

  document.addEventListener("esl:portal-ready", function (event) {
    signedInUser = (event.detail && event.detail.user) || null;
    window.ESLLevels.fillSelect(form.elements.class_level);
    prefill();
    loadRequests().catch(showError);
  });
})();
