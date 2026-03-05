document.addEventListener('DOMContentLoaded', () => {
  const fontSelect = document.getElementById('font-select');
  const applyBtn = document.getElementById('apply-btn');
  const warningBox = document.getElementById('icon-warning');
  const statusMessage = document.getElementById('status-message');

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

  // Load previous state on open
  chrome.storage.local.get(['activeFont'], (result) => {
    if (result.activeFont) {
      fontSelect.value = result.activeFont;
      showStatus(`Current active font: ${result.activeFont}`);
    }
  });

  // Check the active tab for fragile icons
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { action: "checkIcons" }, (response) => {
      if (chrome.runtime.lastError) return; // Content script might not be injected
      if (response && response.hasIcons) {
        warningBox.style.display = 'block';
      }
    });
  });

  // Apply Font
  applyBtn.addEventListener('click', () => {
    const selectedFont = fontSelect.value;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: "applyFont", 
        fontFamily: selectedFont 
      }, (response) => {
        // Handle pages where the content script cannot run (e.g. chrome:// extensions)
        if (chrome.runtime.lastError) {
          showStatus("Cannot apply to this page. Try a normal webpage.", true);
          return;
        }

        if (response && response.success) {
          chrome.storage.local.set({ activeFont: selectedFont });
          showStatus(`Success! Active font: ${selectedFont}`);
        }
      });
    });
  });
});