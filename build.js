const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = __dirname;
const SOURCE_DIR = path.join(ROOT_DIR, "TypeShift");
const DIST_DIR = path.join(ROOT_DIR, "dist");

function buildPackage(target, manifestSrc, zipName) {
  const distDir = path.join(DIST_DIR, target);

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  // Copy all extension files except the manifests.
  const filesToInclude = fs
    .readdirSync(SOURCE_DIR)
    .filter(
      (file) => file !== "manifest.json" && file !== "manifest.firefox.json",
    );

  filesToInclude.forEach((file) => {
    const srcPath = path.join(SOURCE_DIR, file);
    fs.cpSync(srcPath, path.join(distDir, file), {
      recursive: true,
    });
  });

  // Use the correct browser manifest as manifest.json.
  fs.copyFileSync(
    path.join(SOURCE_DIR, manifestSrc),
    path.join(distDir, "manifest.json"),
  );

  const zipPath = path.join(ROOT_DIR, zipName);

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  if (process.platform === "win32") {
    execSync(`tar -a -c -f "${zipPath}" -C "${distDir}" *`);
  } else {
    execSync(`cd "${distDir}" && zip -r "${zipPath}" ./*`);
  }

  console.log(`Created ${zipName}`);
}

const baseManifest = JSON.parse(
  fs.readFileSync(path.join(SOURCE_DIR, "manifest.json"), "utf8"),
);

const version = baseManifest.version || "1.0.0";

buildPackage("chrome", "manifest.json", `typeshift-chrome-v${version}.zip`);

buildPackage(
  "firefox",
  "manifest.firefox.json",
  `typeshift-firefox-v${version}.zip`,
);

// Remove temporary build directory.
fs.rmSync(DIST_DIR, {
  recursive: true,
  force: true,
});
