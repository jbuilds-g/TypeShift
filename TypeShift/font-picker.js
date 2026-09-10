function createFontPicker({ selectedFont = "", onChange }) {
  const wrapper = document.createElement("div");
  wrapper.className = "font-picker custom-dropdown";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "dropdown-trigger";
  trigger.textContent = selectedFont || "Use global font";
  trigger.dataset.value = selectedFont;
  trigger.style.fontFamily = selectedFont || "inherit";
  trigger.setAttribute("aria-haspopup", "listbox");

  const menu = document.createElement("div");
  menu.className = "dropdown-menu hidden";

  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Search fonts...";
  search.setAttribute("aria-label", "Search fonts");

  const list = document.createElement("div");
  list.className = "font-options-list";

  let highlightedIndex = -1;

  function selectValue(font, label = font) {
    trigger.textContent = label;
    trigger.dataset.value = font;
    trigger.style.fontFamily = font || "inherit";
    menu.classList.add("hidden");
    onChange?.(font);
  }

  function updateHighlight(options) {
    options.forEach((option, index) => {
      option.classList.toggle("highlighted", index === highlightedIndex);
    });
    options[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }

  function populate(filterText = "") {
    list.replaceChildren();
    highlightedIndex = -1;
    const query = filterText.toLowerCase().trim();

    if (!query) {
      const resetOption = document.createElement("div");
      resetOption.className = "font-option picker-reset-option";
      resetOption.textContent = "Use global font";
      resetOption.setAttribute("role", "option");
      resetOption.addEventListener("click", () => selectValue("", "Use global font"));
      list.appendChild(resetOption);
    }

    for (const [category, fonts] of Object.entries(typeShiftFonts)) {
      const matchingFonts = fonts.filter((font) => font.toLowerCase().includes(query));
      if (!matchingFonts.length) continue;

      const header = document.createElement("div");
      header.className = "category-header";
      header.textContent = category.toUpperCase();
      list.appendChild(header);

      matchingFonts.forEach((font) => {
        const option = document.createElement("div");
        option.className = "font-option";
        option.textContent = font;
        option.style.fontFamily = font;
        option.setAttribute("role", "option");
        option.addEventListener("click", () => selectValue(font));
        list.appendChild(option);
      });
    }
  }

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.classList.toggle("hidden");
    if (!menu.classList.contains("hidden")) {
      search.value = "";
      populate();
      search.focus();
    }
  });

  search.addEventListener("input", () => populate(search.value));
  search.addEventListener("keydown", (event) => {
    const options = Array.from(list.querySelectorAll(".font-option"));
    if (!options.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlightedIndex = (highlightedIndex + 1) % options.length;
      updateHighlight(options);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      highlightedIndex = (highlightedIndex - 1 + options.length) % options.length;
      updateHighlight(options);
    } else if (event.key === "Enter") {
      event.preventDefault();
      options[highlightedIndex]?.click();
    } else if (event.key === "Escape") {
      menu.classList.add("hidden");
      trigger.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) menu.classList.add("hidden");
  });

  menu.append(search, list);
  wrapper.append(trigger, menu);
  populate();

  return wrapper;
}
