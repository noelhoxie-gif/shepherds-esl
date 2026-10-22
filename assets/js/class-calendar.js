(function () {
  "use strict";

  var grid = document.getElementById("class-calendar-grid");
  var monthLabel = document.getElementById("calendar-month");
  var filters = document.getElementById("level-filters");
  var overlay = document.getElementById("attendance-overlay");
  var attendanceList = document.getElementById("attendance-list");
  var attendanceTitle = document.getElementById("attendance-title");
  var attendanceCount = document.getElementById("attendance-count");
  var daysOff = [];
  var selectedLevel = "";
  var lastFocus = null;

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

  function offItem(item) {
    var level = itemLevel(item);
    return eventEl({
      off: true,
      level: level,
      title: "Off · " + (item.volunteer_name || "Volunteer"),
      lines: [level ? "Area " + level : "", item.assignment, item.note]
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

  function fridaysInMonth(year, month) {
    var date = new Date(year, month, 1);
    date.setDate(1 + ((5 - date.getDay() + 7) % 7));
    var list = [];
    while (date.getMonth() === month) {
      list.push(new Date(date));
      date.setDate(date.getDate() + 7);
    }
    return list;
  }

  function column(heading, items, emptyText, extra) {
    var section = document.createElement("div");
    section.className = "friday-column";
    var title = document.createElement("h3");
    title.textContent = heading;
    var count = document.createElement("span");
    count.className = "friday-count";
    count.textContent = items.length;
    title.appendChild(count);
    section.appendChild(title);

    if (!items.length) {
      var none = document.createElement("p");
      none.className = "friday-none";
      none.textContent = emptyText;
      section.appendChild(none);
    } else {
      items.slice(0, 4).forEach(function (el) {
        section.appendChild(el);
      });
      if (items.length > 4) {
        var more = document.createElement("p");
        more.className = "friday-more";
        more.textContent = "+" + (items.length - 4) + " more · View full list";
        section.appendChild(more);
      }
    }
    if (extra) section.appendChild(extra);
    return section;
  }

  function peopleOff(key) {
    return daysOff
      .filter(function (item) {
        return dayKey(item.week_of) === key;
      })
      .slice()
      .sort(function (a, b) {
        var nameA = String(a.volunteer_name || "").toLowerCase();
        var nameB = String(b.volunteer_name || "").toLowerCase();
        if (nameA !== nameB) return nameA < nameB ? -1 : 1;
        return String(itemLevel(a)).localeCompare(String(itemLevel(b)));
      });
  }

  function openAttendance(key, date) {
    var people = peopleOff(key);
    lastFocus = document.activeElement;
    attendanceTitle.textContent = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
    attendanceCount.textContent =
      people.length === 1
        ? "1 volunteer is out"
        : people.length + " volunteers are out";

    attendanceList.replaceChildren();
    if (!people.length) {
      var empty = document.createElement("p");
      empty.className = "portal-empty";
      empty.textContent = "Everyone is in this Friday.";
      attendanceList.appendChild(empty);
    } else {
      people.forEach(function (item, index) {
        var row = document.createElement("article");
        row.className = "attendance-person";
        var level = itemLevel(item);
        if (level) row.classList.add(window.ESLLevels.slug(level));

        var number = document.createElement("span");
        number.className = "attendance-number";
        number.textContent = String(index + 1);
        row.appendChild(number);

        var body = document.createElement("div");
        var name = document.createElement("strong");
        name.textContent = item.volunteer_name || "Volunteer";
        body.appendChild(name);

        var meta = document.createElement("span");
        meta.textContent = [
          level ? "Area " + level : "",
          item.assignment,
          item.note
        ]
          .filter(Boolean)
          .join(" · ");
        if (meta.textContent) body.appendChild(meta);
        row.appendChild(body);
        attendanceList.appendChild(row);
      });
    }

    overlay.hidden = false;
    document.body.classList.add("attendance-open");
    document.getElementById("attendance-close").focus();
  }

  function closeAttendance() {
    overlay.hidden = true;
    document.body.classList.remove("attendance-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function render() {
    renderFilters();
    grid.replaceChildren();
    monthLabel.textContent = currentMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric"
    });

    var todayKey = dateKey(new Date());
    var fridays = fridaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    var nextKey = "";
    fridays.forEach(function (date) {
      var key = dateKey(date);
      if (!nextKey && key >= todayKey) nextKey = key;
    });

    fridays.forEach(function (date) {
      var key = dateKey(date);
      var row = document.createElement("article");
      row.className = "friday-row is-clickable";
      if (key < todayKey) row.classList.add("is-past");
      if (key === nextKey) row.classList.add("is-next");
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      row.setAttribute(
        "aria-label",
        "Open attendance for " +
          date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      );
      row.addEventListener("click", function () {
        openAttendance(key, date);
      });
      row.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openAttendance(key, date);
        }
      });

      var tile = document.createElement("div");
      tile.className = "friday-tile";
      var weekday = document.createElement("span");
      weekday.className = "friday-tile-top";
      weekday.textContent = key === nextKey ? "Next Friday" : "Friday";
      var day = document.createElement("strong");
      day.textContent = date.getDate();
      var monthName = document.createElement("span");
      monthName.className = "friday-tile-month";
      monthName.textContent = date.toLocaleDateString("en-US", { month: "short" });
      tile.appendChild(weekday);
      tile.appendChild(day);
      tile.appendChild(monthName);
      row.appendChild(tile);

      var offPeople = peopleOff(key).filter(function (item) {
        return matchesFilter(itemLevel(item));
      });
      var hint = document.createElement("p");
      hint.className = "friday-more";
      hint.textContent = "Click to open the full attendance list";

      var body = document.createElement("div");
      body.className = "friday-body";
      body.appendChild(
        column("Out this Friday", offPeople.map(offItem), "Everyone is in.", hint)
      );
      row.appendChild(body);

      grid.appendChild(row);
    });
  }

  async function loadMonth() {
    var year = currentMonth.getFullYear();
    var month = currentMonth.getMonth();
    var first = dateKey(new Date(year, month, 1));
    var last = dateKey(new Date(year, month + 1, 0));

    var result = await window.ESLPortal.api("week-off");
    daysOff = (result.items || []).map(function (item) {
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

    var offParam = new URLSearchParams(window.location.search).get("off") || "";
    var offDay = dayKey(offParam);
    if (offDay) {
      var matchDate = fridaysInMonth(year, month).find(function (date) {
        return dateKey(date) === offDay;
      });
      if (matchDate) openAttendance(offDay, matchDate);
    }
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

  document.getElementById("attendance-close").addEventListener("click", closeAttendance);
  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) closeAttendance();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !overlay.hidden) closeAttendance();
  });

  document.addEventListener("esl:portal-ready", function () {
    loadMonth().catch(showError);
  });
})();
