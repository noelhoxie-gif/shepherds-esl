(function () {
  "use strict";

  var grid = document.getElementById("class-calendar-grid");
  var monthLabel = document.getElementById("calendar-month");
  var empty = document.getElementById("calendar-empty");
  var currentMonth = new Date();
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  var sessions = [];

  function dateKey(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function readableTime(value) {
    if (!value) return "";
    var parts = value.split(":");
    var hour = Number(parts[0]);
    var suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return hour + ":" + parts[1] + " " + suffix;
  }

  function sessionItem(item) {
    var entry = document.createElement("div");
    entry.className = "calendar-event";

    var title = document.createElement("strong");
    title.textContent = item.class_name;
    entry.appendChild(title);

    var location = document.createElement("span");
    location.textContent = [item.building, item.room].filter(Boolean).join(" · ");
    entry.appendChild(location);

    if (item.starts_at) {
      var time = document.createElement("span");
      time.textContent = readableTime(item.starts_at);
      entry.appendChild(time);
    }

    if (item.volunteer_assignment) {
      var assignment = document.createElement("span");
      assignment.textContent = item.volunteer_assignment;
      entry.appendChild(assignment);
    }

    return entry;
  }

  function render() {
    grid.replaceChildren();
    monthLabel.textContent = currentMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric"
    });

    var year = currentMonth.getFullYear();
    var month = currentMonth.getMonth();
    var firstWeekday = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    var hasEvents = false;

    for (var index = 0; index < cellCount; index++) {
      var dayNumber = index - firstWeekday + 1;
      var cell = document.createElement("div");
      cell.className = "calendar-day";
      cell.setAttribute("role", "gridcell");

      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cell.classList.add("is-outside");
        grid.appendChild(cell);
        continue;
      }

      var date = new Date(year, month, dayNumber);
      var key = dateKey(date);
      var number = document.createElement("span");
      number.className = "calendar-day-number";
      number.textContent = dayNumber;
      cell.appendChild(number);
      cell.setAttribute(
        "aria-label",
        date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric"
        })
      );

      sessions
        .filter(function (item) {
          return item.session_date === key;
        })
        .forEach(function (item) {
          hasEvents = true;
          cell.appendChild(sessionItem(item));
        });

      grid.appendChild(cell);
    }

    empty.hidden = hasEvents;
  }

  async function loadMonth() {
    var year = currentMonth.getFullYear();
    var month = currentMonth.getMonth();
    var first = dateKey(new Date(year, month, 1));
    var last = dateKey(new Date(year, month + 1, 0));
    var result = await window.ESL.client()
      .from("class_sessions")
      .select("id, session_date, starts_at, class_name, building, room, volunteer_assignment")
      .gte("session_date", first)
      .lte("session_date", last)
      .order("session_date")
      .order("starts_at");

    if (result.error) throw result.error;
    sessions = result.data || [];
    render();
  }

  function changeMonth(offset) {
    currentMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + offset,
      1
    );
    loadMonth().catch(showError);
  }

  function showError(error) {
    var message = (error && error.message) || "Could not load the class calendar.";
    if (/class_sessions/i.test(message)) {
      message = "The class calendar is not set up yet. Run supabase/schema.sql in the Supabase SQL Editor.";
    }
    window.ESLPortal.showMessage(message, true);
  }

  document.getElementById("calendar-previous").addEventListener("click", function () {
    changeMonth(-1);
  });
  document.getElementById("calendar-next").addEventListener("click", function () {
    changeMonth(1);
  });
  document.getElementById("calendar-today").addEventListener("click", function () {
    var today = new Date();
    currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    loadMonth().catch(showError);
  });

  document.addEventListener("esl:portal-ready", function () {
    loadMonth().catch(showError);
  });
})();
