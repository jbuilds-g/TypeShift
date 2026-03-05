document.addEventListener('DOMContentLoaded', () => {
  const fontSelect = document.getElementById('font-select');
  const applyBtn = document.getElementById('apply-btn');
  const toggleDisableBtn = document.getElementById('toggle-disable-btn');
  const warningBox = document.getElementById('icon-warning');
  const statusMessage = document.getElementById('status-message');

  let currentHostname = '';
  let disabledDomains = [];

  // Helper function to extract hostname safely
  function getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return null;
    }
  }

  // Helper function to show status
  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.display = 'block';
    if (isError) {
      statusMessage.style.background = '#f8d7da';
      statusMessage.style.color = '#721c24';
      statusMessage.style.borderColor = '#f5c6cb';
    } else {
      statusMessage.style.background = '#d4edda';
      statusMessage.style.color = '#155724';
      statusMessage.style.borderColor = '#c3e6cb';
    }
  }

  // Populate Font Dropdown
  for (const [category, fonts] of Object.entries(typeShiftFonts)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category.toUpperCase();
    
    fonts.forEach(font => {
      const option = document.createElement('option');
      option.value = font;
      option.textContent = font;
      option.style.fontFamily = font;
      optgroup.appendChild(option);
    });
    
    fontSelect.appendChild(optgroup);
  }

  // Update UI based on disabled status
  function updateToggleUI() {
    if (disabledDomains.includes(currentHostname)) {
      toggleDisableBtn.textContent = 'Enable for this website';
      toggleDisableBtn.classList.add('is-disabled');
      applyBtn.disabled = true;
    } else {
      toggleDisableBtn.textContent = 'Disable for this website';
      toggleDisableBtn.classList.remove('is-disabled');
      applyBtn.disabled = false;
    }
  }

  // 1. Get current tab details
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return;
    
    currentHostname = getHostname(tabs[0].url);
    
    // Only show disable button on valid web pages (hide on chrome:// extensions pages, etc.)
    if (currentHostname && !tabs[0].url.startsWith('chrome')) {
      toggleDisableBtn.style.display = 'block';
    }

    // 2. Load storage state
    chrome.storage.local.get(['activeFont', 'disabledDomains'], (result) => {
      if (result.activeFont) {
        fontSelect.value = result.activeFont;
        showStatus(`Current active font: ${result.activeFont}`);
      }
      disabledDomains = result.disabledDomains || [];
      updateToggleUI();
    });

    // 3. Check for fragile icons
    chrome.tabs.sendMessage(tabs[0].id, { action: "checkIcons" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.hasIcons) {
        warningBox.style.display = 'block';
      }
    });
  });

  // Apply Font globally
  applyBtn.addEventListener('click', () => {
    const selectedFont = fontSelect.value;
    
    chrome.storage.local.set({ activeFont: selectedFont }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: "applyFont", 
          fontFamily: selectedFont 
        }, (response) => {
          if (chrome.runtime.lastError) {
            showStatus("Cannot apply to this page.", true);
            return;
          }
          if (response && response.success) {
            showStatus(`Success! Active font: ${selectedFont}`);
          }
        });
      });
    });
  });

  // Toggle Disable/Enable for specific domain
  toggleDisableBtn.addEventListener('click', () => {
    if (disabledDomains.includes(currentHostname)) {
      // Re-enable
      disabledDomains = disabledDomains.filter(domain => domain !== currentHostname);
      showStatus('Site enabled. Applying font...');
      
      chrome.storage.local.set({ disabledDomains }, () => {
        updateToggleUI();
        const fontToApply = fontSelect.value;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "applyFont", fontFamily: fontToApply });
        });
      });
    } else {
      // Disable
      disabledDomains.push(currentHostname);
      showStatus('Site disabled. Reverting to default...', true);
      
      chrome.storage.local.set({ disabledDomains }, () => {
        updateToggleUI();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: "removeFont" });
        });
      });
    }
  });
});
