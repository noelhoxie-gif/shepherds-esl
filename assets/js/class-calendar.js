(function () {
  "use strict";

  var grid = document.getElementById("class-calendar-grid");
  var monthLabel = document.getElementById("calendar-month");
  var empty = document.getElementById("calendar-empty");
  var filters = document.getElementById("level-filters");
  var sessions = [];
  var daysOff = [];
  var selectedLevel = "";

  function startOfWeek(date) {
    var value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    value.setDate(value.getDate() - value.getDay());
    return value;
  }

  var currentWeek = startOfWeek(new Date());

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

  function itemLevel(item) {
    return item.class_level || window.ESLLevels.fromText(item.class_name || item.assignment || "");
  }

  function matchesFilter(level) {
    return !selectedLevel || level === selectedLevel;
  }

  function eventEl(options) {
    var entry = document.createElement("div");
    entry.className = "calendar-event" + (options.off ? " is-off" : "");
    if (options.level) {
      entry.classList.add(window.ESLLevels.slug(options.level));
      entry.setAttribute("data-level", options.level);
    }

    var title = document.createElement("strong");
    title.textContent = options.title;
    entry.appendChild(title);

    (options.lines || []).forEach(function (line) {
      if (!line) return;
      var span = document.createElement("span");
      span.textContent = line;
      entry.appendChild(span);
    });
    return entry;
  }

  function sessionItem(item) {
    var level = itemLevel(item);
    return eventEl({
      level: level,
      title: item.class_name || level || "Class",
      lines: [
        level ? "Level " + level : "",
        [item.building, item.room].filter(Boolean).join(" · "),
        readableTime(item.starts_at),
        item.volunteer_assignment
      ]
    });
  }

  function offItem(item) {
    var level = itemLevel(item);
    return eventEl({
      off: true,
      level: level,
      title: "Off · " + (item.volunteer_name || "Volunteer"),
      lines: [level ? "Level " + level : "", item.assignment, item.note]
    });
  }

  function renderFilters() {
    filters.replaceChildren();
    var all = document.createElement("button");
    all.type = "button";
    all.className = "level-chip" + (selectedLevel ? "" : " is-active");
    all.textContent = "All levels";
    all.addEventListener("click", function () {
      selectedLevel = "";
      render();
    });
    filters.appendChild(all);

    window.ESLLevels.list.forEach(function (level) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "level-chip " + window.ESLLevels.slug(level) + (selectedLevel === level ? " is-active" : "");
      chip.textContent = level;
      chip.addEventListener("click", function () {
        selectedLevel = level;
        render();
      });
      filters.appendChild(chip);
    });
  }

  function render() {
    renderFilters();
    grid.replaceChildren();
    var sunday = currentWeek;
    var saturday = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 6);
    monthLabel.textContent =
      "Week of " +
      sunday.toLocaleDateString("en-US", { month: "long", day: "numeric" }) +
      " – " +
      saturday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    var hasEvents = false;
    for (var offset = 0; offset < 7; offset++) {
      var date = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + offset);
      var key = dateKey(date);
      var cell = document.createElement("div");
      cell.className = "calendar-day";
      cell.setAttribute("role", "gridcell");

      var number = document.createElement("span");
      number.className = "calendar-day-number";
      number.textContent = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      cell.appendChild(number);
      cell.setAttribute(
        "aria-label",
        date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      );

      sessions
        .filter(function (item) {
          return item.session_date === key && matchesFilter(itemLevel(item));
        })
        .forEach(function (item) {
          hasEvents = true;
          cell.appendChild(sessionItem(item));
        });

      daysOff
        .filter(function (item) {
          return item.week_of === key && matchesFilter(itemLevel(item));
        })
        .forEach(function (item) {
          hasEvents = true;
          cell.appendChild(offItem(item));
        });

      grid.appendChild(cell);
    }

    empty.hidden = hasEvents;
  }

  async function loadWeek() {
    var first = dateKey(currentWeek);
    var last = dateKey(new Date(currentWeek.getFullYear(), currentWeek.getMonth(), currentWeek.getDate() + 6));
    var classResult = await window.ESLPortal.api("class-sessions", {
      query: { from: first, to: last }
    });
    var offResult = await window.ESLPortal.api("week-off");
    sessions = classResult.items || [];
    daysOff = (offResult.items || []).filter(function (item) {
      return item.week_of >= first && item.week_of <= last;
    });
    render();
  }

  function changeWeek(offset) {
    currentWeek = new Date(currentWeek.getFullYear(), currentWeek.getMonth(), currentWeek.getDate() + offset * 7);
    loadWeek().catch(showError);
  }

  function showError(error) {
    var message = (error && error.message) || "Could not load the class calendar.";
    if (/class_sessions|week_off/i.test(message)) {
      message = "The class calendar is not set up yet. Run supabase/schema.sql in the Supabase SQL Editor.";
    }
    window.ESLPortal.showMessage(message, true);
  }

  document.getElementById("calendar-previous").addEventListener("click", function () {
    changeWeek(-1);
  });
  document.getElementById("calendar-next").addEventListener("click", function () {
    changeWeek(1);
  });
  document.getElementById("calendar-today").addEventListener("click", function () {
    currentWeek = startOfWeek(new Date());
    loadWeek().catch(showError);
  });

  document.addEventListener("esl:portal-ready", function () {
    loadWeek().catch(showError);
  });
})();
