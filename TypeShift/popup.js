const FONT_DATA = {
  "System / Native": ["system-ui", "Arial", "Segoe UI", "Roboto", "Helvetica Neue"],
  "Reading Focus": ["Inter", "Lexend", "IBM Plex Sans", "Source Sans 3"],
  "Development": ["JetBrains Mono", "Fira Code", "Cascadia Code", "Iosevka"],
  "Stylized": ["Comic Neue", "VT323", "Orbitron", "Press Start 2P"]
};

document.addEventListener('DOMContentLoaded', async () => {
  const selector = document.getElementById('fontSelect');
  const toggle = document.getElementById('excludeToggle');

  // Populate Dropdown
  for (const [category, fonts] of Object.entries(FONT_DATA)) {
    const group = document.createElement('optgroup');
    group.label = category;
    fonts.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      group.appendChild(opt);
    });
    selector.appendChild(group);
  }

  // Identify Current Active Domain safely
  let domain = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && tab.url.startsWith('http')) {
      domain = new URL(tab.url).hostname;
    } else {
      toggle.disabled = true; // Disable if on extension/browser pages
    }
  } catch (e) {
    console.error("TypeShift: Could not parse domain", e);
  }

  // Load Saved State
  chrome.storage.local.get(['activeFont', 'excludedSites'], (data) => {
    if (data.activeFont) selector.value = data.activeFont;
    const blacklist = data.excludedSites || [];
    if (domain) toggle.checked = blacklist.includes(domain);
  });

  // Handle Font Selection
  selector.addEventListener('change', () => {
    chrome.storage.local.set({ activeFont: selector.value });
  });

  // Handle Exclusion Toggle
  toggle.addEventListener('change', () => {
    if (!domain) return;
    chrome.storage.local.get(['excludedSites'], (data) => {
      let list = data.excludedSites || [];
      if (toggle.checked) {
        if (!list.includes(domain)) list.push(domain);
      } else {
        list = list.filter(site => site !== domain);
      }
      chrome.storage.local.set({ excludedSites: list });
    });
  });
});