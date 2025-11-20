#!/usr/bin/env node

/**
 * Script to generate PWA icons from SVG
 * Requires: sharp (npm install sharp --save-dev)
 * Usage: node scripts/generate-icons.js
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');

const iconSvg = readFileSync(join(publicDir, 'icon-base.svg'));

const sizes = [
  { size: 192, name: 'pwa-192x192.png' },
  { size: 512, name: 'pwa-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 16, name: 'favicon-16x16.png' },
];

async function generateIcons() {
  console.log('Generating PWA icons...');

  for (const { size, name } of sizes) {
    try {
      await sharp(iconSvg)
        .resize(size, size)
        .png()
        .toFile(join(publicDir, name));
      console.log(`✓ Generated ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`✗ Failed to generate ${name}:`, error.message);
    }
  }

  // Generate favicon.ico (using 32x32 as base)
  try {
    const favicon32 = await sharp(iconSvg)
      .resize(32, 32)
      .png()
      .toBuffer();

    await sharp(favicon32)
      .resize(16, 16)
      .toFile(join(publicDir, 'favicon.ico'));
    console.log('✓ Generated favicon.ico');
  } catch (error) {
    console.error('✗ Failed to generate favicon.ico:', error.message);
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);

