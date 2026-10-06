const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=";

const fontCache = new Map();

function getGoogleFontUrl(fontFamily) {
  const encoded = encodeURIComponent(fontFamily).replace(/%20/g, "+");
  return `${GOOGLE_FONTS_CSS}${encoded}&display=swap`;
}

function readDescriptor(block, name) {
  const match = block.match(new RegExp(`\\b${name}\\s*:\\s*([^;]+)`, "i"));
  return match?.[1]?.trim() || "";
}

function parseFontFaces(css) {
  return [...css.matchAll(/@font-face\s*\{([^}]+)\}/gi)]
    .map((match) => {
      const block = match[1];
      const source = block.match(
        /url\(\s*["']?(https:\/\/fonts\.gstatic\.com\/[^)"'\s]+)["']?\s*\)/i,
      );

      if (!source?.[1]) return null;

      return {
        style: readDescriptor(block, "font-style") || "normal",
        weight: readDescriptor(block, "font-weight") || "400",
        stretch: readDescriptor(block, "font-stretch") || "normal",
        unicodeRange: readDescriptor(block, "unicode-range"),
        src: source[1],
      };
    })
    .filter(Boolean);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)),
    );
  }

  return btoa(binary);
}

async function loadGoogleFont(fontFamily) {
  const cached = fontCache.get(fontFamily);
  if (cached) return cached;

  const cssResponse = await fetch(getGoogleFontUrl(fontFamily), {
    cache: "force-cache",
  });

  if (!cssResponse.ok) {
    throw new Error(`Google Fonts stylesheet request failed: ${cssResponse.status}`);
  }

  const css = await cssResponse.text();
  const faces = parseFontFaces(css);

  if (!faces.length) {
    throw new Error("Google Fonts returned no usable font faces");
  }

  const result = await Promise.all(
    faces.map(async (face) => {
      const response = await fetch(face.src, { cache: "force-cache" });

      if (!response.ok) {
        throw new Error(`Font file request failed: ${response.status}`);
      }

      return {
        style: face.style,
        weight: face.weight,
        stretch: face.stretch,
        unicodeRange: face.unicodeRange,
        data: arrayBufferToBase64(await response.arrayBuffer()),
      };
    }),
  );

  fontCache.set(fontFamily, result);
  return result;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "loadGoogleFont") return;

  loadGoogleFont(request.fontFamily)
    .then((faces) => sendResponse({ success: true, faces }))
    .catch((error) => {
      console.error("TypeShift: Google Font loading failed", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  return true;
});
