#!/usr/bin/env node

/**
 * Image Optimization Script for Barkle V4
 * 
 * This script converts PNG/JPEG images to modern WebP and AVIF formats
 * for better performance and reduced bandwidth usage.
 * 
 * Usage: node scripts/optimize-images.js [input-directory] [output-directory]
 * 
 * If no directories specified, it will optimize files in packages/backend/assets/
 */

import { readdir, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

const INPUT_DIR = process.argv[2] || 'packages/backend/assets';
const OUTPUT_DIR = process.argv[3] || INPUT_DIR;

const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg'];

async function convertImage(inputPath, outputDir) {
    const filename = basename(inputPath, extname(inputPath));
    console.log(`Processing: ${inputPath}`);
    
    try {
        const image = sharp(inputPath);
        const metadata = await image.metadata();
        
        // Generate WebP version
        const webpPath = join(outputDir, `${filename}.webp`);
        await image
            .webp({ 
                quality: 85,
                effort: 6 // Higher effort for better compression
            })
            .toFile(webpPath);
        console.log(`  ✓ Created WebP: ${webpPath}`);
        
        // Generate AVIF version (best compression)
        const avifPath = join(outputDir, `${filename}.avif`);
        await image
            .avif({ 
                quality: 75,
                effort: 9 // Maximum effort for best compression
            })
            .toFile(avifPath);
        console.log(`  ✓ Created AVIF: ${avifPath}`);
        
        // Also optimize the original if it's PNG/JPEG
        const ext = extname(inputPath).toLowerCase();
        if (ext === '.png') {
            const optimizedPath = join(outputDir, `${filename}.png`);
            await image
                .png({ 
                    compressionLevel: 9,
                    quality: 95 
                })
                .toFile(optimizedPath);
            console.log(`  ✓ Optimized PNG: ${optimizedPath}`);
        } else if (['.jpg', '.jpeg'].includes(ext)) {
            const optimizedPath = join(outputDir, `${filename}.jpg`);
            await image
                .jpeg({ 
                    quality: 90,
                    progressive: true 
                })
                .toFile(optimizedPath);
            console.log(`  ✓ Optimized JPEG: ${optimizedPath}`);
        }
        
    } catch (error) {
        console.error(`  ✗ Error processing ${inputPath}:`, error.message);
    }
}

async function processDirectory(inputDir, outputDir) {
    try {
        const entries = await readdir(inputDir);
        
        for (const entry of entries) {
            const fullPath = join(inputDir, entry);
            const stats = await stat(fullPath);
            
            if (stats.isDirectory()) {
                // Recursively process subdirectories
                await processDirectory(fullPath, join(outputDir, entry));
            } else if (SUPPORTED_FORMATS.includes(extname(entry).toLowerCase())) {
                await convertImage(fullPath, outputDir);
            }
        }
    } catch (error) {
        console.error(`Error processing directory ${inputDir}:`, error.message);
    }
}

async function main() {
    console.log('🖼️  Barkle Image Optimization Tool');
    console.log(`📁 Input directory: ${INPUT_DIR}`);
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log('');
    
    await processDirectory(INPUT_DIR, OUTPUT_DIR);
    
    console.log('');
    console.log('✅ Image optimization complete!');
    console.log('');
    console.log('💡 Tips:');
    console.log('   - Use WebP for modern browsers (85-90% browser support)');
    console.log('   - Use AVIF for newest browsers (best compression, ~70% support)');
    console.log('   - Keep PNG/JPEG as fallbacks for older browsers');
    console.log('   - Use <picture> elements with multiple sources for best results');
}

main().catch(console.error);