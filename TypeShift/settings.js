document.addEventListener("DOMContentLoaded", () => {
  const CONFIGURATION_VERSION = 1;
  const themes = ["light", "dark", "pitch-black"];
  const themeLabels = ["Light", "Dark", "Pitch black"];
  const themeIcons = [
    `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`,
    `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`,
    `<circle cx="12" cy="12" r="9" fill="currentColor"></circle>`,
  ];

  const themeBtn = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  const exportBtn = document.getElementById("export-btn");
  const backupFile = document.getElementById("backup-file");
  const backupPreview = document.getElementById("backup-preview");
  const previewVersion = document.getElementById("preview-version");
  const previewGlobal = document.getElementById("preview-global");
  const previewSites = document.getElementById("preview-sites");
  const previewTheme = document.getElementById("preview-theme");
  const replaceBtn = document.getElementById("replace-btn");
  const mergeBtn = document.getElementById("merge-btn");
  const cancelRestoreBtn = document.getElementById("cancel-restore-btn");
  const statusMessage = document.getElementById("status-message");
  const versionEl = document.querySelector("[data-version]");

  let currentTheme = 0;
  let pendingBackup = null;

  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.background = isError ? "#f8d7da" : "#d4edda";
    statusMessage.style.color = isError ? "#721c24" : "#155724";
    statusMessage.style.borderColor = isError ? "#f5c6cb" : "#c3e6cb";
    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(() => {
      statusMessage.textContent = "";
    }, 3000);
  }

  function applyTheme(index) {
    currentTheme = Math.max(0, Math.min(index, themes.length - 1));
    if (themes[currentTheme] === "light") document.body.removeAttribute("data-theme");
    else document.body.setAttribute("data-theme", themes[currentTheme]);
    themeIcon.innerHTML = themeIcons[currentTheme];
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isValidDomain(domain) {
    if (typeof domain !== "string" || !domain || domain.length > 253) return false;
    if (domain.includes("..")) return false;
    if (domain === "localhost") return true;
    if (/^[\d.]+$/.test(domain)) return domain.split(".").every((part) => {
      const number = Number(part);
      return part !== "" && Number.isInteger(number) && number >= 0 && number <= 255;
    });

    return domain.split(".").every((label) =>
      label &&
      label.length <= 63 &&
      !label.startsWith("-") &&
      !label.endsWith("-") &&
      /^[a-z\d-]+$/i.test(label),
    );
  }

  function validateSiteConfigs(siteConfigs) {
    if (!isPlainObject(siteConfigs)) return false;

    return Object.entries(siteConfigs).every(([domain, config]) => {
      if (!isValidDomain(domain) || !isPlainObject(config)) return false;
      if ("fontFamily" in config && typeof config.fontFamily !== "string") return false;
      return Object.keys(config).every((key) => key === "fontFamily");
    });
  }

  function validateBackup(backup) {
    if (!isPlainObject(backup) || backup.version !== CONFIGURATION_VERSION) {
      return "Unsupported or invalid backup version.";
    }
    if (!isPlainObject(backup.global)) return "Invalid global configuration.";
    if (!validateSiteConfigs(backup.sites)) return "Invalid custom site configuration.";
    if (!Number.isInteger(backup.theme) || backup.theme < 0 || backup.theme >= themes.length) {
      return "Invalid theme setting.";
    }
    if (!Array.isArray(backup.disabledDomains) || !backup.disabledDomains.every(isValidDomain)) {
      return "Invalid disabled site configuration.";
    }
    if (Object.keys(backup.global).some((key) => key !== "fontFamily")) {
      return "Unsupported global configuration.";
    }
    if ("fontFamily" in backup.global && typeof backup.global.fontFamily !== "string") {
      return "Invalid global font configuration.";
    }
    return null;
  }

  function buildBackup(result) {
    const globalConfig = isPlainObject(result.globalConfig) ? result.globalConfig : {};
    const siteConfigs = isPlainObject(result.siteConfigs) ? result.siteConfigs : {};

    if (!globalConfig.fontFamily && result.activeFont) {
      globalConfig.fontFamily = result.activeFont;
    }

    if (result.siteFonts && isPlainObject(result.siteFonts)) {
      Object.entries(result.siteFonts).forEach(([domain, fontFamily]) => {
        siteConfigs[domain] = {
          ...(siteConfigs[domain] || {}),
          fontFamily: siteConfigs[domain]?.fontFamily || fontFamily,
        };
      });
    }

    return {
      version: CONFIGURATION_VERSION,
      global: globalConfig,
      sites: siteConfigs,
      disabledDomains: Array.isArray(result.disabledDomains) ? result.disabledDomains : [],
      theme: Number.isInteger(result.popupTheme) ? result.popupTheme : 0,
    };
  }

  function loadCurrentBackup(callback) {
    chrome.storage.local.get(
      ["globalConfig", "siteConfigs", "activeFont", "siteFonts", "disabledDomains", "popupTheme"],
      (result) => callback(buildBackup(result)),
    );
  }

  function downloadBackup(backup) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `TypeShift-backup-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showStatus("Backup exported.");
  }

  function normalizeImportedBackup(backup) {
    return {
      globalConfig: { ...backup.global },
      siteConfigs: Object.fromEntries(
        Object.entries(backup.sites).map(([domain, config]) => [domain, { ...config }]),
      ),
      disabledDomains: [...backup.disabledDomains],
      popupTheme: backup.theme,
    };
  }

  function buildLegacySiteFonts(siteConfigs) {
    return Object.fromEntries(
      Object.entries(siteConfigs)
        .filter(([, config]) => config?.fontFamily)
        .map(([domain, config]) => [domain, config.fontFamily]),
    );
  }

  function saveConfiguration(backup) {
    const config = normalizeImportedBackup(backup);
    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          configurationVersion: CONFIGURATION_VERSION,
          globalConfig: config.globalConfig,
          siteConfigs: config.siteConfigs,
          activeFont: config.globalConfig.fontFamily || "",
          siteFonts: buildLegacySiteFonts(config.siteConfigs),
          disabledDomains: config.disabledDomains,
          popupTheme: config.popupTheme,
        },
        resolve,
      );
    });
  }

  function mergeBackup(imported) {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["globalConfig", "siteConfigs", "activeFont", "siteFonts", "disabledDomains", "popupTheme"],
        async (result) => {
          const current = buildBackup(result);
          const merged = {
            version: CONFIGURATION_VERSION,
            global: { ...current.global, ...imported.global },
            sites: { ...current.sites },
            disabledDomains: [...new Set([...current.disabledDomains, ...imported.disabledDomains])],
            theme: imported.theme,
          };

          Object.entries(imported.sites).forEach(([domain, config]) => {
            merged.sites[domain] = { ...(merged.sites[domain] || {}), ...config };
          });

          await saveConfiguration(merged);
          resolve();
        },
      );
    });
  }

  function hidePreview() {
    pendingBackup = null;
    backupPreview.hidden = true;
    backupFile.value = "";
  }

  function showPreview(backup) {
    pendingBackup = backup;
    previewVersion.textContent = String(backup.version);
    previewGlobal.textContent = backup.global.fontFamily ? backup.global.fontFamily : "Default";
    previewSites.textContent = `${Object.keys(backup.sites).length} ${Object.keys(backup.sites).length === 1 ? "site" : "sites"}`;
    previewTheme.textContent = themeLabels[backup.theme];
    backupPreview.hidden = false;
  }

  exportBtn.addEventListener("click", () => loadCurrentBackup(downloadBackup));

  backupFile.addEventListener("change", () => {
    const file = backupFile.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let backup;
      try {
        backup = JSON.parse(reader.result);
      } catch {
        hidePreview();
        showStatus("The selected file is not valid JSON.", true);
        return;
      }

      const error = validateBackup(backup);
      if (error) {
        hidePreview();
        showStatus(error, true);
        return;
      }

      showPreview(backup);
    };
    reader.onerror = () => {
      hidePreview();
      showStatus("Unable to read the selected backup.", true);
    };
    reader.readAsText(file);
  });

  replaceBtn.addEventListener("click", async () => {
    if (!pendingBackup) return;
    await saveConfiguration(pendingBackup);
    applyTheme(pendingBackup.theme);
    hidePreview();
    showStatus("Backup restored. Existing settings were replaced.");
  });

  mergeBtn.addEventListener("click", async () => {
    if (!pendingBackup) return;
    await mergeBackup(pendingBackup);
    applyTheme(pendingBackup.theme);
    hidePreview();
    showStatus("Backup restored and merged with existing settings.");
  });

  cancelRestoreBtn.addEventListener("click", hidePreview);

  chrome.storage.local.get(["popupTheme"], (result) => {
    const storedTheme = Number.isInteger(result.popupTheme) ? result.popupTheme : 0;
    applyTheme(Math.max(0, Math.min(storedTheme, themes.length - 1)));
    themeBtn.addEventListener("click", () => {
      applyTheme((currentTheme + 1) % themes.length);
      chrome.storage.local.set({ popupTheme: currentTheme });
    });
  });

  versionEl.textContent = `v${chrome.runtime.getManifest().version}`;
});
