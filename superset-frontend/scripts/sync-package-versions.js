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

/**
 * Sync all publishable package versions to a specific version.
 * Used during Superset releases to align npm package versions.
 *
 * Usage:
 *   node scripts/sync-package-versions.js <version>
 *   node scripts/sync-package-versions.js 6.1.0
 *   node scripts/sync-package-versions.js 6.1.0-rc.1
 *   node scripts/sync-package-versions.js 6.1.0 --dry-run
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const version = args.find(arg => !arg.startsWith('--'));

if (!version) {
  console.error(
    'Usage: node scripts/sync-package-versions.js <version> [--dry-run]',
  );
  console.error('Example: node scripts/sync-package-versions.js 6.1.0');
  console.error(
    'Example: node scripts/sync-package-versions.js 6.1.0-rc.1 --dry-run',
  );
  process.exit(1);
}

// Validate version format (semver with optional prerelease)
const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
if (!semverRegex.test(version)) {
  console.error(`Invalid version format: ${version}`);
  console.error(
    'Expected format: MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-prerelease',
  );
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');

// Find all publishable packages (those with "private": false or no "private" field)
// Exclude demo and generator packages per changeset config
const excludePackages = new Set([
  '@superset-ui/demo',
  '@superset-ui/generator-superset',
]);

function findPackages() {
  const packages = [];

  // Check packages directory
  const packagesDir = path.join(rootDir, 'packages');
  if (fs.existsSync(packagesDir)) {
    for (const dir of fs.readdirSync(packagesDir)) {
      const pkgPath = path.join(packagesDir, dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        packages.push(pkgPath);
      }
    }
  }

  // Check plugins directory
  const pluginsDir = path.join(rootDir, 'plugins');
  if (fs.existsSync(pluginsDir)) {
    for (const dir of fs.readdirSync(pluginsDir)) {
      const pkgPath = path.join(pluginsDir, dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        packages.push(pkgPath);
      }
    }
  }

  return packages;
}

function updatePackage(pkgPath, newVersion) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Skip private packages
  if (pkg.private === true) {
    return { skipped: true, reason: 'private', name: pkg.name };
  }

  // Skip excluded packages
  if (excludePackages.has(pkg.name)) {
    return { skipped: true, reason: 'excluded', name: pkg.name };
  }

  const oldVersion = pkg.version;
  pkg.version = newVersion;

  if (!dryRun) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  return {
    skipped: false,
    name: pkg.name,
    oldVersion,
    newVersion,
    path: pkgPath,
  };
}

console.log(
  `\n${dryRun ? '[DRY RUN] ' : ''}Syncing package versions to ${version}\n`,
);

const packages = findPackages();
const results = packages.map(pkgPath => updatePackage(pkgPath, version));

// Print results
console.log('Updated packages:');
results
  .filter(r => !r.skipped)
  .forEach(r => {
    console.log(`  ${r.name}: ${r.oldVersion} -> ${r.newVersion}`);
  });

console.log('\nSkipped packages:');
results
  .filter(r => r.skipped)
  .forEach(r => {
    console.log(`  ${r.name} (${r.reason})`);
  });

const updatedCount = results.filter(r => !r.skipped).length;
console.log(
  `\n${dryRun ? 'Would update' : 'Updated'} ${updatedCount} packages.`,
);

if (dryRun) {
  console.log('\nRun without --dry-run to apply changes.');
} else {
  console.log('\nNext steps:');
  console.log('  1. Review changes: git diff');
  console.log(
    '  2. Commit: git add . && git commit -m "chore(packages): bump versions to ' +
      version +
      '"',
  );
  console.log('  3. Dry run publish: bun run publish:packages:dry');
  console.log('  4. Publish: bun run publish:packages');
}
