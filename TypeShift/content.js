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
let typographyObserver = null;
let typographyFrame = 0;
let typographyPending = new Set();
let fontLoadToken = 0;
let appliedConfigurationKey = null;
let appliedFontFamily = "";

const typographyOriginals = new WeakMap();
const typographyTouched = new Set();

const TYPOGRAPHY_SKIP_SELECTOR = [
  "html", "head", "body", "script", "style", "link", "meta", "title",
  "svg", "path", "symbol", "use", "img", "video", "audio", "canvas",
  "iframe", "object", "embed", "br", "hr", "[hidden]",
  '[aria-hidden="true"]',
  "[data-typeshift-icon-font]",
  ...ICON_CLASS_SELECTORS,
].join(",");

function detectIcons() {
  const iconSignatures = [
    'link[href*="font-awesome"]',
    'link[href*="fontawesome"]',
    'link[href*="material-icons"]',
    'link[href*="material-symbols"]',
    ...ICON_CLASS_SELECTORS,
    "svg",
  ];

  return iconSignatures.some((selector) => document.querySelector(selector));
}

function looksLikeIconFont(fontFamily) {
  const normalized = fontFamily.toLowerCase();
  return ICON_FONT_HINTS.some((hint) => normalized.includes(hint));
}

function protectIconFonts(root = document) {
  const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];

  elements.forEach((element) => {
    if (
      element.hasAttribute("data-typeshift-icon-font") ||
      element.matches('svg, [role="img"], [aria-hidden="true"]')
    ) {
      return;
    }

    const computedFont = window.getComputedStyle(element).fontFamily;
    if (looksLikeIconFont(computedFont)) {
      element.setAttribute("data-typeshift-icon-font", "");
      element.style.setProperty("--typeshift-original-font", computedFont);
    }
  });
}

function queueIconProtection(element = document.body) {
  if (element instanceof Element) iconProtectionPending.add(element);
  if (iconProtectionFrame) return;

  iconProtectionFrame = requestAnimationFrame(() => {
    iconProtectionFrame = 0;
    const pending = [...iconProtectionPending];
    iconProtectionPending.clear();

    pending.forEach((root) => {
      if (!root.isConnected) return;
      protectIconFonts(root);
    });
  });
}

function startIconProtection() {
  protectIconFonts();

  if (iconProtectionObserver) iconProtectionObserver.disconnect();

  iconProtectionObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type !== "childList") return;
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) queueIconProtection(node);
      });
    });
  });

  iconProtectionObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function stopIconProtection() {
  if (iconProtectionObserver) {
    iconProtectionObserver.disconnect();
    iconProtectionObserver = null;
  }

  if (iconProtectionFrame) {
    cancelAnimationFrame(iconProtectionFrame);
    iconProtectionFrame = 0;
  }

  iconProtectionPending.clear();

  document.querySelectorAll("[data-typeshift-icon-font]").forEach((element) => {
    element.style.removeProperty("--typeshift-original-font");
    element.removeAttribute("data-typeshift-icon-font");
  });
}

function isTypographyCandidate(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.matches(TYPOGRAPHY_SKIP_SELECTOR)) return false;
  if (element.closest(TYPOGRAPHY_SKIP_SELECTOR)) return false;
  return Boolean(element.textContent?.trim());
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

  if (sizeScale !== 1) {
    element.style.setProperty("font-size", `${original.fontSize * sizeScale}px`, "important");
  }

  if (lineHeightScale !== 1 && original.lineHeight !== null) {
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

      if (root instanceof HTMLElement) {
        applyTypographyToElement(root, sizeScale, lineHeightScale);
      }

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
        return;
      }

      if (
        mutation.type === "attributes" &&
        ["class", "hidden", "aria-hidden", "role"].includes(mutation.attributeName)
      ) {
        queueTypography(mutation.target);
      }
    });
  });

  typographyObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "aria-hidden", "role"],
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

const LOCAL_FONT_FAMILIES = new Set([
  "Arial",
  "Helvetica",
  "Verdana",
  "Trebuchet MS",
  "Gill Sans",
  "Optima",
  "Arial Narrow",
  "Century Gothic",
  "Times New Roman",
  "Georgia",
  "Garamond",
  "Palatino",
  "Baskerville",
  "Bodoni MT",
  "Courier",
  "Courier New",
  "Lucida Console",
  "Monaco",
  "Consolas",
  "Comic Sans MS",
  "Brush Script MT",
  "Lucida Handwriting",
  "Impact",
  "Arial Black",
]);

function isLocalFont(fontFamily) {
  return LOCAL_FONT_FAMILIES.has(fontFamily);
}

const LOCAL_FONT_FAMILIES = new Set([
  "Arial",
  "Helvetica",
  "Verdana",
  "Trebuchet MS",
  "Gill Sans",
  "Optima",
  "Arial Narrow",
  "Century Gothic",
  "Times New Roman",
  "Georgia",
  "Garamond",
  "Palatino",
  "Baskerville",
  "Bodoni MT",
  "Courier",
  "Courier New",
  "Lucida Console",
  "Monaco",
  "Consolas",
  "Comic Sans MS",
  "Brush Script MT",
  "Lucida Handwriting",
  "Impact",
  "Arial Black",
]);

function isLocalFont(fontFamily) {
  return LOCAL_FONT_FAMILIES.has(fontFamily);
}

function waitForMessage(request) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(request, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.success) {
        reject(new Error(response?.error || "Font loading failed"));
        return;
      }

      resolve(response.faces || []);
    });
  });
}

async function loadGoogleFont(fontFamily, token) {
  const faces = await waitForMessage({
    action: "loadGoogleFont",
    fontFamily,
  });

  if (token !== fontLoadToken) return false;

  for (const face of faces) {
    const source = `data:font/woff2;base64,${face.data}`;
    const descriptors = {
      style: face.style || "normal",
      weight: face.weight || "400",
      stretch: face.stretch || "normal",
    };

    if (face.unicodeRange) {
      descriptors.unicodeRange = face.unicodeRange;
    }

    const font = new FontFace(fontFamily, `url("${source}")`, descriptors);
    await font.load();

    if (token !== fontLoadToken) return false;

    document.fonts.add(font);
  }

  if (token !== fontLoadToken) return false;

  const loaded = await document.fonts.load(`16px "${fontFamily}"`);
  if (!loaded.length) {
    throw new Error(`No usable font face found for "${fontFamily}"`);
  }

  return true;
}

function installFontStyles(fontFamily) {
  const styleId = "typeshift-custom-styles";
  let styleEl = document.getElementById(styleId);

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  const safeFontFamily = JSON.stringify(fontFamily);

  styleEl.textContent = `
    :root { --typeshift-global-font: ${safeFontFamily}, sans-serif; }

    *:not(svg):not([role="img"]):not([aria-hidden="true"]):not([class*="icon"]):not([class*="Icon"]):not([class*="fa-"]):not([class*="fas-"]):not([class*="fab-"]):not([class*="far-"]):not([class*="mdi-"]):not([class*="bi-"]):not([class*="ri-"]):not([class*="ti-"]):not([class*="glyphicon-"]):not([class*="codicon-"]):not([class*="octicon-"]):not([class*="lucide-"]):not([class*="ph-"]):not([class*="feather-"]):not(.material-icons):not(.material-symbols-outlined):not(.material-symbols-rounded):not(.material-symbols-sharp):not(i[class]):not([data-typeshift-icon-font]) {
      font-family: var(--typeshift-global-font) !important;
    }

    [data-typeshift-icon-font] {
      font-family: var(--typeshift-original-font) !important;
    }
  `;
}

async function applyConfiguration(fontFamily = "", size = 100, lineHeight = 100) {
  const normalizedFont = typeof fontFamily === "string" ? fontFamily.trim() : "";
  const normalizedSize = Number.isFinite(Number(size)) ? Number(size) : 100;
  const normalizedLineHeight = Number.isFinite(Number(lineHeight)) ? Number(lineHeight) : 100;
  const configurationKey = `enabled:${normalizedFont}:${normalizedSize}:${normalizedLineHeight}`;

  if (appliedConfigurationKey === configurationKey) return true;

  const currentToken = ++fontLoadToken;

  try {
    if (normalizedFont) {
      startIconProtection();

      if (isLocalFont(normalizedFont)) {
        appliedFontFamily = normalizedFont;
      } else if (appliedFontFamily !== normalizedFont) {
        const loaded = await loadGoogleFont(normalizedFont, currentToken);
        if (!loaded || currentToken !== fontLoadToken) return false;

        appliedFontFamily = normalizedFont;
      } else {
        const loaded = await document.fonts.load(`16px "${normalizedFont}"`);
        if (!loaded.length || currentToken !== fontLoadToken) return false;
      }

      if (currentToken !== fontLoadToken) return false;

      installFontStyles(normalizedFont);

      if (normalizedSize !== 100 || normalizedLineHeight !== 100) {
        startTypographyProtection(normalizedSize, normalizedLineHeight);
      } else {
        stopTypographyProtection();
      }

      queueIconProtection();
      appliedConfigurationKey = configurationKey;
      return true;
    }

    appliedFontFamily = "";
    stopIconProtection();
    document.getElementById("typeshift-custom-styles")?.remove();
    document.getElementById("typeshift-google-font")?.remove();
    document.getElementById("typeshift-google-font-pending")?.remove();

    if (normalizedSize !== 100 || normalizedLineHeight !== 100) {
      startTypographyProtection(normalizedSize, normalizedLineHeight);
    } else {
      stopTypographyProtection();
    }

    appliedConfigurationKey = configurationKey;
    return true;
  } catch (error) {
    if (currentToken === fontLoadToken) {
      appliedConfigurationKey = null;
      console.error("TypeShift: unable to apply configuration", error);
    }
    return false;
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
  const siteFont =
    result.siteConfigs?.[hostname]?.fontFamily ||
    result.siteFonts?.[hostname] ||
    "";
  const globalConfig = result.globalConfig || {};
  const siteConfig = result.siteConfigs?.[hostname] || {};

  return {
    fontFamily: siteFont || globalFont,
    size: siteConfig.size ?? globalConfig.size ?? 100,
    lineHeight: siteConfig.lineHeight ?? globalConfig.lineHeight ?? 100,
    source: siteFont ? "site" : "global",
  };
}

function applyStoredConfiguration(force = false) {
  chrome.storage.local.get(
    [
      "configurationVersion",
      "globalConfig",
      "siteConfigs",
      "activeFont",
      "disabledDomains",
      "siteFonts",
      "enabled",
    ],
    (result) => {
      const hostname = window.location.hostname;

      if (result.enabled === false) {
        if (force || appliedConfigurationKey !== "disabled") {
          removeFontShift();
        }
        return;
      }

      const disabled = (result.disabledDomains || []).includes(hostname);
      const configuration = resolveConfiguration(result, hostname);
      const configurationKey = disabled
        ? "disabled"
        : `enabled:${configuration.fontFamily || ""}:${configuration.size}:${configuration.lineHeight}`;

      if (!force && configurationKey === appliedConfigurationKey) return;

      if (disabled) {
        removeFontShift();
      } else {
        applyConfiguration(
          configuration.fontFamily,
          configuration.size,
          configuration.lineHeight,
        );
      }
    },
  );
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkIcons") {
    sendResponse({ hasIcons: detectIcons() });
    return;
  }

  if (request.action === "applyConfiguration") {
    chrome.storage.local.get(["enabled"], async (result) => {
      if (result.enabled === false) {
        removeFontShift();
        sendResponse({ success: false, disabled: true });
        return;
      }

      const success = await applyConfiguration(
        request.fontFamily,
        request.size,
        request.lineHeight,
      );

      sendResponse({ success });
    });
    return true;
  }

  if (request.action === "applyFont") {
    chrome.storage.local.get(["enabled", "globalConfig", "siteConfigs"], async (result) => {
      if (result.enabled === false) {
        removeFontShift();
        sendResponse({ success: false, disabled: true });
        return;
      }

      const globalConfig = result.globalConfig || {};
      const siteConfig = result.siteConfigs?.[window.location.hostname] || {};
      const success = await applyConfiguration(
        request.fontFamily,
        siteConfig.size ?? globalConfig.size ?? 100,
        siteConfig.lineHeight ?? globalConfig.lineHeight ?? 100,
      );

      sendResponse({ success });
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
    "configurationVersion",
    "globalConfig",
    "siteConfigs",
    "activeFont",
    "disabledDomains",
    "siteFonts",
    "enabled",
  ];

  if (relevantKeys.some((key) => changes[key])) {
    applyStoredConfiguration();
  }
});

applyStoredConfiguration(true);
