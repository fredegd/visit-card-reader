/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const candidates = [
  {
    name: "@techstark/opencv-js",
    dir: path.join("node_modules", "@techstark", "opencv-js", "dist"),
  },
  {
    name: "opencv.js",
    dir: path.join("node_modules", "opencv.js", "build"),
  },
  {
    name: "opencv.js",
    dir: path.join("node_modules", "opencv.js", "dist"),
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

function main() {
  const candidate = candidates.find((item) => exists(item.dir));
  if (!candidate) {
    console.warn(
      "[copy-opencv] No known OpenCV dist directory found in node_modules.",
    );
    return;
  }

  const files = fs.readdirSync(candidate.dir);
  const jsFile =
    files.find((file) => file === "opencv.js") ??
    files.find((file) => file.startsWith("opencv") && file.endsWith(".js"));

  if (!jsFile) {
    console.warn(
      `[copy-opencv] No opencv.js file found in ${candidate.dir}.`,
    );
    return;
  }

  const outputDir = path.join("public", "opencv");
  const sourceJs = path.join(candidate.dir, jsFile);
  const targetJs = path.join(outputDir, "opencv.js");
  copyFile(sourceJs, targetJs);

  const extraFiles = files.filter(
    (file) => file.endsWith(".wasm") || file.endsWith(".data"),
  );
  if (extraFiles.length === 0) {
    console.warn(
      `[copy-opencv] No .wasm/.data files found in ${candidate.dir}.`,
    );
  }

  for (const file of extraFiles) {
    copyFile(path.join(candidate.dir, file), path.join(outputDir, file));
  }

  console.info(
    `[copy-opencv] Copied OpenCV assets from ${candidate.name} to ${outputDir}.`,
  );
}

main();
