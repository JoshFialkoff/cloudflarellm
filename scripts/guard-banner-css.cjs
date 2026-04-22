#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "styles", "Home.module.css");

function fail(message) {
  process.stderr.write(`Banner guard failed: ${message}\n`);
  process.exit(1);
}

function extractBlocks(cssText, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockRegex = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "g");
  const blocks = [];
  let match;
  while ((match = blockRegex.exec(cssText)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function hasDeclaration(block, property, valueRegex) {
  const regex = new RegExp(
    `${property}\\s*:\\s*${valueRegex.source}\\s*;`,
    valueRegex.flags,
  );
  return regex.test(block);
}

function main() {
  if (!fs.existsSync(cssPath)) {
    fail(`File not found: ${cssPath}`);
  }

  const cssText = fs.readFileSync(cssPath, "utf8");

  const photoImgBlocks = extractBlocks(cssText, ".landingBannerPhotoImg");
  if (photoImgBlocks.length !== 1) {
    fail(
      `Expected exactly 1 .landingBannerPhotoImg block, found ${photoImgBlocks.length}.`,
    );
  }
  if (hasDeclaration(photoImgBlocks[0], "opacity", /0(?![\d.])/)) {
    fail(".landingBannerPhotoImg must never use opacity: 0.");
  }

  const copyBlocks = extractBlocks(cssText, ".landingBannerCopy");
  if (copyBlocks.length < 1) {
    fail("Missing .landingBannerCopy block.");
  }
  const hasBottomAlignedCopy = copyBlocks.some((block) =>
    hasDeclaration(block, "align-items", /flex-end/),
  );
  if (!hasBottomAlignedCopy) {
    fail(".landingBannerCopy must keep align-items: flex-end for bottom alignment.");
  }
  const hasCenteredCopy = copyBlocks.some((block) =>
    hasDeclaration(block, "justify-content", /center/),
  );
  if (!hasCenteredCopy) {
    fail(".landingBannerCopy must keep justify-content: center.");
  }

  const hasTextCardBackground = /\.landingBannerTextColumn\s*\{[\s\S]*?background\s*:\s*rgba\s*\(/m.test(
    cssText,
  );
  if (!hasTextCardBackground) {
    fail(".landingBannerTextColumn must keep a background card.");
  }
  const hasTextCardShadow = /\.landingBannerTextColumn\s*\{[\s\S]*?box-shadow\s*:/m.test(
    cssText,
  );
  if (!hasTextCardShadow) {
    fail(".landingBannerTextColumn must keep box-shadow for readability.");
  }

  const textBlocks = extractBlocks(cssText, ".landingBannerText");
  if (textBlocks.length !== 1) {
    fail(`Expected exactly 1 .landingBannerText block, found ${textBlocks.length}.`);
  }
  if (!hasDeclaration(textBlocks[0], "text-align", /center/)) {
    fail(".landingBannerText must keep text-align: center.");
  }

  const photoCellBlocks = extractBlocks(cssText, ".landingBannerPhotoCell");
  if (photoCellBlocks.length !== 1) {
    fail(
      `Expected exactly 1 .landingBannerPhotoCell block, found ${photoCellBlocks.length}.`,
    );
  }
  if (!hasDeclaration(photoCellBlocks[0], "position", /absolute/)) {
    fail(".landingBannerPhotoCell must keep position: absolute.");
  }
  if (!hasDeclaration(photoCellBlocks[0], "inset", /0/)) {
    fail(".landingBannerPhotoCell must keep inset: 0.");
  }

  process.stdout.write("Banner guard passed.\n");
}

main();
