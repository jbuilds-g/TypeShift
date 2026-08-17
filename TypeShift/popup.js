document.addEventListener("DOMContentLoaded", () => {
  const fontSelect = document.getElementById("font-select");
  const applyBtn = document.getElementById("apply-btn");
  const toggleDisableBtn = document.getElementById("toggle-disable-btn");
  const warningBox = document.getElementById("icon-warning");
  const statusMessage = document.getElementById("status-message");

  let currentHostname = "";
  let disabledDomains = [];

  // Helper function to extract hostname safely
  function getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return null;
    }
  }

  // Helper function to show status
  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.display = "block";
    if (isError) {
      statusMessage.style.background = "#f8d7da";
      statusMessage.style.color = "#721c24";
      statusMessage.style.borderColor = "#f5c6cb";
    } else {
      statusMessage.style.background = "#d4edda";
      statusMessage.style.color = "#155724";
      statusMessage.style.borderColor = "#c3e6cb";
    }
  }

  const fontSearch = document.getElementById("font-search");
  const dropdownTrigger = document.getElementById("dropdown-trigger");
  const dropdownMenu = document.getElementById("dropdown-menu");
  const fontOptionsList = document.getElementById("font-options-list");

  function setFontValue(font) {
    fontSelect.value = font;
    dropdownTrigger.textContent = font;
    dropdownTrigger.style.fontFamily = font;
  }

  function populateFonts(filterText = "") {
    fontSelect.innerHTML = "";
    fontOptionsList.innerHTML = "";
    const query = filterText.toLowerCase().trim();

    for (const [category, fonts] of Object.entries(typeShiftFonts)) {
      const matchingFonts = fonts.filter((font) =>
        font.toLowerCase().includes(query),
      );
      if (matchingFonts.length === 0) continue;

      const optgroup = document.createElement("optgroup");
      optgroup.label = category.toUpperCase();

      const categoryHeader = document.createElement("div");
      categoryHeader.className = "category-header";
      categoryHeader.textContent = category.toUpperCase();
      fontOptionsList.appendChild(categoryHeader);

      matchingFonts.forEach((font) => {
        const option = document.createElement("option");
        option.value = font;
        option.textContent = font;
        optgroup.appendChild(option);

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

      fontSelect.appendChild(optgroup);
    }
  }

  populateFonts();

  if (dropdownTrigger) {
    dropdownTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("hidden");
      if (!dropdownMenu.classList.contains("hidden")) {
        fontSearch.focus();
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#custom-dropdown")) {
      dropdownMenu.classList.add("hidden");
    }
  });

  if (fontSearch) {
    fontSearch.addEventListener("input", (e) => {
      populateFonts(e.target.value);
    });
  }

  // Update UI based on disabled status
  function updateToggleUI() {
    if (disabledDomains.includes(currentHostname)) {
      toggleDisableBtn.textContent = "Enable for this website";
      toggleDisableBtn.classList.add("is-disabled");
      applyBtn.disabled = true;
    } else {
      toggleDisableBtn.textContent = "Disable for this website";
      toggleDisableBtn.classList.remove("is-disabled");
      applyBtn.disabled = false;
    }
  }

  // 1. Get current tab details
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return;

    currentHostname = getHostname(tabs[0].url);

    // Only show disable button on valid web pages (hide on chrome:// extensions pages, etc.)
    if (currentHostname && !tabs[0].url.startsWith("chrome")) {
      toggleDisableBtn.style.display = "block";
    }

    // 2. Load storage state
    chrome.storage.local.get(
      ["activeFont", "disabledDomains", "siteFonts"],
      (result) => {
        const siteFonts = result.siteFonts || {};
        const globalRadio = document.querySelector(
          'input[name="font-scope"][value="global"]',
        );
        const siteRadio = document.querySelector(
          'input[name="font-scope"][value="site"]',
        );

        if (currentHostname && siteFonts[currentHostname]) {
          setFontValue(siteFonts[currentHostname]);
          if (siteRadio) siteRadio.checked = true;
          showStatus(`Site font: ${siteFonts[currentHostname]}`);
        } else if (result.activeFont) {
          setFontValue(result.activeFont);
          if (globalRadio) globalRadio.checked = true;
          showStatus(`Global font: ${result.activeFont}`);
        }

        disabledDomains = result.disabledDomains || [];
        updateToggleUI();
      },
    );

    // 3. Check for fragile icons
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "checkIcons" },
      (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.hasIcons) {
          warningBox.style.display = "block";
        }
      },
    );
  });

  // Apply Font based on selected scope
  applyBtn.addEventListener("click", () => {
    const selectedFont = fontSelect.value;
    const scope =
      document.querySelector('input[name="font-scope"]:checked')?.value ||
      "global";

    chrome.storage.local.get(["siteFonts"], (result) => {
      const siteFonts = result.siteFonts || {};

      if (scope === "site" && currentHostname) {
        siteFonts[currentHostname] = selectedFont;
      } else if (scope === "global" && currentHostname) {
        delete siteFonts[currentHostname];
      }

      const storageUpdate = { siteFonts };
      if (scope === "global") {
        storageUpdate.activeFont = selectedFont;
      }

      chrome.storage.local.set(storageUpdate, () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs[0]) return;
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "applyFont",
              fontFamily: selectedFont,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                showStatus("Cannot apply to this page.", true);
                return;
              }
              if (response && response.success) {
                showStatus(`Success! Active font: ${selectedFont}`);
              }
            },
          );
        });
      });
    });
  });

  // Toggle Disable/Enable for specific domain
  toggleDisableBtn.addEventListener("click", () => {
    if (disabledDomains.includes(currentHostname)) {
      // Re-enable
      disabledDomains = disabledDomains.filter(
        (domain) => domain !== currentHostname,
      );
      showStatus("Site enabled. Applying font...");

      chrome.storage.local.set({ disabledDomains }, () => {
        updateToggleUI();
        const fontToApply = fontSelect.value;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "applyFont",
            fontFamily: fontToApply,
          });
        });
      });
    } else {
      // Disable
      disabledDomains.push(currentHostname);
      showStatus("Site disabled. Reverting to default...", true);

      chrome.storage.local.set({ disabledDomains }, () => {
        updateToggleUI();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "removeFont" });
        });
      });
    }
  });
});
