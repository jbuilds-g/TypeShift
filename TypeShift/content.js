function detectIcons() {
  const iconSignatures = [
    'link[href*="font-awesome"]',
    'link[href*="fontawesome"]',
    'link[href*="material-icons"]',
    'link[href*="material-symbols"]',
    '[class*="fa-"]',
    '[class*="fas-"]',
    '[class*="fab-"]',
    '[class*="far-"]',
    '[class*="icon-"]',
    '[class*="Icon"]',
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
    'svg',
  ];

  return iconSignatures.some((selector) => document.querySelector(selector));
}

function applyFontShift(fontFamily) {
  const styleId = "typeshift-custom-styles";
  let styleEl = document.getElementById(styleId);

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
     * Apply the selected font broadly, but leave common icon hosts alone.
     * This protects icon fonts and SVG icons without excluding every <i>
     * element, which would also break ordinary italic text.
     */
    *:not(svg):not([role="img"]):not([aria-hidden="true"]):not([class*="icon"]):not([class*="Icon"]):not([class*="fa-"]):not([class*="fas-"]):not([class*="fab-"]):not([class*="far-"]):not([class*="mdi-"]):not([class*="bi-"]):not([class*="ri-"]):not([class*="ti-"]):not([class*="glyphicon-"]):not([class*="codicon-"]):not([class*="octicon-"]):not([class*="lucide-"]):not([class*="ph-"]):not([class*="feather-"]):not(.material-icons):not(.material-symbols-outlined):not(.material-symbols-rounded):not(.material-symbols-sharp):not(i[class]) {
      font-family: var(--typeshift-global-font) !important;
    }
  `;
}

function removeFontShift() {
  const styleEl = document.getElementById("typeshift-custom-styles");
  if (styleEl) {
    styleEl.remove();
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
