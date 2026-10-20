(function () {
  "use strict";

  var grid = document.getElementById("class-calendar-grid");
  var monthLabel = document.getElementById("calendar-month");
  var empty = document.getElementById("calendar-empty");
  var filters = document.getElementById("level-filters");
  var sessions = [];
  var daysOff = [];
  var selectedLevel = "";

  function initialMonth() {
    var param = new URLSearchParams(window.location.search).get("month") || "";
    var match = param.match(/^(\d{4})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, 1);
    var today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  var currentMonth = initialMonth();

  function dateKey(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function dayKey(value) {
    var match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  }

  function peekPendingOff() {
    try {
      var raw = window.sessionStorage.getItem("esl-pending-off");
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function clearPendingOff() {
    try {
      window.sessionStorage.removeItem("esl-pending-off");
    } catch (err) {}
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
      if (date.getDay() === 5) cell.classList.add("is-friday");
      var number = document.createElement("span");
      number.className = "calendar-day-number";
      number.textContent = dayNumber;
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
          return dayKey(item.week_of) === key && matchesFilter(itemLevel(item));
        })
        .forEach(function (item) {
          hasEvents = true;
          cell.appendChild(offItem(item));
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

    var results = await Promise.all([
      window.ESLPortal.api("class-sessions", { query: { from: first, to: last } }).catch(function () {
        return { items: [] };
      }),
      window.ESLPortal.api("week-off")
    ]);
    sessions = (results[0].items || []).map(function (item) {
      item.session_date = dayKey(item.session_date);
      return item;
    });
    daysOff = (results[1].items || []).map(function (item) {
      item.week_of = dayKey(item.week_of);
      return item;
    });

    var pending = peekPendingOff();
    if (pending && pending.week_of) {
      pending.week_of = dayKey(pending.week_of);
      var already = daysOff.some(function (item) {
        return (
          item.week_of === pending.week_of &&
          String(item.volunteer_name || "") === String(pending.volunteer_name || "")
        );
      });
      if (already) clearPendingOff();
      else daysOff.push(pending);
    }

    daysOff = daysOff.filter(function (item) {
      return item.week_of >= first && item.week_of <= last;
    });
    render();
  }

  function changeMonth(offset) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    loadMonth().catch(showError);
  }

  function showError(error) {
    var message = (error && error.message) || "Could not load the calendar.";
    if (/class_sessions|week_off/i.test(message)) {
      message = "The calendar is not set up yet. Run supabase/schema.sql in the Supabase SQL Editor.";
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
