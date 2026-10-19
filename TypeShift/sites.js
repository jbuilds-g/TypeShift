document.addEventListener("DOMContentLoaded", () => {
  const CONFIGURATION_VERSION = 1;
  const themes = ["light", "dark", "pitch-black"];
  const themeIcons = [
    `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`,
    `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`,
    `<circle cx="12" cy="12" r="9" fill="currentColor"></circle>`,
  ];

  const sitesList = document.getElementById("sites-list");
  const emptyState = document.getElementById("empty-state");
  const siteCount = document.getElementById("site-count");
  const addForm = document.getElementById("add-site-form");
  const domainInput = document.getElementById("domain-input");
  const statusMessage = document.getElementById("status-message");
  const themeBtn = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  let siteConfigs = {};
  let globalConfig = {};

  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.background = isError ? "#f8d7da" : "#d4edda";
    statusMessage.style.color = isError ? "#721c24" : "#155724";
    statusMessage.style.borderColor = isError ? "#f5c6cb" : "#c3e6cb";
    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(() => {
      statusMessage.textContent = "";
    }, 2800);
  }

  function applyTheme(index) {
    if (themes[index] === "light") document.body.removeAttribute("data-theme");
    else document.body.setAttribute("data-theme", themes[index]);
    themeIcon.innerHTML = themeIcons[index];
  }

  chrome.storage.local.get(["popupTheme"], (result) => {
    let currentTheme = Number.isInteger(result.popupTheme)
      ? result.popupTheme
      : 0;
    currentTheme = Math.max(0, Math.min(currentTheme, themes.length - 1));
    applyTheme(currentTheme);
    themeBtn.addEventListener("click", () => {
      currentTheme = (currentTheme + 1) % themes.length;
      applyTheme(currentTheme);
      chrome.storage.local.set({ popupTheme: currentTheme });
    });
  });

  function normalizeDomain(value) {
    let input = value.trim();
    if (!input) return null;

    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(input)) {
      input = `https://${input}`;
    }

    let url;
    try {
      url = new URL(input);
    } catch {
      return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || url.username || url.password) return null;

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      hostname !== "localhost" &&
      !hostname.includes(".") &&
      !/^[\d.]+$/.test(hostname)
    ) {
      return null;
    }
    if (hostname.includes("..") || hostname.length > 253) return null;

    const labels = hostname.split(".");
    if (
      labels.some(
        (label) =>
          !label ||
          label.length > 63 ||
          label.startsWith("-") ||
          label.endsWith("-") ||
          !/^[a-z\d-]+$/i.test(label),
      )
    ) {
      return null;
    }

    return hostname;
  }

  function buildLegacySiteFonts() {
    return Object.fromEntries(
      Object.entries(siteConfigs)
        .filter(([, config]) => config?.fontFamily)
        .map(([domain, config]) => [domain, config.fontFamily]),
    );
  }

  function persist(callback) {
    chrome.storage.local.set(
      {
        configurationVersion: CONFIGURATION_VERSION,
        globalConfig,
        siteConfigs,
        activeFont: globalConfig.fontFamily || "",
        siteFonts: buildLegacySiteFonts(),
      },
      callback,
    );
  }

  function renderSites() {
    sitesList.replaceChildren();
    const domains = Object.keys(siteConfigs).sort((a, b) => a.localeCompare(b));
    siteCount.textContent = `${domains.length} ${domains.length === 1 ? "site" : "sites"}`;
    emptyState.hidden = domains.length > 0;

    domains.forEach((domain) => {
      const config = siteConfigs[domain] || {};
      const card = document.createElement("article");
      card.className = "site-card";

      const main = document.createElement("div");
      main.className = "site-main";

      const info = document.createElement("div");
      const domainEl = document.createElement("div");
      domainEl.className = "site-domain";
      domainEl.textContent = domain;
      const meta = document.createElement("div");
      meta.className = "site-meta";
      const metaParts = [];
      if (config.fontFamily) metaParts.push(`Font: ${config.fontFamily}`);
      if (config.size !== undefined) metaParts.push(`Size: ${config.size}%`);
      if (config.lineHeight !== undefined)
        metaParts.push(`Line height: ${config.lineHeight}%`);
      meta.textContent = metaParts.join(" · ") || "No overrides";
      info.append(domainEl, meta);

      const actions = document.createElement("div");
      actions.className = "site-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEditor(card, domain));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => deleteSite(domain));

      actions.append(editBtn, deleteBtn);
      main.append(info, actions);
      card.appendChild(main);
      sitesList.appendChild(card);
    });
  }

  function openEditor(card, domain) {
    card.querySelector(".editor")?.remove();

    const editor = document.createElement("div");
    editor.className = "editor";

    const field = document.createElement("div");
    const label = document.createElement("label");
    label.textContent = "Font override";
    const picker = createFontPicker({
      selectedFont: siteConfigs[domain]?.fontFamily || "",
      onChange: () => {},
    });
    field.append(label, picker);

    const typography = document.createElement("div");
    typography.className = "site-typography-editor";

    const sizeField = document.createElement("div");
    const sizeLabel = document.createElement("label");
    const sizeValue = document.createElement("output");
    const sizeControl = document.createElement("input");
    sizeLabel.textContent = "Font size";
    sizeControl.type = "range";
    sizeControl.min = "80";
    sizeControl.max = "140";
    sizeControl.step = "5";
    sizeControl.value = String(
      siteConfigs[domain]?.size ?? globalConfig.size ?? 100,
    );
    sizeLabel.append(" ", sizeValue);
    sizeValue.textContent = `${sizeControl.value}%`;
    sizeControl.setAttribute("aria-label", `${domain} font size`);
    sizeControl.addEventListener("input", () => {
      sizeValue.textContent = `${sizeControl.value}%`;
    });
    sizeField.append(sizeLabel, sizeControl);

    const lineField = document.createElement("div");
    const lineLabel = document.createElement("label");
    const lineValue = document.createElement("output");
    const lineControl = document.createElement("input");
    lineLabel.textContent = "Line height";
    lineControl.type = "range";
    lineControl.min = "80";
    lineControl.max = "140";
    lineControl.step = "5";
    lineControl.value = String(
      siteConfigs[domain]?.lineHeight ?? globalConfig.lineHeight ?? 100,
    );
    lineLabel.append(" ", lineValue);
    lineValue.textContent = `${lineControl.value}%`;
    lineControl.setAttribute("aria-label", `${domain} line height`);
    lineControl.addEventListener("input", () => {
      lineValue.textContent = `${lineControl.value}%`;
    });
    lineField.append(lineLabel, lineControl);

    const resetTypographyBtn = document.createElement("button");
    resetTypographyBtn.type = "button";
    resetTypographyBtn.className = "cancel-btn";
    resetTypographyBtn.textContent = "Reset typography";
    resetTypographyBtn.addEventListener("click", () => {
      sizeControl.value = String(globalConfig.size ?? 100);
      lineControl.value = String(globalConfig.lineHeight ?? 100);
      sizeValue.textContent = `${sizeControl.value}%`;
      lineValue.textContent = `${lineControl.value}%`;
    });

    typography.append(sizeField, lineField, resetTypographyBtn);

    const actions = document.createElement("div");
    actions.className = "editor-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "save-btn";
    saveBtn.textContent = "Save";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "cancel-btn";
    cancelBtn.textContent = "Cancel";
    actions.append(cancelBtn, saveBtn);

    cancelBtn.addEventListener("click", () => editor.remove());
    saveBtn.addEventListener("click", () => {
      const fontFamily =
        picker.querySelector(".dropdown-trigger").dataset.value || "";
      siteConfigs[domain] = siteConfigs[domain] || {};

      if (!fontFamily) {
        delete siteConfigs[domain].fontFamily;
      } else {
        siteConfigs[domain].fontFamily = fontFamily;
      }

      const size = Number(sizeControl.value);
      const lineHeight = Number(lineControl.value);
      if (size === (globalConfig.size ?? 100)) delete siteConfigs[domain].size;
      else siteConfigs[domain].size = size;
      if (lineHeight === (globalConfig.lineHeight ?? 100))
        delete siteConfigs[domain].lineHeight;
      else siteConfigs[domain].lineHeight = lineHeight;
      // Keep the site entry even when it inherits every setting from Global.
      persist(() => {
        renderSites();
        showStatus(`Saved ${domain}.`);
      });
    });

    editor.append(field, typography, actions);
    card.appendChild(editor);
  }

  function deleteSite(domain) {
    if (!window.confirm(`Delete the custom configuration for ${domain}?`))
      return;
    delete siteConfigs[domain];
    persist(() => {
      renderSites();
      showStatus(`Removed ${domain}.`);
    });
  }

  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const domain = normalizeDomain(domainInput.value);
    if (!domain) {
      showStatus("Enter a valid website hostname or URL.", true);
      domainInput.focus();
      return;
    }

    if (siteConfigs[domain]) {
      showStatus(`${domain} is already configured.`, true);
      return;
    }

    siteConfigs[domain] = {};
    persist(() => {
      domainInput.value = "";
      renderSites();
      showStatus(`Added ${domain}.`);
    });
  });

  chrome.storage.local.get(
    [
      "configurationVersion",
      "globalConfig",
      "siteConfigs",
      "activeFont",
      "siteFonts",
    ],
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
        persist(() => renderSites());
      } else {
        renderSites();
      }
    },
  );
});
