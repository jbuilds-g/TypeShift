# 🌐 TypeShift

TypeShift is a lightweight, performance-focused browser extension designed to provide a consistent reading experience by overriding website-specific typography. ✨

## 🚀 Overview

Modern web design often prioritizes aesthetic branding over readability. **TypeShift** allows you to replace arbitrary website font-stacks with a curated selection of high-readability fonts. It is built for speed, minimal memory footprint, and seamless integration. ⚡

## 💎 Core Features

* **Global Font Override:** Choose from a set of predefined system and web-safe fonts to apply globally across all visited domains. 🌍
* **Performance-Optimized Injection:** Utilizes `document_start` script injection to ensure font overrides are applied before the page renders, eliminating the annoying "Flash of Unstyled Content" (FOUC). 🏎️
* **Icon Integrity Protection:** Features robust CSS logic to identify and protect icon fonts (e.g., Material Icons, FontAwesome, SVG-based icons), ensuring your UI stays functional. 🛡️
* **Per-Site Exclusions:** Easily toggle the extension off for specific websites where native typography is essential. 🚫
* **Local State Management:** Settings, font preferences, and your blacklist are stored locally via `chrome.storage.local`, keeping your privacy intact. 🔒

## 🛠️ Technical Implementation

* **Manifest V3:** Adheres to the latest Chrome extension architecture for better security and performance. 🛡️
* **Dynamic Styling:** Leverages content scripts that listen for storage updates, allowing changes to propagate without page reloads. 🔄
* **CSS Injection:** Uses carefully scoped CSS rules to target text-heavy elements while avoiding interference with icon-related classes and roles. 🎯

## 📋 Usage Instructions

1. **Installation:**
   * Download the source directory.
   * Open `chrome://extensions/` in your browser. 🖥️
   * Enable **Developer mode**. 👨‍💻
   * Click **Load unpacked** and select the project directory.
2. **Configuration:**
   * Click the **TypeShift** icon in your toolbar to open the control panel. 🖱️
   * Select your preferred font from the dropdown. 🔤
   * Toggle **Disable on this website** to add the current domain to your exclusion list.
3. **Updates:**
   * Any changes made in the popup will propagate across all tabs automatically. 💨
