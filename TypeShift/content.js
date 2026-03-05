// 1. Detect Fragile Icons
function detectIcons() {
  const iconSignatures = [
    'link[href*="font-awesome"]',
    'link[href*="fontawesome"]',
    'link[href*="material-icons"]',
    '[class*="fa-"]',
    '[class*="icon-"]',
    '.material-icons'
  ];
  
  for (let selector of iconSignatures) {
    if (document.querySelector(selector)) {
      return true; // Icons detected
    }
  }
  return false;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkIcons") {
    sendResponse({ hasIcons: detectIcons() });
  }
  
  if (request.action === "applyFont") {
    applyFontShift(request.fontFamily);
    sendResponse({ success: true });
  }
});

// 2. Apply Font with Icon Protection
function applyFontShift(fontFamily) {
  const styleId = 'typeshift-custom-styles';
  let styleEl = document.getElementById(styleId);
  
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  // The CSS :not() selectors protect common icon components from being overwritten
  styleEl.textContent = `
    :root {
      --typeshift-global-font: "${fontFamily}", sans-serif !important;
    }
    
    /* Apply to all elements EXCEPT common icon tags and classes */
    *:not(i):not([class*="icon"]):not([class*="fa"]):not([class*="fas"]):not([class*="fab"]):not([class*="far"]):not([class*="mdi"]):not(.material-icons):not([class*="typcn"]) {
      font-family: var(--typeshift-global-font);
    }
  `;
}