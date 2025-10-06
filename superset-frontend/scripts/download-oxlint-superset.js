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
const https = require('https');
const { execFileSync } = require('child_process');

const BINARY_PATH = path.join(
  __dirname,
  '../node_modules/.bin/oxlint-superset',
);

// GitHub Release URL for pre-built binaries
// You would host these on GitHub Releases or a CDN
const RELEASE_BASE = 'https://github.com/apache/superset/releases/download';
const VERSION = 'oxlint-superset-v1.0.0';

function getPlatformBinary() {
  const platform = process.platform;
  const arch = process.arch;
  
  const mapping = {
    'darwin-x64': 'oxlint-superset-darwin-x64',
    'darwin-arm64': 'oxlint-superset-darwin-arm64',
    'linux-x64': 'oxlint-superset-linux-x64',
    'linux-arm64': 'oxlint-superset-linux-arm64',
    'win32-x64': 'oxlint-superset-win-x64.exe',
  };
  
  const key = `${platform}-${arch}`;
  return mapping[key];
}

function downloadBinary(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading pre-built oxlint-superset from ${url}`);
    
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirects
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            fs.chmodSync(dest, '755');
            resolve();
          });
        });
      } else if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          fs.chmodSync(dest, '755');
          resolve();
        });
      } else {
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function main() {
  // Skip if binary already exists
  if (fs.existsSync(BINARY_PATH)) {
    console.log('✅ oxlint-superset binary already exists');
    return;
  }
  
  const binaryName = getPlatformBinary();
  if (!binaryName) {
    console.error('❌ Unsupported platform:', process.platform, process.arch);
    console.log('Falling back to standard oxlint');
    return;
  }
  
  const url = `${RELEASE_BASE}/${VERSION}/${binaryName}`;
  
  try {
    fs.mkdirSync(path.dirname(BINARY_PATH), { recursive: true });
    await downloadBinary(url, BINARY_PATH);
    console.log('✅ Successfully downloaded oxlint-superset binary');
  } catch (error) {
    console.error('⚠️  Failed to download pre-built binary:', error.message);
    console.log('Falling back to standard oxlint');
  }
}

if (require.main === module) {
  main();
}