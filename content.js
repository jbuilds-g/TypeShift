function detectIcons() {
  const iconSignatures = [
    'link[href*="font-awesome"]',
    'link[href*="fontawesome"]',
    'link[href*="material-icons"]',
    '[class*="fa-"]',
    '[class*="icon-"]',
    ".material-icons",
  ];

  for (let selector of iconSignatures) {
    if (document.querySelector(selector)) return true;
  }
  return false;
}

function applyFontShift(fontFamily) {
  const styleId = "typeshift-custom-styles";
  let styleEl = document.getElementById(styleId);

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const fontUrlParam = encodeURIComponent(fontFamily).replace(/%20/g, "+");

  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=${fontUrlParam}&display=swap');

    :root {
      --typeshift-global-font: "${fontFamily}", sans-serif !important;
    }
    
    *:not(i):not([class*="icon"]):not([class*="fa"]):not([class*="fas"]):not([class*="fab"]):not([class*="far"]):not([class*="mdi"]):not(.material-icons):not([class*="typcn"]) {
      font-family: var(--typeshift-global-font);
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
