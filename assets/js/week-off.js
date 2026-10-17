(function () {
  "use strict";

  var form = document.getElementById("week-off-form");
  var dateInput = document.getElementById("week-off-date");
  var status = document.getElementById("week-off-status");
  var list = document.getElementById("week-off-list");
  var empty = document.getElementById("week-off-empty");
  var session;

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
    var result = await window.ESL.client()
      .from("week_off_requests")
      .select("id, week_of, assignment, note, status, created_at")
      .eq("user_id", session.user.id)
      .order("week_of", { ascending: false });

    if (result.error) throw result.error;
    var requests = result.data || [];
    empty.hidden = requests.length > 0;
    list.replaceChildren();
    requests.forEach(function (request) {
      list.appendChild(requestCard(request));
    });
  }

  function showError(error) {
    var message = (error && error.message) || "Could not save the request.";
    if (/week_off_requests/i.test(message)) {
      message = "Week-off requests are not set up yet. Run supabase/schema.sql in the Supabase SQL Editor.";
    }
    status.textContent = "";
    window.ESLPortal.showMessage(message, true);
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

    window.ESL.client()
      .from("week_off_requests")
      .upsert(
        {
          user_id: session.user.id,
          volunteer_email: session.user.email || "",
          week_of: dateInput.value,
          assignment: form.elements.assignment.value.trim() || null,
          note: form.elements.note.value.trim() || null,
          status: "submitted"
        },
        { onConflict: "user_id,week_of" }
      )
      .select()
      .then(function (result) {
        if (result.error) throw result.error;
        status.textContent = "Your week-off request has been submitted.";
        form.reset();
        return loadRequests();
      })
      .catch(showError)
      .finally(function () {
        submit.disabled = false;
      });
  });

  document.addEventListener("esl:portal-ready", function (event) {
    session = event.detail.session;
    loadRequests().catch(showError);
  });
})();
