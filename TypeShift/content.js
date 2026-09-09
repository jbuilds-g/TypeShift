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
    return Promise.resolve(true);
  }

  existingLink?.remove();

  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = href;

    link.onload = () => resolve(true);
    link.onerror = () => {
      console.warn(`TypeShift: Google Fonts unavailable for "${fontFamily}"; using the local font if available.`);
      resolve(false);
    };

    (document.head || document.documentElement).appendChild(link);
  });
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
    await loadGoogleFontStylesheet(fontFamily);

    if (currentToken !== fontLoadToken) return;

    const styleEl = installFontStyles(fontFamily);
    await waitForFont(fontFamily);

    if (currentToken !== fontLoadToken) return;

    void styleEl.offsetHeight;
    startIconProtection();
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
