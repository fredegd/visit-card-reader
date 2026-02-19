/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const sources = [
  {
    name: "tesseract.js",
    dir: path.join("node_modules", "tesseract.js", "dist"),
    filter: (file) => file.endsWith(".js") || file.endsWith(".map"),
  },
  {
    name: "tesseract.js-core",
    dir: path.join("node_modules", "tesseract.js-core"),
    filter: (file) =>
      file.startsWith("tesseract-core") &&
      (file.endsWith(".js") || file.endsWith(".wasm")),
  },
];

function exists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function listFiles(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function main() {
  const outputDir = path.join("public", "tesseract");
  let copied = 0;

  sources.forEach((source) => {
    if (!exists(source.dir)) {
      console.warn(`[copy-tesseract] Missing ${source.name} at ${source.dir}.`);
      return;
    }
    const files = listFiles(source.dir);
    if (files.length === 0) {
      console.warn(`[copy-tesseract] No files found in ${source.dir}.`);
      return;
    }
    const copyList = files.filter(source.filter);
    if (copyList.length === 0) {
      console.warn(
        `[copy-tesseract] No matching files found in ${source.dir}.`,
      );
      return;
    }
    copyList.forEach((file) => {
      copyFile(path.join(source.dir, file), path.join(outputDir, file));
      copied += 1;
    });
    console.info(
      `[copy-tesseract] Copied ${copyList.length} files from ${source.name} to ${outputDir}.`,
    );
  });

  if (copied === 0) {
    console.warn("[copy-tesseract] No files copied.");
  }
}

main();
