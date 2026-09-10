const CONFIGURATION_VERSION = 1;

const ICON_FONT_HINTS = [
  "icon",
  "symbol",
  "glyph",
  "awesome",
  "material",
  "fontello",
  "icomoon",
  "dashicons",
  "octicon",
  "codicon",
  "phosphor",
  "feather",
  "lucide",
  "remix",
  "themify",
  "typicons",
  "simple-line",
  "linea",
  "devicon",
  "weather",
];

const ICON_CLASS_SELECTORS = [
  '[class*="icon-"]',
  '[class*="Icon"]',
  '[class*="fa-"]',
  '[class*="fas-"]',
  '[class*="fab-"]',
  '[class*="far-"]',
  '[class*="mdi-"]',
  '[class*="bi-"]',
  '[class*="ri-"]',
  '[class*="ti-"]',
  '[class*="glyphicon-"]',
  '[class*="codicon-"]',
  '[class*="octicon-"]',
  '[class*="lucide-"]',
  '[class*="ph-"]',
  '[class*="feather-"]',
  '.material-icons',
  '.material-symbols-outlined',
  '.material-symbols-rounded',
  '.material-symbols-sharp',
];

let iconProtectionObserver = null;
let iconProtectionFrame = 0;
let iconProtectionPending = new Set();
let fontLoadToken = 0;

function detectIcons() {
  const iconSignatures = [
    'link[href*="font-awesome"]',
    'link[href*="fontawesome"]',
    'link[href*="material-icons"]',
    'link[href*="material-symbols"]',
    ...ICON_CLASS_SELECTORS,
    'svg',
  ];

  return iconSignatures.some((selector) => document.querySelector(selector));
}

function looksLikeIconFont(fontFamily) {
  const normalized = fontFamily.toLowerCase();
  return ICON_FONT_HINTS.some((hint) => normalized.includes(hint));
}

function protectIconElement(element) {
  if (!(element instanceof Element)) return;

  if (
    element.hasAttribute("data-typeshift-icon-font") ||
    element.matches("svg, [role=\"img\"], [aria-hidden=\"true\"]")
  ) {
    return;
  }

  const computedFont = window.getComputedStyle(element).fontFamily;
  if (looksLikeIconFont(computedFont)) {
    element.setAttribute("data-typeshift-icon-font", "");
    element.style.setProperty(
      "--typeshift-original-font",
      computedFont,
    );
  }
}

function protectIconFonts(root = document) {
  if (root instanceof Element) {
    protectIconElement(root);
  }

  const elements = root.querySelectorAll
    ? root.querySelectorAll("*")
    : [];

  elements.forEach(protectIconElement);
}

function queueIconProtection(element = document) {
  if (element instanceof Element) {
    iconProtectionPending.add(element);
  } else {
    iconProtectionPending.add(document.documentElement);
  }

  if (iconProtectionFrame) return;

  iconProtectionFrame = requestAnimationFrame(() => {
    iconProtectionFrame = 0;

    const pending = [...iconProtectionPending];
    iconProtectionPending.clear();

    pending.forEach((root) => {
      if (root.isConnected) {
        protectIconFonts(root);
      }
    });
  });
}

function startIconProtection() {
  queueIconProtection();

  if (iconProtectionObserver) {
    iconProtectionObserver.disconnect();
  }

  iconProtectionObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            queueIconProtection(node);
          }
        });
      }

      if (
        mutation.type === "attributes" &&
        (mutation.attributeName === "class" ||
          mutation.attributeName === "style" ||
          mutation.attributeName === "aria-hidden" ||
          mutation.attributeName === "role")
      ) {
        queueIconProtection(mutation.target);
      }
    });
  });

  iconProtectionObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "aria-hidden", "role"],
    childList: true,
    subtree: true,
  });

  if (document.fonts) {
    document.fonts.addEventListener("loadingdone", queueIconProtection);
  }
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

  if (document.fonts) {
    document.fonts.removeEventListener("loadingdone", queueIconProtection);
  }

  document.querySelectorAll("[data-typeshift-icon-font]").forEach((element) => {
    element.style.removeProperty("--typeshift-original-font");
    element.removeAttribute("data-typeshift-icon-font");
  });
}

function getGoogleFontUrl(fontFamily) {
  const encoded = encodeURIComponent(fontFamily).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`;
}

function loadGoogleFontStylesheet(fontFamily) {
  const linkId = "typeshift-google-font";
  const href = getGoogleFontUrl(fontFamily);
  const existingLink = document.getElementById(linkId);

  if (existingLink?.getAttribute("href") === href) {
    return existingLink;
  }

  existingLink?.remove();

  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = href;

  link.addEventListener("error", () => {
    console.warn(`TypeShift: Google Fonts unavailable for "${fontFamily}"; using the local font if available.`);
  }, { once: true });

  (document.head || document.documentElement).appendChild(link);
  return link;
}

function installFontStyles(fontFamily) {
  const styleId = "typeshift-custom-styles";
  let styleEl = document.getElementById(styleId);

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  styleEl.textContent = `
    :root {
      --typeshift-global-font: "${fontFamily}", sans-serif;
    }

    /*
     * Apply the selected font broadly, while excluding common icon hosts.
     * Icon fonts detected by their actual computed font are restored below.
     */
    *:not(svg):not([role="img"]):not([aria-hidden="true"]):not([class*="icon"]):not([class*="Icon"]):not([class*="fa-"]):not([class*="fas-"]):not([class*="fab-"]):not([class*="far-"]):not([class*="mdi-"]):not([class*="bi-"]):not([class*="ri-"]):not([class*="ti-"]):not([class*="glyphicon-"]):not([class*="codicon-"]):not([class*="octicon-"]):not([class*="lucide-"]):not([class*="ph-"]):not([class*="feather-"]):not(.material-icons):not(.material-symbols-outlined):not(.material-symbols-rounded):not(.material-symbols-sharp):not(i[class]):not([data-typeshift-icon-font]) {
      font-family: var(--typeshift-global-font) !important;
    }

    [data-typeshift-icon-font] {
      font-family: var(--typeshift-original-font) !important;
    }
  `;

  return styleEl;
}

async function waitForFont(fontFamily) {
  if (!document.fonts) return;

  try {
    await document.fonts.load(`16px "${fontFamily}"`);
  } catch (error) {
    console.warn(`TypeShift: font load check failed for "${fontFamily}"`, error);
  }
}

async function applyFontShift(fontFamily) {
  const currentToken = ++fontLoadToken;

  try {
    // Apply the CSS immediately. Font loading must never block the visual change.
    installFontStyles(fontFamily);
    startIconProtection();

    // Load the web font in parallel. Local/system fonts work without this request.
    loadGoogleFontStylesheet(fontFamily);
    await waitForFont(fontFamily);

    if (currentToken !== fontLoadToken) return;

    // Re-check after the selected web font has finished loading because its
    // @font-face rules can change the computed font of existing elements.
    queueIconProtection();
  } catch (error) {
    console.error("TypeShift: unable to apply font", error);
  }
}

function removeFontShift() {
  fontLoadToken++;
  stopIconProtection();

  const styleEl = document.getElementById("typeshift-custom-styles");
  if (styleEl) {
    styleEl.remove();
  }

  document.getElementById("typeshift-google-font")?.remove();
}

// Resolve the versioned configuration model while remaining compatible with
// the legacy activeFont/siteFonts keys used by earlier TypeShift versions.
function getConfiguration(result, hostname) {
  const global = {
    ...(result.globalConfig || {}),
  };

  if (!global.fontFamily && result.activeFont) {
    global.fontFamily = result.activeFont;
  }

  const sites = {
    ...(result.siteConfigs || {}),
  };

  if (result.siteFonts && typeof result.siteFonts === "object") {
    Object.entries(result.siteFonts).forEach(([domain, fontFamily]) => {
      sites[domain] = {
        ...(sites[domain] || {}),
        fontFamily: sites[domain]?.fontFamily || fontFamily,
      };
    });
  }

  return {
    version: result.configurationVersion || CONFIGURATION_VERSION,
    global,
    site: hostname ? sites[hostname] || {} : {},
  };
}

function persistConfigurationModel(result) {
  const update = {};
  const globalConfig = {
    ...(result.globalConfig || {}),
  };
  const siteConfigs = {
    ...(result.siteConfigs || {}),
  };

  if (!globalConfig.fontFamily && result.activeFont) {
    globalConfig.fontFamily = result.activeFont;
    update.globalConfig = globalConfig;
  }

  if (
    Object.keys(siteConfigs).length === 0 &&
    result.siteFonts &&
    typeof result.siteFonts === "object"
  ) {
    Object.entries(result.siteFonts).forEach(([domain, fontFamily]) => {
      siteConfigs[domain] = { fontFamily };
    });
    update.siteConfigs = siteConfigs;
  }

  if (result.configurationVersion !== CONFIGURATION_VERSION) {
    update.configurationVersion = CONFIGURATION_VERSION;
  }

  if (Object.keys(update).length) {
    chrome.storage.local.set(update);
  }
}

// Listen for interactions from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkIcons") {
    sendResponse({ hasIcons: detectIcons() });
  }

  if (request.action === "applyFont") {
    applyFontShift(request.fontFamily);
    sendResponse({ success: true });
  }

  if (request.action === "removeFont") {
    removeFontShift();
    sendResponse({ success: true });
  }
});

// Auto-apply font on page load based on storage rules
chrome.storage.local.get(
  [
    "configurationVersion",
    "globalConfig",
    "siteConfigs",
    "activeFont",
    "disabledDomains",
    "siteFonts",
  ],
  (result) => {
    persistConfigurationModel(result);

    const disabledDomains = result.disabledDomains || [];
    const configuration = getConfiguration(result, window.location.hostname);
    const fontToApply = configuration.site.fontFamily || configuration.global.fontFamily;

    if (!disabledDomains.includes(window.location.hostname) && fontToApply) {
      applyFontShift(fontToApply);
    }
  },
);
