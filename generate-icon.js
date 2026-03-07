// generate-icon.js — Convert EPA logo PNG to ICO for Windows installer
// Run: node generate-icon.js

const fs = require("fs");
const path = require("path");

const pngPath = path.join(__dirname, "public", "epa logo.png");
const icoPath = path.join(__dirname, "build", "icon.ico");
const png256Path = path.join(__dirname, "build", "icon.png");

// Copy PNG to build folder (needed by electron-builder)
if (fs.existsSync(pngPath)) {
  fs.copyFileSync(pngPath, png256Path);
  console.log("Copied PNG to build/icon.png");
}

// Create a basic ICO file from PNG
// ICO format: header + directory entries + image data
function createIcoFromPng(pngBuffer) {
  // ICO Header: 6 bytes
  // - Reserved (2 bytes): 0
  // - Type (2 bytes): 1 (ICO)
  // - Count (2 bytes): 1 (one image)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type = ICO
  header.writeUInt16LE(1, 4); // Image count = 1

  // ICO Directory Entry: 16 bytes
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // Width: 0 = 256
  entry.writeUInt8(0, 1); // Height: 0 = 256
  entry.writeUInt8(0, 2); // Color palette
  entry.writeUInt8(0, 3); // Reserved
  entry.writeUInt16LE(1, 4); // Color planes
  entry.writeUInt16LE(32, 6); // Bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // Image size
  entry.writeUInt32LE(22, 12); // Offset (6 + 16 = 22)

  return Buffer.concat([header, entry, pngBuffer]);
}

if (fs.existsSync(pngPath)) {
  const pngData = fs.readFileSync(pngPath);
  const icoData = createIcoFromPng(pngData);
  fs.writeFileSync(icoPath, icoData);
  console.log("Created build/icon.ico from EPA logo");
  console.log("Icon generation complete!");
} else {
  console.error("Error: EPA logo not found at", pngPath);
  console.log("Please place epa logo.png in the public/ folder");
}
