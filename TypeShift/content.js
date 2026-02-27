(() => {
  // Only load Google Fonts for non-system fonts
  const SYSTEM_FONTS = ["system-ui", "Arial", "Segoe UI", "Roboto", "Helvetica Neue"];
  const DOMAIN = window.location.hostname;
  
  const STYLE_ID = 'typeshift-engine';
  const LINK_ID = 'typeshift-google-fonts';

  // Apply immediately on load
  update();

  // Listen for real-time changes from the popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.activeFont || changes.excludedSites)) {
      update();
    }
  });

  function update() {
    chrome.storage.local.get(['activeFont', 'excludedSites'], (data) => {
      const isExcluded = (data.excludedSites || []).includes(DOMAIN);
      if (isExcluded || !data.activeFont) {
        cleanup();
        return;
      }
      apply(data.activeFont);
    });
  }

  function cleanup() {
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(LINK_ID)?.remove();
  }

  function apply(font) {
    cleanup();

    const isSystemFont = SYSTEM_FONTS.includes(font);

    // Fetch from Google Fonts if it's not a local system font
    if (!isSystemFont) {
      const link = document.createElement('link');
      link.id = LINK_ID;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}&display=swap`;
      // We append to documentElement just in case head isn't parsed yet (run_at: document_start)
      (document.head || document.documentElement).appendChild(link);
    }

    // Determine font stack
    const fontStack = isSystemFont ? font : `"${font}", system-ui, sans-serif`;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    
    // CSS engineered to override text but ignore standard icon libraries natively
    style.textContent = `
      /* Root elements and standard text containers */
      body, h1, h2, h3, h4, h5, h6, p, a, span, div, li, td, th, input, textarea, button, select {
        font-family: ${fontStack} !important;
      }

      /* ICON PROTECTION: Explicitly reset known icon classes to inherit/initial */
      [class*="icon"],
      [class*="Icon"],
      [class*="symbol"],
      [class*="material"],
      [class^="fa-"],
      .fa, .fas, .fab, .far, .fal,
      .google-symbols,
      mat-icon,
      i, 
      svg, 
      svg *,
      [role="img"],
      [aria-hidden="true"],
      [data-icon] {
        font-family: inherit !important;
        font-feature-settings: "liga" 1 !important;
        font-variant-ligatures: normal !important;
        letter-spacing: normal !important;
        text-transform: none !important;
      }
    `;
    
    (document.head || document.documentElement).appendChild(style);
  }
})();