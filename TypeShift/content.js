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
     * Change typography without flattening the site's icon system.
     * Icon fonts are commonly rendered through pseudo-elements, so
     * protecting the host element also protects its ::before/::after glyph.
     */
    body,
    body :where(
      p, h1, h2, h3, h4, h5, h6,
      li, dt, dd, blockquote, pre, code,
      input, textarea, select, button, label,
      table, caption, th, td, a
    ) {
      font-family: var(--typeshift-global-font) !important;
    }

    body :where(
      svg, [role="img"], [aria-hidden="true"],
      [class*="icon"], [class*="Icon"],
      [class*="fa-"], [class*="fas-"], [class*="fab-"], [class*="far-"],
      [class*="mdi-"], [class*="bi-"], [class*="ri-"], [class*="ti-"],
      [class*="glyphicon-"], [class*="codicon-"], [class*="octicon-"],
      [class*="lucide-"], [class*="ph-"], [class*="feather-"],
      .material-icons, .material-symbols-outlined,
      .material-symbols-rounded, .material-symbols-sharp,
      i[class]
    ) {
      font-family: inherit !important;
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
