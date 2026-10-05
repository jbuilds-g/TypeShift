const CONFIGURATION_VERSION = 1;

const ICON_FONT_HINTS = [
  "icon", "symbol", "glyph", "awesome", "material", "fontello", "icomoon",
  "dashicons", "octicon", "codicon", "phosphor", "feather", "lucide", "remix",
  "themify", "typicons", "simple-line", "linea", "devicon", "weather",
];

const ICON_CLASS_SELECTORS = [
  '[class*="icon-"]', '[class*="Icon"]', '[class*="fa-"]', '[class*="fas-"]',
  '[class*="fab-"]', '[class*="far-"]', '[class*="mdi-"]', '[class*="bi-"]',
  '[class*="ri-"]', '[class*="ti-"]', '[class*="glyphicon-"]', '[class*="codicon-"]',
  '[class*="octicon-"]', '[class*="lucide-"]', '[class*="ph-"]', '[class*="feather-"]',
  ".material-icons", ".material-symbols-outlined", ".material-symbols-rounded",
  ".material-symbols-sharp",
];

let iconProtectionObserver = null;
let iconProtectionFrame = 0;
let iconProtectionPending = new Set();
let fontLoadToken = 0;
let appliedConfigurationKey = null;
let appliedFontFamily = "";
let typographyBaseMetrics = null;
const typographyOriginals = new WeakMap();
const typographyTouched = new Set();
let typographyObserver = null;
let typographyFrame = 0;
let typographyPending = new Set();

const TYPOGRAPHY_SKIP_SELECTOR = [
  "html", "head", "body", "script", "style", "link", "meta", "title",
  "svg", "path", "symbol", "use", "img", "video", "audio", "canvas",
  "iframe", "object", "embed", "br", "hr", "[hidden]",
  '[aria-hidden="true"]',
  "[data-typeshift-icon-font]",
  ...ICON_CLASS_SELECTORS,
].join(",");

function isTypographyCandidate(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.matches(TYPOGRAPHY_SKIP_SELECTOR)) return false;
  if (element.closest(TYPOGRAPHY_SKIP_SELECTOR)) return false;
  if (!element.textContent?.trim()) return false;
  return true;
}

function getOriginalTypography(element) {
  let original = typographyOriginals.get(element);
  if (original) return original;

  const computed = window.getComputedStyle(element);
  const fontSize = Number.parseFloat(computed.fontSize);
  const lineHeight = computed.lineHeight === "normal"
    ? null
    : Number.parseFloat(computed.lineHeight);

  if (!Number.isFinite(fontSize)) return null;

  original = {
    fontSize,
    lineHeight: Number.isFinite(lineHeight) ? lineHeight : null,
    inlineFontSize: element.style.getPropertyValue("font-size"),
    inlineFontSizePriority: element.style.getPropertyPriority("font-size"),
    inlineLineHeight: element.style.getPropertyValue("line-height"),
    inlineLineHeightPriority: element.style.getPropertyPriority("line-height"),
  };

  typographyOriginals.set(element, original);
  typographyTouched.add(element);
  return original;
}

function restoreTypographyElement(element) {
  const original = typographyOriginals.get(element);
  if (!original || !element.isConnected) return;

  if (original.inlineFontSize) {
    element.style.setProperty("font-size", original.inlineFontSize, original.inlineFontSizePriority);
  } else {
    element.style.removeProperty("font-size");
  }

  if (original.inlineLineHeight) {
    element.style.setProperty("line-height", original.inlineLineHeight, original.inlineLineHeightPriority);
  } else {
    element.style.removeProperty("line-height");
  }
}

function restoreTypography() {
  typographyTouched.forEach((element) => {
    if (element.isConnected) restoreTypographyElement(element);
  });
  typographyTouched.clear();
  typographyPending.clear();
}

function applyTypographyToElement(element, sizeScale, lineHeightScale) {
  if (!isTypographyCandidate(element)) return;

  const original = getOriginalTypography(element);
  if (!original) return;

  element.style.setProperty("font-size", `${original.fontSize * sizeScale}px`, "important");

  if (original.lineHeight !== null) {
    element.style.setProperty(
      "line-height",
      `${original.lineHeight * lineHeightScale}px`,
      "important",
    );
  }
}

function queueTypography(element = document.body) {
  if (element instanceof Element) typographyPending.add(element);
  else if (document.body) typographyPending.add(document.body);
  if (typographyFrame) return;

  typographyFrame = requestAnimationFrame(() => {
    typographyFrame = 0;
    const pending = [...typographyPending];
    typographyPending.clear();

    const sizeScale = Number(window.__typeshiftSizeScale || 1);
    const lineHeightScale = Number(window.__typeshiftLineHeightScale || 1);
    pending.forEach((root) => {
      if (!root.isConnected) return;
      if (root instanceof HTMLElement) applyTypographyToElement(root, sizeScale, lineHeightScale);
      root.querySelectorAll?.("*").forEach((element) => {
        applyTypographyToElement(element, sizeScale, lineHeightScale);
      });
    });
  });
}

function startTypographyProtection(size = 100, lineHeight = 100) {
  window.__typeshiftSizeScale = Number(size) / 100;
  window.__typeshiftLineHeightScale = Number(lineHeight) / 100;

  if (typographyObserver) typographyObserver.disconnect();
  typographyObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) queueTypography(node);
        });
      } else if (
        mutation.type === "attributes" &&
        ["class", "hidden", "aria-hidden", "role"].includes(mutation.attributeName)
      ) {
        queueTypography(mutation.target);
      } else if (
        mutation.type === "attributes" &&
        mutation.attributeName === "style" &&
        !typographyTouched.has(mutation.target)
      ) {
        queueTypography(mutation.target);
      }
    });
  });

  typographyObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "aria-hidden", "role"],
  });

  queueTypography(document.body);
}

function stopTypographyProtection() {
  if (typographyObserver) {
    typographyObserver.disconnect();
    typographyObserver = null;
  }
  if (typographyFrame) {
    cancelAnimationFrame(typographyFrame);
    typographyFrame = 0;
  }
  restoreTypography();
  delete window.__typeshiftSizeScale;
  delete window.__typeshiftLineHeightScale;
}

function installFontStyles(fontFamily, size = 100, lineHeight = 100) {
  const styleId = "typeshift-custom-styles";
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  styleEl.textContent = `
    :root { --typeshift-global-font: "${fontFamily}", sans-serif; }
    *:not(svg):not([role="img"]):not([aria-hidden="true"]):not([class*="icon"]):not([class*="Icon"]):not([class*="fa-"]):not([class*="fas-"]):not([class*="fab-"]):not([class*="far-"]):not([class*="mdi-"]):not([class*="bi-"]):not([class*="ri-"]):not([class*="ti-"]):not([class*="glyphicon-"]):not([class*="codicon-"]):not([class*="octicon-"]):not([class*="lucide-"]):not([class*="ph-"]):not([class*="feather-"]):not(.material-icons):not(.material-symbols-outlined):not(.material-symbols-rounded):not(.material-symbols-sharp):not(i[class]):not([data-typeshift-icon-font]) {
      font-family: var(--typeshift-global-font) !important;
    }
    [data-typeshift-icon-font] { font-family: var(--typeshift-original-font) !important; }
  `;

  startTypographyProtection(size, lineHeight);
  return styleEl;
}
async function waitForFont(fontFamily) {
  if (!document.fonts) return;
  try { await document.fonts.load(`16px "${fontFamily}"`); }
  catch (error) { console.warn(`TypeShift: font load check failed for "${fontFamily}"`, error); }
}

function getVerificationElement() {
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
  let element = walker.currentNode;
  while (element) {
    if (
      element instanceof Element &&
      element !== document.body &&
      element !== document.documentElement &&
      element.textContent?.trim() &&
      !element.matches('svg, [role="img"], [aria-hidden="true"], [data-typeshift-icon-font], ' + ICON_CLASS_SELECTORS.join(", "))
    ) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return element;
    }
    element = walker.nextNode();
  }
  return null;
}

function firstFontFamily(fontFamily) {
  return fontFamily.split(",")[0].trim().replace(/^['"]|['"]$/g, "").toLowerCase();
}

function isFontApplied(fontFamily) {
  const element = getVerificationElement();
  if (!element) return true;
  if (firstFontFamily(window.getComputedStyle(element).fontFamily) !== firstFontFamily(fontFamily)) return false;
  if (document.fonts) {
    try { return document.fonts.check(`16px "${fontFamily}"`); }
    catch { return true; }
  }
  return true;
}

function getRecoveryKey(fontFamily) { return `typeshift-recovery:${fontFamily}`; }

async function verifyFontApplication(fontFamily, currentToken) {
  const checks = [0, 250, 750];
  for (const delay of checks) {
    if (currentToken !== fontLoadToken) return true;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (isFontApplied(fontFamily)) {
      sessionStorage.removeItem(getRecoveryKey(fontFamily));
      return true;
    }
  }
  if (currentToken !== fontLoadToken) return true;
  const recoveryKey = getRecoveryKey(fontFamily);
  if (sessionStorage.getItem(recoveryKey) === "1") {
    sessionStorage.removeItem(recoveryKey);
    return false;
  }
  sessionStorage.setItem(recoveryKey, "1");
  window.location.reload();
  return false;
}

async function applyConfiguration(fontFamily = "", size = 100, lineHeight = 100) {
  const normalizedFont = typeof fontFamily === "string" ? fontFamily.trim() : "";
  const normalizedSize = Number.isFinite(Number(size)) ? Number(size) : 100;
  const normalizedLineHeight = Number.isFinite(Number(lineHeight)) ? Number(lineHeight) : 100;
  const configurationKey = `enabled:${normalizedFont}:${normalizedSize}:${normalizedLineHeight}`;

  if (appliedConfigurationKey === configurationKey) return;

  const currentToken = ++fontLoadToken;
  appliedConfigurationKey = configurationKey;

  try {
    if (normalizedFont) {
      const fontChanged = appliedFontFamily !== normalizedFont;
      installFontStyles(normalizedFont, normalizedSize, normalizedLineHeight);
      startIconProtection();

      if (fontChanged) {
        loadGoogleFontStylesheet(normalizedFont);
        await waitForFont(normalizedFont);
        if (currentToken !== fontLoadToken) return;
        appliedFontFamily = normalizedFont;
        queueIconProtection();
        await verifyFontApplication(normalizedFont, currentToken);
      } else {
        queueIconProtection();
      }
      return;
    }

    appliedFontFamily = "";
    stopIconProtection();
    document.getElementById("typeshift-custom-styles")?.remove();
    document.getElementById("typeshift-google-font")?.remove();
    startTypographyProtection(normalizedSize, normalizedLineHeight);
  } catch (error) {
    console.error("TypeShift: unable to apply configuration", error);
  }
}

function removeFontShift() {
  fontLoadToken++;
  appliedConfigurationKey = "disabled";
  appliedFontFamily = "";
  stopIconProtection();
  stopTypographyProtection();
  document.getElementById("typeshift-custom-styles")?.remove();
  document.getElementById("typeshift-google-font")?.remove();
}

function resolveConfiguration(result, hostname) {
  if (result.configurationVersion !== CONFIGURATION_VERSION) {
    return {
      fontFamily: result.siteFonts?.[hostname] || result.activeFont || "",
      size: result.globalConfig?.size || 100,
      lineHeight: result.globalConfig?.lineHeight || 100,
      source: result.siteFonts?.[hostname] ? "site" : "global",
    };
  }
  const globalFont = result.globalConfig?.fontFamily || result.activeFont || "";
  const siteFont = result.siteConfigs?.[hostname]?.fontFamily || result.siteFonts?.[hostname] || "";
  const globalConfig = result.globalConfig || {};
  const siteConfig = result.siteConfigs?.[hostname] || {};
  return { fontFamily: siteFont || globalFont, size: siteConfig.size ?? globalConfig.size ?? 100, lineHeight: siteConfig.lineHeight ?? globalConfig.lineHeight ?? 100, source: siteFont ? "site" : "global" };
}

function applyStoredConfiguration(force = false) {
  chrome.storage.local.get(
    ["configurationVersion", "globalConfig", "siteConfigs", "activeFont", "disabledDomains", "siteFonts", "enabled"],
    (result) => {
      const hostname = window.location.hostname;
      if (result.enabled === false) {
        if (force || appliedConfigurationKey !== "disabled") removeFontShift();
        return;
      }
      const disabled = (result.disabledDomains || []).includes(hostname);
      const configuration = resolveConfiguration(result, hostname);
      const configurationKey = disabled ? "disabled" : `enabled:${configuration.fontFamily || ""}:${configuration.size}:${configuration.lineHeight}`;
      if (!force && configurationKey === appliedConfigurationKey) return;
      if (disabled) removeFontShift();
      else applyConfiguration(configuration.fontFamily, configuration.size, configuration.lineHeight);
    },
  );
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkIcons") sendResponse({ hasIcons: detectIcons() });
  if (request.action === "applyConfiguration") {
    chrome.storage.local.get(["enabled"], (result) => {
      if (result.enabled === false) { removeFontShift(); sendResponse({ success: false, disabled: true }); return; }
      applyConfiguration(request.fontFamily, request.size, request.lineHeight);
      sendResponse({ success: true });
    });
    return true;
  }
  if (request.action === "applyFont") {
    chrome.storage.local.get(["enabled"], (result) => {
      if (result.enabled === false) {
        removeFontShift();
        sendResponse({ success: false, disabled: true });
        return;
      }
      chrome.storage.local.get(["globalConfig", "siteConfigs"], (configResult) => {
        const globalConfig = configResult.globalConfig || {};
        const siteConfig = configResult.siteConfigs?.[window.location.hostname] || {};
        applyConfiguration(
          request.fontFamily,
          siteConfig.size ?? globalConfig.size ?? 100,
          siteConfig.lineHeight ?? globalConfig.lineHeight ?? 100,
        );
      });
      sendResponse({ success: true });
    });
    return true;
  }
  if (request.action === "removeFont") {
    removeFontShift();
    sendResponse({ success: true });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  const relevantKeys = [
    "configurationVersion", "globalConfig", "siteConfigs", "activeFont",
    "disabledDomains", "siteFonts", "enabled",
  ];
  if (relevantKeys.some((key) => changes[key])) applyStoredConfiguration();
});

applyStoredConfiguration(true);
