(function () {
  "use strict";

  var announcementForm = document.getElementById("announcement-form");
  var classForm = document.getElementById("class-form");
  var copyForm = document.getElementById("copy-form");
  var classes = [];
  var range = classRange();

  function dateKey(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function formatDate(value) {
    return new Date(String(value).slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  function classRange() {
    var cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    cursor.setDate(cursor.getDate() + ((5 - cursor.getDay() + 7) % 7) - 56);
    var first = dateKey(cursor);
    var last = new Date(cursor);
    last.setDate(last.getDate() + 47 * 7);
    return { from: first, to: dateKey(last), start: cursor };
  }

  function fillFridays(select, includeBlank) {
    if (!select) return;
    select.replaceChildren();
    if (includeBlank) {
      var blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Select a Friday";
      select.appendChild(blank);
    }
    var cursor = new Date(range.start);
    for (var i = 0; i < 48; i++) {
      var option = document.createElement("option");
      option.value = dateKey(cursor);
      option.textContent = formatDate(option.value);
      select.appendChild(option);
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  function setStatus(id, message) {
    var el = document.getElementById(id);
    if (el) el.textContent = message || "";
  }

  function showPanel(name) {
    document.querySelectorAll(".admin-panel").forEach(function (panel) {
      panel.hidden = panel.id !== "panel-" + name;
    });
    document.querySelectorAll(".admin-tabs button").forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-panel") === name);
    });
  }

  function admin(action, extra) {
    var body = Object.assign({ action: action }, extra || {});
    return window.ESLPortal.api("admin", { method: "POST", body: body });
  }

  function button(label, className, onClick) {
    var el = document.createElement("button");
    el.type = "button";
    el.className = className;
    el.textContent = label;
    el.addEventListener("click", onClick);
    return el;
  }

  function resetAnnouncement() {
    announcementForm.reset();
    announcementForm.elements.id.value = "";
    announcementForm.elements.published.checked = true;
    document.getElementById("announcement-form-title").textContent = "New announcement";
    setStatus("announcement-status", "");
  }

  function resetClass() {
    classForm.reset();
    classForm.elements.id.value = "";
    document.getElementById("class-form-title").textContent = "Add a Friday class";
    window.ESLLevels.fillSelect(classForm.elements.class_level);
    setStatus("class-status", "");
  }

  function renderAnnouncements(items) {
    var list = document.getElementById("announcement-admin-list");
    list.replaceChildren();
    if (!items.length) {
      var empty = document.createElement("p");
      empty.className = "portal-empty";
      empty.textContent = "No announcements yet.";
      list.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var article = document.createElement("article");
      article.className = "card request-item";
      var pill = document.createElement("span");
      pill.className = "pill" + (item.published ? "" : " red");
      pill.textContent = item.published ? "Published" : "Hidden";
      article.appendChild(pill);
      var heading = document.createElement("h3");
      heading.textContent = item.title;
      article.appendChild(heading);
      var body = document.createElement("p");
      body.textContent = item.body;
      article.appendChild(body);
      var actions = document.createElement("div");
      actions.className = "admin-actions";
      actions.appendChild(
        button("Edit", "portal-button", function () {
          announcementForm.elements.id.value = item.id;
          announcementForm.elements.title.value = item.title;
          announcementForm.elements.body.value = item.body;
          announcementForm.elements.published.checked = item.published !== false;
          document.getElementById("announcement-form-title").textContent = "Edit announcement";
          announcementForm.scrollIntoView({ behavior: "smooth", block: "start" });
        })
      );
      actions.appendChild(
        button("Remove", "portal-button", function () {
          if (!window.confirm("Remove this announcement?")) return;
          admin("delete-announcement", { id: item.id })
            .then(function (data) {
              renderAnnouncements(data.items || []);
            })
            .catch(fail);
        })
      );
      article.appendChild(actions);
      list.appendChild(article);
    });
  }

  function classCard(item) {
    var article = document.createElement("article");
    article.className = "card request-item";
    if (item.class_level) {
      var pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = "Level " + item.class_level;
      article.appendChild(pill);
    }
    var heading = document.createElement("h3");
    heading.textContent = item.class_name || "Class";
    article.appendChild(heading);
    var when = document.createElement("p");
    when.textContent = formatDate(item.session_date) + (item.starts_at ? " · " + item.starts_at : "");
    article.appendChild(when);
    var place = [item.building, item.room].filter(Boolean).join(" · ");
    if (place) {
      var loc = document.createElement("p");
      loc.textContent = place;
      article.appendChild(loc);
    }
    if (item.volunteer_assignment) {
      var who = document.createElement("p");
      who.textContent = "Assignment: " + item.volunteer_assignment;
      article.appendChild(who);
    }
    var actions = document.createElement("div");
    actions.className = "admin-actions";
    actions.appendChild(
      button("Edit", "portal-button", function () {
        fillClassForm(item);
        showPanel("classes");
        classForm.scrollIntoView({ behavior: "smooth", block: "start" });
      })
    );
    actions.appendChild(
      button("Remove", "portal-button", function () {
        if (!window.confirm("Remove this class?")) return;
        admin("delete-class", { id: item.id, from: range.from, to: range.to })
          .then(function (data) {
            classes = data.items || [];
            renderClasses();
            renderAssignments();
          })
          .catch(fail);
      })
    );
    article.appendChild(actions);
    return article;
  }

  function fillClassForm(item) {
    classForm.elements.id.value = item.id || "";
    classForm.elements.session_date.value = item.session_date || "";
    classForm.elements.starts_at.value = item.starts_at || "";
    classForm.elements.class_name.value = item.class_name || "";
    window.ESLLevels.fillSelect(classForm.elements.class_level, item.class_level || "");
    classForm.elements.building.value = item.building || "";
    classForm.elements.room.value = item.room || "";
    classForm.elements.volunteer_assignment.value = item.volunteer_assignment || "";
    classForm.elements.notes.value = item.notes || "";
    document.getElementById("class-form-title").textContent = item.id ? "Edit class" : "Add a Friday class";
  }

  function renderClasses() {
    var list = document.getElementById("class-admin-list");
    list.replaceChildren();
    if (!classes.length) {
      var empty = document.createElement("p");
      empty.className = "portal-empty";
      empty.textContent = "No classes are listed yet.";
      list.appendChild(empty);
      return;
    }
    var groups = {};
    classes.forEach(function (item) {
      var key = item.session_date || "";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    Object.keys(groups)
      .sort()
      .forEach(function (key) {
        var heading = document.createElement("h3");
        heading.className = "admin-group-title";
        heading.textContent = formatDate(key);
        list.appendChild(heading);
        groups[key].forEach(function (item) {
          list.appendChild(classCard(item));
        });
      });
  }

  function renderAssignments() {
    var friday = document.getElementById("assignment-friday").value;
    var list = document.getElementById("assignment-list");
    var empty = document.getElementById("assignment-empty");
    var rows = classes.filter(function (item) {
      return item.session_date === friday;
    });
    list.replaceChildren();
    empty.hidden = rows.length > 0;
    rows.forEach(function (item) {
      var article = document.createElement("article");
      article.className = "card request-item";
      var heading = document.createElement("h3");
      heading.textContent = item.class_name + (item.class_level ? " · Level " + item.class_level : "");
      article.appendChild(heading);
      var place = [item.building, item.room].filter(Boolean).join(" · ");
      if (place) {
        var loc = document.createElement("p");
        loc.textContent = place;
        article.appendChild(loc);
      }
      var form = document.createElement("form");
      form.className = "portal-form";
      var label = document.createElement("label");
      label.textContent = "Volunteer assignment";
      var input = document.createElement("input");
      input.type = "text";
      input.maxLength = 160;
      input.value = item.volunteer_assignment || "";
      var save = document.createElement("button");
      save.className = "btn btn-flat";
      save.type = "submit";
      save.textContent = "Save assignment";
      form.appendChild(label);
      form.appendChild(input);
      form.appendChild(save);
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        save.disabled = true;
        admin(
          "save-class",
          Object.assign({}, item, {
            volunteer_assignment: input.value.trim(),
            from: range.from,
            to: range.to
          })
        )
          .then(function (data) {
            classes = data.items || [];
            renderClasses();
            renderAssignments();
          })
          .catch(fail)
          .finally(function () {
            save.disabled = false;
          });
      });
      article.appendChild(form);
      list.appendChild(article);
    });
  }

  function renderRequests(items) {
    var list = document.getElementById("request-admin-list");
    var empty = document.getElementById("request-empty");
    list.replaceChildren();
    empty.hidden = items.length > 0;
    items.forEach(function (item) {
      var article = document.createElement("article");
      article.className = "card request-item";
      var heading = document.createElement("h3");
      heading.textContent = formatDate(item.week_of);
      article.appendChild(heading);
      var name = document.createElement("p");
      name.textContent = item.volunteer_name || item.volunteer_email || "Volunteer";
      article.appendChild(name);
      if (item.class_level) {
        var level = document.createElement("p");
        level.textContent = "Level " + item.class_level;
        article.appendChild(level);
      }
      if (item.assignment) {
        var assignment = document.createElement("p");
        assignment.textContent = item.assignment;
        article.appendChild(assignment);
      }
      if (item.note) {
        var note = document.createElement("p");
        note.textContent = item.note;
        article.appendChild(note);
      }
      var label = document.createElement("label");
      label.textContent = "Status";
      var select = document.createElement("select");
      ["submitted", "reviewed", "approved"].forEach(function (status) {
        var option = document.createElement("option");
        option.value = status;
        option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        if (status === (item.status || "submitted")) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener("change", function () {
        admin("update-request", { id: item.id, status: select.value })
          .then(function (data) {
            renderRequests(data.items || []);
          })
          .catch(fail);
      });
      article.appendChild(label);
      article.appendChild(select);
      list.appendChild(article);
    });
  }

  function fail(error) {
    window.ESLPortal.showMessage((error && error.message) || "Could not save the change.", true);
  }

  function loadAll() {
    return Promise.all([
      window.ESLPortal.api("admin", { query: { kind: "announcements" } }),
      window.ESLPortal.api("admin", { query: { kind: "classes", from: range.from, to: range.to } }),
      window.ESLPortal.api("admin", { query: { kind: "requests" } })
    ]).then(function (results) {
      renderAnnouncements((results[0] && results[0].items) || []);
      classes = (results[1] && results[1].items) || [];
      renderClasses();
      renderAssignments();
      renderRequests((results[2] && results[2].items) || []);
    });
  }

  document.querySelectorAll(".admin-tabs button").forEach(function (button) {
    button.addEventListener("click", function () {
      showPanel(button.getAttribute("data-panel"));
    });
  });

  document.getElementById("announcement-cancel").addEventListener("click", resetAnnouncement);
  document.getElementById("class-cancel").addEventListener("click", resetClass);
  document.getElementById("assignment-friday").addEventListener("change", renderAssignments);

  announcementForm.addEventListener("submit", function (event) {
    event.preventDefault();
    setStatus("announcement-status", "Saving…");
    admin("save-announcement", {
      id: announcementForm.elements.id.value || null,
      title: announcementForm.elements.title.value.trim(),
      body: announcementForm.elements.body.value.trim(),
      published: announcementForm.elements.published.checked
    })
      .then(function (data) {
        resetAnnouncement();
        renderAnnouncements(data.items || []);
        setStatus("announcement-status", "Announcement saved.");
      })
      .catch(function (error) {
        setStatus("announcement-status", "");
        fail(error);
      });
  });

  classForm.addEventListener("submit", function (event) {
    event.preventDefault();
    setStatus("class-status", "Saving…");
    admin("save-class", {
      id: classForm.elements.id.value || null,
      session_date: classForm.elements.session_date.value,
      starts_at: classForm.elements.starts_at.value,
      class_name: classForm.elements.class_name.value.trim(),
      class_level: classForm.elements.class_level.value,
      building: classForm.elements.building.value.trim(),
      room: classForm.elements.room.value.trim(),
      volunteer_assignment: classForm.elements.volunteer_assignment.value.trim(),
      notes: classForm.elements.notes.value.trim(),
      from: range.from,
      to: range.to
    })
      .then(function (data) {
        classes = data.items || [];
        resetClass();
        renderClasses();
        renderAssignments();
        setStatus("class-status", "Class saved.");
      })
      .catch(function (error) {
        setStatus("class-status", "");
        fail(error);
      });
  });

  copyForm.addEventListener("submit", function (event) {
    event.preventDefault();
    setStatus("copy-status", "Copying…");
    admin("copy-classes", {
      from: copyForm.elements.from.value,
      to: copyForm.elements.to.value
    })
      .then(function () {
        return window.ESLPortal.api("admin", {
          query: { kind: "classes", from: range.from, to: range.to }
        });
      })
      .then(function (data) {
        classes = data.items || [];
        renderClasses();
        renderAssignments();
        setStatus("copy-status", "Classes copied.");
      })
      .catch(function (error) {
        setStatus("copy-status", "");
        fail(error);
      });
  });

  document.addEventListener("esl:portal-ready", function () {
    fillFridays(classForm.elements.session_date, true);
    fillFridays(copyForm.elements.from, true);
    fillFridays(copyForm.elements.to, true);
    fillFridays(document.getElementById("assignment-friday"), false);
    window.ESLLevels.fillSelect(classForm.elements.class_level);
    var assignmentFriday = document.getElementById("assignment-friday");
    var today = dateKey(new Date());
    Array.prototype.some.call(assignmentFriday.options, function (option) {
      if (option.value >= today) {
        assignmentFriday.value = option.value;
        return true;
      }
      return false;
    });
    loadAll().catch(fail);
  });
})();
