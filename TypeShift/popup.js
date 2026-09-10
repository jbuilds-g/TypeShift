document.addEventListener("DOMContentLoaded", () => {
  const CONFIGURATION_VERSION = 1;
  let selectedFontValue = "";
  let currentHostname = "";
  let disabledDomains = [];
  let siteConfigs = {};
  let globalConfig = {};
  let activeScope = "global";

  const toggleDisableBtn = document.getElementById("toggle-disable-btn");
  const resetSiteBtn = document.getElementById("reset-site-btn");
  const statusMessage = document.getElementById("status-message");
  const siteHeading = document.getElementById("site-heading");
  const globalTab = document.getElementById("global-tab");
  const siteTab = document.getElementById("site-tab");
  const fontSearch = document.getElementById("font-search");
  const dropdownTrigger = document.getElementById("dropdown-trigger");
  const dropdownMenu = document.getElementById("dropdown-menu");
  const fontOptionsList = document.getElementById("font-options-list");
  let highlightedIndex = -1;

  function getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return null;
    }
  }

  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.display = "block";
    statusMessage.style.background = isError ? "#f8d7da" : "#d4edda";
    statusMessage.style.color = isError ? "#721c24" : "#155724";
    statusMessage.style.borderColor = isError ? "#f5c6cb" : "#c3e6cb";
  }

  const themeBtn = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  const themes = ["light", "dark", "pitch-black"];
  const themeIcons = [
    `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`,
    `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`,
    `<circle cx="12" cy="12" r="9" fill="currentColor"></circle>`,
  ];

  function applyTheme(idx) {
    if (themes[idx] === "light") document.body.removeAttribute("data-theme");
    else document.body.setAttribute("data-theme", themes[idx]);
    themeIcon.innerHTML = themeIcons[idx];
  }

  chrome.storage.local.get(["popupTheme"], (res) => {
    let currentTheme = res.popupTheme || 0;
    applyTheme(currentTheme);
    themeBtn?.addEventListener("click", () => {
      currentTheme = (currentTheme + 1) % 3;
      applyTheme(currentTheme);
      chrome.storage.local.set({ popupTheme: currentTheme });
    });
  });

  function updateHighlight(options) {
    options.forEach((opt, idx) => opt.classList.toggle("highlighted", idx === highlightedIndex));
    if (highlightedIndex >= 0 && options[highlightedIndex]) {
      options[highlightedIndex].scrollIntoView({ block: "nearest" });
    }
  }

  function getEffectiveFont() {
    if (activeScope === "site" && currentHostname && siteConfigs[currentHostname]?.fontFamily) {
      return siteConfigs[currentHostname].fontFamily;
    }
    return globalConfig.fontFamily || "";
  }

  function setFontValue(font, shouldApply = true) {
    selectedFontValue = font;
    dropdownTrigger.textContent = font || "Select Font";
    dropdownTrigger.style.fontFamily = font || "inherit";
    if (shouldApply && font && !disabledDomains.includes(currentHostname)) {
      saveCurrentFont();
    }
  }

  function buildLegacySiteFonts() {
    return Object.fromEntries(
      Object.entries(siteConfigs)
        .filter(([, config]) => config?.fontFamily)
        .map(([domain, config]) => [domain, config.fontFamily]),
    );
  }

  function saveCurrentFont() {
    if (!selectedFontValue) return;

    if (activeScope === "site" && currentHostname) {
      siteConfigs[currentHostname] = {
        ...(siteConfigs[currentHostname] || {}),
        fontFamily: selectedFontValue,
      };
    } else {
      globalConfig = { ...globalConfig, fontFamily: selectedFontValue };
    }

    chrome.storage.local.set(
      {
        configurationVersion: CONFIGURATION_VERSION,
        globalConfig,
        siteConfigs,
        activeFont: globalConfig.fontFamily || "",
        siteFonts: buildLegacySiteFonts(),
      },
      () => {
        applyFontToCurrentTab();
        showStatus(
          activeScope === "site"
            ? `Site font: ${selectedFontValue}`
            : `Global font: ${selectedFontValue}`,
        );
      },
    );
  }

  function applyFontToCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "applyFont", fontFamily: selectedFontValue },
        () => {
          if (chrome.runtime.lastError) {
            console.warn("TypeShift: unable to message the current page", chrome.runtime.lastError.message);
          }
        },
      );
    });
  }

  function populateFonts(filterText = "") {
    fontOptionsList.innerHTML = "";
    const query = filterText.toLowerCase().trim();

    for (const [category, fonts] of Object.entries(typeShiftFonts)) {
      const matchingFonts = fonts.filter((font) => font.toLowerCase().includes(query));
      if (!matchingFonts.length) continue;

      const categoryHeader = document.createElement("div");
      categoryHeader.className = "category-header";
      categoryHeader.textContent = category.toUpperCase();
      fontOptionsList.appendChild(categoryHeader);

      matchingFonts.forEach((font) => {
        const item = document.createElement("div");
        item.className = "font-option";
        item.textContent = font;
        item.style.fontFamily = font;
        item.addEventListener("click", () => {
          setFontValue(font);
          dropdownMenu.classList.add("hidden");
        });
        fontOptionsList.appendChild(item);
      });
    }
  }

  function updateToggleUI() {
    const isDisabled = disabledDomains.includes(currentHostname);
    toggleDisableBtn.textContent = isDisabled ? "Enable for this website" : "Disable for this website";
    toggleDisableBtn.classList.toggle("is-disabled", isDisabled);
  }

  function updateTabs() {
    const isSite = activeScope === "site";
    globalTab.classList.toggle("active", !isSite);
    siteTab.classList.toggle("active", isSite);
    globalTab.setAttribute("aria-selected", String(!isSite));
    siteTab.setAttribute("aria-selected", String(isSite));
    siteHeading.hidden = !isSite;
    siteHeading.textContent = currentHostname || "Current website";
    resetSiteBtn.hidden = !isSite || !currentHostname;
    toggleDisableBtn.style.display = isSite && currentHostname ? "block" : "none";

    selectedFontValue = getEffectiveFont();
    setFontValue(selectedFontValue, false);
    updateToggleUI();
    statusMessage.style.display = "none";
  }

  globalTab.addEventListener("click", () => {
    activeScope = "global";
    updateTabs();
  });

  siteTab.addEventListener("click", () => {
    activeScope = "site";
    updateTabs();
  });

  dropdownTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle("hidden");
    if (!dropdownMenu.classList.contains("hidden")) {
      highlightedIndex = -1;
      updateHighlight(fontOptionsList.querySelectorAll(".font-option"));
      fontSearch.focus();
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#custom-dropdown")) dropdownMenu.classList.add("hidden");
  });

  fontSearch.addEventListener("input", (e) => {
    highlightedIndex = -1;
    populateFonts(e.target.value);
  });

  fontSearch.addEventListener("keydown", (e) => {
    const options = Array.from(fontOptionsList.querySelectorAll(".font-option"));
    if (!options.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightedIndex = (highlightedIndex + 1) % options.length;
      updateHighlight(options);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightedIndex = (highlightedIndex - 1 + options.length) % options.length;
      updateHighlight(options);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0) options[highlightedIndex]?.click();
    } else if (e.key === "Escape") {
      dropdownMenu.classList.add("hidden");
    }
  });

  toggleDisableBtn.addEventListener("click", () => {
    if (!currentHostname) return;
    const isDisabled = disabledDomains.includes(currentHostname);
    disabledDomains = isDisabled
      ? disabledDomains.filter((domain) => domain !== currentHostname)
      : [...disabledDomains, currentHostname];

    chrome.storage.local.set({ disabledDomains }, () => {
      updateToggleUI();
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return;
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: isDisabled ? "applyFont" : "removeFont", fontFamily: selectedFontValue },
          () => {
            if (chrome.runtime.lastError) return;
          },
        );
      });
      showStatus(isDisabled ? "Site enabled." : "Site disabled.", !isDisabled);
    });
  });

  resetSiteBtn.addEventListener("click", () => {
    if (!currentHostname || !siteConfigs[currentHostname]) return;

    delete siteConfigs[currentHostname];
    selectedFontValue = globalConfig.fontFamily || "";

    chrome.storage.local.set(
      { siteConfigs, siteFonts: buildLegacySiteFonts() },
      () => {
        setFontValue(selectedFontValue, false);
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs[0]?.id) return;
          if (selectedFontValue) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "applyFont",
              fontFamily: selectedFontValue,
            });
          } else {
            chrome.tabs.sendMessage(tabs[0].id, { action: "removeFont" });
          }
        });
        showStatus("This site's custom configuration was reset.");
      },
    );
  });

  populateFonts();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) return;
    currentHostname = getHostname(tabs[0].url);

    chrome.storage.local.get(
      ["configurationVersion", "globalConfig", "siteConfigs", "activeFont", "disabledDomains", "siteFonts"],
      (result) => {
        globalConfig = { ...(result.globalConfig || {}) };
        siteConfigs = { ...(result.siteConfigs || {}) };

        if (!globalConfig.fontFamily && result.activeFont) {
          globalConfig.fontFamily = result.activeFont;
        }

        if (result.siteFonts && typeof result.siteFonts === "object") {
          Object.entries(result.siteFonts).forEach(([domain, fontFamily]) => {
            siteConfigs[domain] = {
              ...(siteConfigs[domain] || {}),
              fontFamily: siteConfigs[domain]?.fontFamily || fontFamily,
            };
          });
        }

        if (result.configurationVersion !== CONFIGURATION_VERSION) {
          chrome.storage.local.set({
            configurationVersion: CONFIGURATION_VERSION,
            globalConfig,
            siteConfigs,
          });
        }

        disabledDomains = result.disabledDomains || [];
        updateTabs();
      },
    );
  });
});
