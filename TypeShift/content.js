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

const ICON_CANDIDATE_SELECTOR = [
  ...ICON_CLASS_SELECTORS,
  'i[class]',
  '[aria-hidden="true"]',
  '[role="img"]',
].join(",");

let iconProtectionObserver = null;
let iconProtectionFrame = null;
let iconProtectionPending = new Set();

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
  if (
    element.hasAttribute("data-typeshift-icon-font") ||
    element.matches("svg, [role=\"img\"], [aria-hidden=\"true\"]")
  ) {
    return;
  }

  const computedFont = window.getComputedStyle(element).fontFamily;
  if (looksLikeIconFont(computedFont)) {
    element.setAttribute("data-typeshift-icon-font", "");
    element.style.setProperty("--typeshift-original-font", computedFont);
  }
}

function queueIconProtection(root = document) {
  if (!root.querySelectorAll) {
    return;
  }

  if (root.matches?.(ICON_CANDIDATE_SELECTOR)) {
    iconProtectionPending.add(root);
  }

  root.querySelectorAll(ICON_CANDIDATE_SELECTOR).forEach((element) => {
    iconProtectionPending.add(element);
  });

  if (iconProtectionFrame !== null) {
    return;
  }

  iconProtectionFrame = requestAnimationFrame(() => {
    iconProtectionFrame = null;

    const pending = iconProtectionPending;
    iconProtectionPending = new Set();

    pending.forEach((element) => {
      if (element.isConnected) {
        protectIconElement(element);
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
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          queueIconProtection(node);
        }
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

  if (iconProtectionFrame !== null) {
    cancelAnimationFrame(iconProtectionFrame);
    iconProtectionFrame = null;
  }

  iconProtectionPending.clear();

  document.querySelectorAll("[data-typeshift-icon-font]").forEach((element) => {
    element.style.removeProperty("--typeshift-original-font");
    element.removeAttribute("data-typeshift-icon-font");
  });
}

function applyFontShift(fontFamily) {
  const styleId = "typeshift-custom-styles";
  let styleEl = document.getElementById(styleId);

  // Capture known icon-font elements before TypeShift changes the cascade.
  queueIconProtection();

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  const fontUrlParam = encodeURIComponent(fontFamily).replace(/%20/g, "+");

  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=${fontUrlParam}&display=swap');

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

  startIconProtection();
}

function removeFontShift() {
  stopIconProtection();

  const styleEl = document.getElementById("typeshift-custom-styles");
  if (styleEl) {
    styleEl.remove();
  }
}

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

chrome.storage.local.get(
  ["activeFont", "disabledDomains", "siteFonts"],
  (result) => {
    const disabledDomains = result.disabledDomains || [];
    const siteFonts = result.siteFonts || {};
    const currentHostname = window.location.hostname;

    if (!disabledDomains.includes(currentHostname)) {
      const fontToApply = siteFonts[currentHostname] || result.activeFont;
      if (fontToApply) {
        applyFontShift(fontToApply);
      }
    }
  },
);
