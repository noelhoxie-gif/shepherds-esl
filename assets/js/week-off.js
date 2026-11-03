(function () {
  "use strict";

  var form = document.getElementById("week-off-form");
  var dateInput = document.getElementById("week-off-date");
  var status = document.getElementById("week-off-status");
  var list = document.getElementById("week-off-list");
  var empty = document.getElementById("week-off-empty");

  function formatDate(value) {
    return new Date(String(value).slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  function dateKey(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function fillFridayOptions() {
    dateInput.replaceChildren();
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a Friday";
    dateInput.appendChild(placeholder);

    var cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    var daysUntilFriday = (5 - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + daysUntilFriday);

    for (var i = 0; i < 40; i++) {
      var option = document.createElement("option");
      option.value = dateKey(cursor);
      option.textContent = formatDate(option.value);
      dateInput.appendChild(option);
      cursor.setDate(cursor.getDate() + 7);
    }
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
      level.textContent = "Area " + request.class_level;
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

  function attendanceNotifyEmails() {
    var configured = window.ESL_NOTIFY && window.ESL_NOTIFY.emails;
    if (configured && configured.length) return configured;
    return ["larryphoxie@gmail.com"];
  }

  function sendAttendanceEmail(item) {
    var friday = formatDate(item.week_of);
    var text = [
      "A volunteer submitted an attendance / week-off request.",
      "",
      "Name: " + (item.volunteer_name || ""),
      "Email: " + (item.volunteer_email || ""),
      "Friday: " + friday,
      "Area: " + (item.class_level || ""),
      "Assignment: " + (item.assignment || ""),
      "Note: " + (item.note || ""),
      "Status: " + (item.status || "submitted")
    ].join("\n");
    var subject = "ESL attendance request: " + (item.volunteer_name || "volunteer") + " · " + friday;
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
    var signal = controller ? controller.signal : undefined;
    var body = new URLSearchParams();
    body.set("_subject", subject);
    body.set("_replyto", item.volunteer_email || "");
    body.set("name", item.volunteer_name || "");
    body.set("email", item.volunteer_email || "");
    body.set("friday", friday);
    body.set("area", item.class_level || "");
    body.set("assignment", item.assignment || "");
    body.set("note", item.note || "");
    body.set("message", text);
    return Promise.all(
      attendanceNotifyEmails().map(function (to) {
        return fetch("https://flowform.to/" + encodeURIComponent(to), {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: body.toString(),
          signal: signal
        }).then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok || !data || data.success === false) {
              throw new Error((data && data.message) || "Attendance email was not accepted.");
            }
          });
        });
      })
    ).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

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
      .then(function (result) {
        var saved = (result && result.item) || {};
        var pending = {
          week_of: String(saved.week_of || requestedDate).slice(0, 10),
          volunteer_name: saved.volunteer_name || form.elements.volunteer_name.value.trim(),
          volunteer_email: saved.volunteer_email || form.elements.volunteer_email.value.trim(),
          class_level: saved.class_level || form.elements.class_level.value,
          assignment: saved.assignment || form.elements.assignment.value.trim(),
          note: saved.note || form.elements.note.value.trim(),
          status: saved.status || "submitted"
        };
        try {
          window.sessionStorage.setItem("esl-pending-off", JSON.stringify(pending));
        } catch (err) {}
        return sendAttendanceEmail(pending)
          .catch(function () {})
          .then(function () {
            window.location.assign(
              "class-calendar.html?month=" + requestedDate.slice(0, 7) + "&off=" + requestedDate
            );
          });
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
    window.ESLLevels.fillSelect(form.elements.class_level, "", "Select an area");
    fillFridayOptions();
    prefill();
    loadRequests().catch(showError);
  });
})();
