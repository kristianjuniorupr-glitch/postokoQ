import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.resolve(__dirname, '../src/hardware_store_bg.png');
const outputDir = path.resolve(__dirname, '../src');

const sizes = [
  { name: 'small', width: 640 },
  { name: 'medium', width: 1200 },
  { name: 'large', width: 1920 }
];

async function compressImage() {
  try {
    console.log(`Starting image compression for: ${inputPath}`);
    
    for (const size of sizes) {
      const baseName = `hardware_store_bg-${size.name}`;
      
      // AVIF
      console.log(`Generating AVIF: ${baseName}.avif at width ${size.width}`);
      await sharp(inputPath)
        .resize(size.width)
        .avif({ quality: 65, effort: 4 })
        .toFile(path.join(outputDir, `${baseName}.avif`));
        
      // WebP
      console.log(`Generating WebP: ${baseName}.webp at width ${size.width}`);
      await sharp(inputPath)
        .resize(size.width)
        .webp({ quality: 75 })
        .toFile(path.join(outputDir, `${baseName}.webp`));

      // PNG (Optimized fallback)
      console.log(`Generating Optimized PNG: ${baseName}.png at width ${size.width}`);
      await sharp(inputPath)
        .resize(size.width)
        .png({ palette: true, quality: 80 })
        .toFile(path.join(outputDir, `${baseName}.png`));
    }
    
    console.log('Image compression completed successfully!');
  } catch (error) {
    console.error('Error during image compression:', error);
    process.exit(1);
  }
}

compressImage();
