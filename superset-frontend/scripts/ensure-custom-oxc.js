/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const BINARY_PATH = path.join(
  __dirname,
  '../node_modules/.bin/oxlint-superset',
);
const RULES_DIR = path.join(__dirname, '../oxc-superset-rules');
const CHECKSUM_FILE = path.join(
  __dirname,
  '../node_modules/.bin/.oxc-rules-checksum',
);
const BUILD_SCRIPT = path.join(__dirname, '../build-custom-oxc.sh');

/**
 * Calculate checksum of all rule files to detect changes
 */
function calculateRulesChecksum() {
  const hash = crypto.createHash('sha256');

  // Hash the example rules file (or actual rules directory if it exists)
  const exampleFile = path.join(__dirname, '../oxc-superset-rules-example.rs');
  if (fs.existsSync(exampleFile)) {
    hash.update(fs.readFileSync(exampleFile));
  }

  // Hash actual rules directory if it exists
  if (fs.existsSync(RULES_DIR)) {
    const files = fs.readdirSync(RULES_DIR, { recursive: true });
    files.sort().forEach(file => {
      const filePath = path.join(RULES_DIR, file);
      if (fs.statSync(filePath).isFile() && file.endsWith('.rs')) {
        hash.update(fs.readFileSync(filePath));
      }
    });
  }

  // Also hash the build script itself
  if (fs.existsSync(BUILD_SCRIPT)) {
    hash.update(fs.readFileSync(BUILD_SCRIPT));
  }

  return hash.digest('hex');
}

/**
 * Check if custom OXC binary needs to be built
 */
function needsRebuild() {
  // Check if binary exists
  if (!fs.existsSync(BINARY_PATH)) {
    console.log('⚠️  Custom OXC binary not found');
    return true;
  }

  // Check if checksum file exists
  if (!fs.existsSync(CHECKSUM_FILE)) {
    console.log('⚠️  No checksum file found, will rebuild to be safe');
    return true;
  }

  // Compare checksums
  const currentChecksum = calculateRulesChecksum();
  const savedChecksum = fs.readFileSync(CHECKSUM_FILE, 'utf8').trim();

  if (currentChecksum !== savedChecksum) {
    console.log('🔄 Rule files have changed, rebuild needed');
    return true;
  }

  return false;
}

/**
 * Build the custom OXC binary
 */
function buildCustomOXC() {
  console.log('🔨 Building custom OXC with Superset rules...');
  console.log(
    'This will take a minute on first build, but will be cached afterward.',
  );

  // Check if Rust is installed
  try {
    execFileSync('which', ['cargo'], { stdio: 'ignore' });
  } catch (e) {
    console.log('ℹ️  Rust not installed, using standard oxlint');
    console.log('   To enable custom Superset lint rules, install Rust:');
    console.log(
      '   curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh',
    );
    return false;
  }

  // Make build script executable
  if (fs.existsSync(BUILD_SCRIPT)) {
    fs.chmodSync(BUILD_SCRIPT, '755');
  } else {
    console.error('❌ Build script not found at:', BUILD_SCRIPT);
    return false;
  }

  try {
    // Run the build script using execFileSync for security
    execFileSync('/bin/bash', [BUILD_SCRIPT], {
      stdio: 'inherit',
      cwd: path.dirname(BUILD_SCRIPT),
    });

    // Save the checksum
    const newChecksum = calculateRulesChecksum();
    fs.mkdirSync(path.dirname(CHECKSUM_FILE), { recursive: true });
    fs.writeFileSync(CHECKSUM_FILE, newChecksum);

    console.log('✅ Custom OXC built successfully!');
    return true;
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    console.error('Falling back to standard OXC...');
    return false;
  }
}

/**
 * Try to install standard oxlint if custom build is not available
 */
function installStandardOxlint() {
  console.log('📦 Installing standard oxlint...');
  try {
    execFileSync('npm', ['install', 'oxlint', '--no-save'], {
      stdio: 'inherit',
      cwd: path.dirname(BUILD_SCRIPT),
    });
    console.log('✅ Standard oxlint installed');
    return true;
  } catch (e) {
    console.error('❌ Failed to install standard oxlint:', e.message);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  // Skip in CI if we're using pre-built binary
  if (process.env.CI && process.env.SKIP_OXC_BUILD === 'true') {
    console.log('ℹ️  Skipping OXC build in CI (using pre-built binary)');
    return;
  }

  // Skip custom build if explicitly requested (e.g., for pre-commit speed)
  if (process.env.SKIP_CUSTOM_OXC === 'true') {
    console.log('ℹ️  Skipping custom OXC build (using standard oxlint)');
    return;
  }

  // Check if standard oxlint exists as fallback
  const standardOxlintPath = path.join(
    __dirname,
    '../node_modules/.bin/oxlint',
  );
  const hasStandardOxlint = fs.existsSync(standardOxlintPath);

  // Check if Rust is available for custom build
  let hasRust = false;
  try {
    execFileSync('which', ['cargo'], { stdio: 'ignore' });
    hasRust = true;
  } catch (e) {
    // Rust not available
  }

  if (!hasRust) {
    console.log(
      '⚠️  Rust not installed, using standard oxlint instead of custom build',
    );
    if (!hasStandardOxlint) {
      installStandardOxlint();
    } else {
      console.log('✅ Standard oxlint is available');
    }
    return;
  }

  // Check if rebuild is needed
  if (needsRebuild()) {
    const startTime = Date.now();
    const success = buildCustomOXC();

    if (success) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⏱️  Build completed in ${elapsed}s`);
    } else if (!hasStandardOxlint) {
      // If custom build failed and no standard oxlint, install it
      installStandardOxlint();
    }
  } else {
    // Binary is up to date
    const stats = fs.statSync(BINARY_PATH);
    const age = Math.floor((Date.now() - stats.mtime) / 1000 / 60);
    console.log(`✅ Custom OXC is up to date (built ${age} minutes ago)`);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { needsRebuild, buildCustomOXC };
