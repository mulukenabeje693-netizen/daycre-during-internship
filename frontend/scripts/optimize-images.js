import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// Resolve current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure source and output directories
const SOURCE_DIR = path.resolve(__dirname, '../public/assets/images');
const OUTPUT_DIR = path.resolve(__dirname, '../public/assets/optimized');
const QUALITY = 80; // 80% quality WebP

// Helper to format bytes to KB / MB
function formatSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
  return (bytes / 1024).toFixed(1) + ' KB';
}

async function optimizeImages() {
  console.log(`\n======================================================`);
  console.log(`🚀 Starting PNG to WebP Conversion (Quality: ${QUALITY}%)`);
  console.log(`📁 Source: ${SOURCE_DIR}`);
  console.log(`📁 Target: ${OUTPUT_DIR}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ Source folder not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all .png files
  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.toLowerCase().endsWith('.png'));

  if (files.length === 0) {
    console.log('ℹ️ No PNG images found in source folder.');
    return;
  }

  let totalOriginalBytes = 0;
  let totalOptimizedBytes = 0;
  let count = 0;

  for (const file of files) {
    const srcPath = path.join(SOURCE_DIR, file);
    const baseName = path.parse(file).name;
    const destPath = path.join(OUTPUT_DIR, `${baseName}.webp`);

    try {
      const originalStat = fs.statSync(srcPath);
      const originalSize = originalStat.size;

      // Convert to WebP using Sharp
      await sharp(srcPath)
        .webp({ quality: QUALITY, effort: 4 })
        .toFile(destPath);

      const optimizedStat = fs.statSync(destPath);
      const optimizedSize = optimizedStat.size;

      totalOriginalBytes += originalSize;
      totalOptimizedBytes += optimizedSize;
      count++;

      const reduction = (((originalSize - optimizedSize) / originalSize) * 100).toFixed(1);

      console.log(
        `✓ ${file.padEnd(26)} ` +
        `[${formatSize(originalSize).padStart(8)}] → ` +
        `[${formatSize(optimizedSize).padStart(8)}] ` +
        `📉 ${reduction}% smaller`
      );
    } catch (err) {
      console.error(`❌ Failed to convert ${file}:`, err.message);
    }
  }

  const totalReduction = (
    ((totalOriginalBytes - totalOptimizedBytes) / totalOriginalBytes) *
    100
  ).toFixed(1);

  console.log(`\n======================================================`);
  console.log(`🎉 Optimization Complete!`);
  console.log(`📊 Converted: ${count} images`);
  console.log(`📦 Original Total:  ${formatSize(totalOriginalBytes)}`);
  console.log(`📦 Optimized Total: ${formatSize(totalOptimizedBytes)}`);
  console.log(`⚡ Total Bandwidth Saved: ${totalReduction}%`);
  console.log(`======================================================\n`);
}

optimizeImages();
