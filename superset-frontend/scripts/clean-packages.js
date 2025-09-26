#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning build directories...');

// Directories to clean
const packagesDir = path.join(__dirname, '../packages');
const pluginsDir = path.join(__dirname, '../plugins');

function cleanDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  fs.readdirSync(dir).forEach(name => {
    const packagePath = path.join(dir, name);

    if (!fs.statSync(packagePath).isDirectory()) return;

    // Clean lib, esm, and types directories
    ['lib', 'esm', 'types'].forEach(buildDir => {
      const buildPath = path.join(packagePath, buildDir);
      if (fs.existsSync(buildPath)) {
        fs.rmSync(buildPath, { recursive: true, force: true });
        console.log(`  Removed ${name}/${buildDir}`);
      }
    });

    // Clean tsconfig.tsbuildinfo files
    const tsBuildInfo = path.join(packagePath, 'tsconfig.tsbuildinfo');
    if (fs.existsSync(tsBuildInfo)) {
      fs.unlinkSync(tsBuildInfo);
      console.log(`  Removed ${name}/tsconfig.tsbuildinfo`);
    }
  });
}

cleanDirectory(packagesDir);
cleanDirectory(pluginsDir);

console.log('✨ Clean complete!');
