#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const distEsmDir = path.join(__dirname, '..', 'dist-esm');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy ESM files from dist-esm to dist with .mjs extension
function copyEsmFiles(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) {
        console.log('No ESM output found, skipping ESM build');
        return;
    }

    const files = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const file of files) {
        const srcPath = path.join(srcDir, file.name);
        const destPath = path.join(destDir, file.name);

        if (file.isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
            copyEsmFiles(srcPath, destPath);
        } else if (file.name.endsWith('.js')) {
            // Copy .js files as .mjs for ESM
            const mjsPath = destPath.replace(/\.js$/, '.mjs');
            let content = fs.readFileSync(srcPath, 'utf8');
            
            // Update imports to use .mjs extension
            content = content.replace(/from\s+['"](\..+?)(?:\.js)?['"]/g, 'from "$1.mjs"');
            content = content.replace(/require\(['"](\..+?)(?:\.js)?['"]\)/g, 'require("$1.mjs")');
            
            fs.writeFileSync(mjsPath, content);
        } else if (file.name.endsWith('.d.ts')) {
            // Copy type definitions as-is
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('Building ESM modules...');
copyEsmFiles(distEsmDir, distDir);

// Clean up dist-esm directory
if (fs.existsSync(distEsmDir)) {
    fs.rmSync(distEsmDir, { recursive: true, force: true });
}

console.log('ESM build complete!');
