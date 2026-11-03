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
    var timer = controller ? setTimeout(function () { controller.abort(); }, 6000) : null;
    var signal = controller ? controller.signal : undefined;
    var web3Key = window.ESL_NOTIFY && window.ESL_NOTIFY.web3formsKey;
    var task;
    if (web3Key) {
      task = fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: web3Key,
          subject: subject,
          from_name: "ESL Attendance",
          name: item.volunteer_name || "",
          email: item.volunteer_email || "",
          friday: friday,
          area: item.class_level || "",
          assignment: item.assignment || "",
          note: item.note || "",
          message: text
        }),
        signal: signal
      }).then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok || !body || body.success === false) {
            throw new Error((body && body.message) || "Attendance email was not accepted.");
          }
        });
      });
    } else {
      var payload = {
        _subject: subject,
        _captcha: "false",
        _template: "table",
        name: item.volunteer_name || "",
        email: item.volunteer_email || "",
        friday: friday,
        area: item.class_level || "",
        assignment: item.assignment || "",
        note: item.note || "",
        message: text
      };
      task = Promise.all(
        attendanceNotifyEmails().map(function (to) {
          return fetch("https://formsubmit.co/ajax/" + encodeURIComponent(to), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload),
            signal: signal
          }).then(function (response) {
            return response.text().then(function (body) {
              if (!response.ok || /522|521|error code/i.test(body)) {
                throw new Error("Attendance email was not accepted.");
              }
            });
          });
        })
      );
    }
    return task.finally(function () {
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
