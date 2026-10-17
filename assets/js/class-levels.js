(function (root) {
  "use strict";

  var LEVELS = ["1R", "1G", "1B", "2B", "2G", "3R", "3B", "3G", "4R", "4B", "4G", "5G", "5", "5C"];

  function slug(level) {
    return "level-" + String(level || "").replace(/[^A-Za-z0-9]/g, "");
  }

  function isLevel(value) {
    return LEVELS.indexOf(String(value || "").trim()) !== -1;
  }

  function fromText(value) {
    var text = String(value || "").trim();
    if (isLevel(text)) return text;
    var match = text.match(/\b(1R|1G|1B|2B|2G|3R|3B|3G|4R|4B|4G|5G|5C|5)\b/i);
    return match ? match[1].toUpperCase().replace(/^5C$/i, "5C") : "";
  }

  function fillSelect(select, selected) {
    if (!select) return;
    select.replaceChildren();
    var blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Select a level";
    select.appendChild(blank);
    LEVELS.forEach(function (level) {
      var option = document.createElement("option");
      option.value = level;
      option.textContent = level;
      if (level === selected) option.selected = true;
      select.appendChild(option);
    });
  }

  root.ESLLevels = {
    list: LEVELS,
    slug: slug,
    isLevel: isLevel,
    fromText: fromText,
    fillSelect: fillSelect
  };
})(window);
