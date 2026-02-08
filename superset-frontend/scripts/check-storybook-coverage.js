#!/usr/bin/env node
/*
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

// This script checks that UI components and plugins have corresponding
// Storybook story files. Run with --fix to see suggestions.

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ROOT = path.resolve(__dirname, '..');

// Directories to check for storybook coverage
const PLUGIN_PATTERNS = [
  'plugins/plugin-chart-*/src',
  'plugins/legacy-plugin-chart-*/src',
  'plugins/legacy-preset-chart-*/src',
];

const CORE_COMPONENT_PATTERNS = ['packages/superset-ui-core/src/components/*'];

// Directories/patterns to exclude from checks
const EXCLUSIONS = [
  '**/node_modules/**',
  '**/lib/**',
  '**/dist/**',
  '**/test/**',
  '**/tests/**',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/fixtures/**',
  '**/types/**',
  '**/utils/**',
  '**/hooks/**',
  '**/constants/**',
];

// Check if a directory has a stories file
function hasStoriesFile(dir) {
  const storiesPatterns = [
    path.join(dir, '*.stories.tsx'),
    path.join(dir, '*.stories.jsx'),
    path.join(dir, 'stories', '*.stories.tsx'),
    path.join(dir, 'stories', '*.stories.jsx'),
    path.join(dir, '**', '*.stories.tsx'),
    path.join(dir, '**', '*.stories.jsx'),
  ];

  for (const pattern of storiesPatterns) {
    const matches = glob.sync(pattern, { cwd: ROOT });
    if (matches.length > 0) {
      return true;
    }
  }
  return false;
}

// Check if a directory contains React components (TSX files)
function hasReactComponents(dir) {
  const tsxFiles = glob.sync(path.join(dir, '**', '*.tsx'), {
    cwd: ROOT,
    ignore: [
      '**/*.test.tsx',
      '**/*.stories.tsx',
      '**/types.tsx',
      '**/index.tsx',
    ],
  });
  return tsxFiles.length > 0;
}

// Get plugin name from path
function getPluginName(pluginPath) {
  const match = pluginPath.match(/plugins\/([^/]+)/);
  return match ? match[1] : pluginPath;
}

// Get component name from path
function getComponentName(componentPath) {
  return path.basename(componentPath);
}

function main() {
  const args = process.argv.slice(2);
  const showFix = args.includes('--fix') || args.includes('-f');
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log('Checking Storybook coverage for UI components and plugins...\n');

  const missing = [];
  const covered = [];

  // Check plugins
  console.log('Checking plugins...');
  for (const pattern of PLUGIN_PATTERNS) {
    const pluginDirs = glob.sync(pattern, {
      cwd: ROOT,
      ignore: EXCLUSIONS,
    });

    for (const pluginDir of pluginDirs) {
      const fullPath = path.join(ROOT, pluginDir);
      if (!fs.existsSync(fullPath)) continue;

      const pluginName = getPluginName(pluginDir);

      // Skip if excluded
      const isExcluded = EXCLUSIONS.some(function (exc) {
        return pluginDir.includes(exc.replace(/\*/g, ''));
      });
      if (isExcluded) {
        if (verbose) console.log(`  SKIP ${pluginName} (excluded)`);
        continue;
      }

      if (hasStoriesFile(fullPath)) {
        covered.push({ type: 'plugin', name: pluginName, path: pluginDir });
        if (verbose) console.log(`  OK   ${pluginName}`);
      } else if (hasReactComponents(fullPath)) {
        missing.push({ type: 'plugin', name: pluginName, path: pluginDir });
        console.log(`  MISS ${pluginName}`);
      }
    }
  }

  // Check core components
  console.log('\nChecking core components...');
  for (const pattern of CORE_COMPONENT_PATTERNS) {
    const componentDirs = glob.sync(pattern, {
      cwd: ROOT,
      ignore: EXCLUSIONS,
    });

    for (const componentDir of componentDirs) {
      const fullPath = path.join(ROOT, componentDir);
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory())
        continue;

      const componentName = getComponentName(componentDir);

      if (hasStoriesFile(fullPath)) {
        covered.push({
          type: 'component',
          name: componentName,
          path: componentDir,
        });
        if (verbose) console.log(`  OK   ${componentName}`);
      } else if (hasReactComponents(fullPath)) {
        missing.push({
          type: 'component',
          name: componentName,
          path: componentDir,
        });
        console.log(`  MISS ${componentName}`);
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`With stories: ${covered.length}`);
  console.log(`Missing stories: ${missing.length}`);

  if (missing.length > 0) {
    console.log('\nComponents/plugins missing Storybook stories:');
    for (const item of missing) {
      console.log(`   - ${item.name} (${item.path})`);
    }

    if (showFix) {
      console.log('\nTo add stories, create a file like:');
      let shown = 0;
      for (const item of missing) {
        if (shown >= 3) break;
        let storiesPath;
        if (item.type === 'plugin') {
          const shortName = item.name
            .replace('plugin-chart-', '')
            .replace('legacy-', '');
          storiesPath = `${item.path}/stories/${shortName}.stories.tsx`;
        } else {
          storiesPath = `${item.path}/${item.name}.stories.tsx`;
        }
        console.log(`   ${storiesPath}`);
        shown += 1;
      }
      if (missing.length > 3) {
        console.log(`   ... and ${missing.length - 3} more`);
      }
    }

    // Exit with error if missing stories (for CI)
    if (!showFix) {
      console.log('\nRun with --fix to see suggestions for adding stories.');
      process.exit(1);
    }
  } else {
    console.log('\nAll UI components and plugins have Storybook stories!');
  }
}

main();
