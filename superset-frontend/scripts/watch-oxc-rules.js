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
const { buildCustomOXC } = require('./ensure-custom-oxc');

const WATCH_PATHS = [
  path.join(__dirname, '../oxc-superset-rules'),
  path.join(__dirname, '../oxc-superset-rules-example.rs'),
  path.join(__dirname, '../build-custom-oxc.sh'),
];

let isBuilding = false;
let pendingRebuild = false;

/**
 * Rebuild with debouncing to avoid multiple builds
 */
async function rebuild() {
  if (isBuilding) {
    pendingRebuild = true;
    return;
  }

  isBuilding = true;
  console.log('\n🔄 Detected changes in OXC rules...');

  try {
    await buildCustomOXC();
    console.log('✅ Rebuild complete! Your custom lint rules are ready.\n');
  } catch (error) {
    console.error('❌ Rebuild failed:', error.message);
  }

  isBuilding = false;

  // Handle any pending rebuilds
  if (pendingRebuild) {
    pendingRebuild = false;
    setTimeout(rebuild, 1000);
  }
}

/**
 * Watch for file changes
 */
function startWatching() {
  console.log('👀 Watching for changes to OXC custom rules...');
  console.log('Press Ctrl+C to stop\n');

  const watchers = [];

  WATCH_PATHS.forEach(watchPath => {
    if (fs.existsSync(watchPath)) {
      const watcher = fs.watch(
        watchPath,
        { recursive: true },
        (eventType, filename) => {
          // Only rebuild for Rust files or the build script
          if (!filename) return;
          if (
            filename.endsWith('.rs') ||
            filename.endsWith('.toml') ||
            filename.endsWith('.sh')
          ) {
            console.log(`📝 Changed: ${filename}`);
            rebuild();
          }
        },
      );

      watchers.push(watcher);
      console.log(`  Watching: ${path.basename(watchPath)}`);
    }
  });

  if (watchers.length === 0) {
    console.log('⚠️  No rule files found to watch');
    console.log(
      'Create oxc-superset-rules/ directory with .rs files to get started',
    );
    process.exit(1);
  }

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping watcher...');
    watchers.forEach(w => w.close());
    process.exit(0);
  });
}

// Start watching
startWatching();
