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
const { execSync } = require('child_process');

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
    execSync('which cargo', { stdio: 'ignore' });
  } catch (e) {
    console.error('❌ Rust not installed!');
    console.error('');
    console.error('To use custom Superset lint rules, please install Rust:');
    console.error(
      '  curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh',
    );
    console.error('');
    console.error('Or use standard OXC without custom rules by running:');
    console.error('  npm install -g oxlint');
    console.error('');
    console.error('Falling back to standard OXC for now...');
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
    // Run the build script
    execSync(BUILD_SCRIPT, {
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
 * Main function
 */
function main() {
  // Skip in CI if we're using pre-built binary
  if (process.env.CI && process.env.SKIP_OXC_BUILD === 'true') {
    console.log('ℹ️  Skipping OXC build in CI (using pre-built binary)');
    return;
  }

  // Check if rebuild is needed
  if (needsRebuild()) {
    const startTime = Date.now();
    const success = buildCustomOXC();

    if (success) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⏱️  Build completed in ${elapsed}s`);
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
