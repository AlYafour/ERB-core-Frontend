/**
 * Script to generate favicon files from logo
 * 
 * This script requires ImageMagick or a similar tool.
 * 
 * For Windows with ImageMagick installed:
 * node generate-favicons.js
 * 
 * Or use online tool: https://realfavicongenerator.net/
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, 'logo-light.png');
const outputDir = __dirname;

// Check if logo exists
if (!fs.existsSync(logoPath)) {
  console.error('Error: logo-light.png not found in public directory');
  console.log('Please ensure logo-light.png exists before running this script');
  process.exit(1);
}

console.log('Generating favicon files from logo-light.png...');
console.log('Note: This requires ImageMagick to be installed');

try {
  // Generate favicon sizes
  const sizes = [
    { size: 16, name: 'favicon-16x16.png' },
    { size: 32, name: 'favicon-32x32.png' },
    { size: 48, name: 'favicon-48x48.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 192, name: 'android-chrome-192x192.png' },
    { size: 512, name: 'android-chrome-512x512.png' },
  ];

  sizes.forEach(({ size, name }) => {
    const outputPath = path.join(outputDir, name);
    try {
      execSync(`magick "${logoPath}" -resize ${size}x${size} "${outputPath}"`, {
        stdio: 'inherit'
      });
      console.log(`✓ Generated ${name}`);
    } catch (error) {
      console.error(`✗ Failed to generate ${name}:`, error.message);
    }
  });

  // Generate favicon.ico (multi-size)
  try {
    execSync(`magick "${logoPath}" -define icon:auto-resize=16,32,48 "${path.join(outputDir, 'favicon.ico')}"`, {
      stdio: 'inherit'
    });
    console.log('✓ Generated favicon.ico');
  } catch (error) {
    console.error('✗ Failed to generate favicon.ico:', error.message);
  }

  console.log('\n✓ Favicon generation complete!');
  console.log('\nGenerated files:');
  console.log('  - favicon.ico');
  console.log('  - favicon-16x16.png');
  console.log('  - favicon-32x32.png');
  console.log('  - apple-touch-icon.png');
  console.log('  - android-chrome-192x192.png');
  console.log('  - android-chrome-512x512.png');
  
} catch (error) {
  console.error('Error:', error.message);
  console.log('\nAlternative: Use https://realfavicongenerator.net/');
  console.log('Upload logo-light.png and download all generated files');
}

