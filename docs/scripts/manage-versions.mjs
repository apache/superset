#!/usr/bin/env node

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

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, '..', 'versions-config.json');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0]; // 'add' or 'remove'
const section = args[1]; // 'docs', 'developer_docs', or 'components'
const version = args[2]; // version string like '1.2.0'

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

function freezeDataImports(section, version) {
  // MDX files can `import` JSON/YAML data from outside the section (e.g.
  // country-map-tools.mdx imports `../../data/countries.json`). Without
  // intervention, the snapshot keeps reading the live file, so the
  // historical version's content silently changes whenever the data file
  // is updated. Copy each escaping data import into a snapshot-local
  // `_versioned_data/` dir and rewrite the import to point there.
  const sectionRoot = section === 'docs'
    ? path.join(__dirname, '..', 'docs')
    : path.join(__dirname, '..', section);
  const docsRoot = path.join(__dirname, '..');
  const versionedDocsDir = section === 'docs'
    ? `versioned_docs/version-${version}`
    : `${section}_versioned_docs/version-${version}`;
  const versionedDocsPath = path.join(__dirname, '..', versionedDocsDir);
  const frozenDataDir = path.join(versionedDocsPath, '_versioned_data');

  if (!fs.existsSync(versionedDocsPath)) {
    return;
  }

  console.log(`  Freezing data imports in ${versionedDocsDir}...`);

  // Matches `from '../../foo/bar.json'` and similar — only escaping paths
  // (one or more `../`) targeting JSON/YAML files.
  const dataImportRe = /(from\s+['"])((?:\.\.\/)+)([^'"\s]+\.(?:json|ya?ml))(['"])/g;

  function walk(dir, depth) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('_')) continue;
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
        const original = fs.readFileSync(fullPath, 'utf8');
        let inFence = false;
        let mutated = false;
        const updated = original.split('\n').map(line => {
          if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            return line;
          }
          if (inFence) return line;
          return line.replace(dataImportRe, (match, prefix, dots, importPath, suffix) => {
            const upCount = dots.match(/\.\.\//g).length;
            // Imports that stay inside the section are copied wholesale by
            // Docusaurus, so they don't need freezing.
            if (upCount <= depth) return match;
            // Resolve the import against the file's *original* location to
            // find the source file in the live tree.
            const relativeFromVersioned = path.relative(versionedDocsPath, fullPath);
            const originalDir = path.dirname(path.join(sectionRoot, relativeFromVersioned));
            const resolvedSource = path.resolve(originalDir, dots + importPath);
            const relFromDocsRoot = path.relative(docsRoot, resolvedSource);
            if (relFromDocsRoot.startsWith('..') || !fs.existsSync(resolvedSource)) {
              return match;
            }
            const destPath = path.join(frozenDataDir, relFromDocsRoot);
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(resolvedSource, destPath);
            const rewritten = path
              .relative(path.dirname(fullPath), destPath)
              .split(path.sep)
              .join('/');
            const finalImport = rewritten.startsWith('.') ? rewritten : `./${rewritten}`;
            mutated = true;
            return `${prefix}${finalImport}${suffix}`;
          });
        }).join('\n');
        if (mutated) {
          fs.writeFileSync(fullPath, updated);
          const rel = path.relative(versionedDocsPath, fullPath);
          console.log(`    Froze data imports in ${rel}`);
        }
      }
    }
  }

  walk(versionedDocsPath, 0);
}

function fixVersionedImports(section, version) {
  // Versioned content lands one directory deeper than the source content,
  // so any `../../src/` or `../../data/` imports in .md/.mdx files need
  // an extra `../` to keep reaching docs/src and docs/data.
  const versionedDocsDir = section === 'docs'
    ? `versioned_docs/version-${version}`
    : `${section}_versioned_docs/version-${version}`;
  const versionedDocsPath = path.join(__dirname, '..', versionedDocsDir);

  if (!fs.existsSync(versionedDocsPath)) {
    return;
  }

  console.log(`  Fixing relative imports in ${versionedDocsDir}...`);

  // Imports whose `../` count exceeds the file's depth within the section
  // escape the section root, so they need one extra `../` once the file
  // lives one level deeper inside the snapshot dir. Imports that stay
  // inside the section are unaffected (the section copies wholesale).
  function walk(dir, depth) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
        const original = fs.readFileSync(fullPath, 'utf8');
        // Track fenced code blocks so we don't rewrite import samples inside
        // ```ts / ```js (etc.) blocks that are documentation, not real imports.
        let inFence = false;
        const updated = original.split('\n').map(line => {
          if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            return line;
          }
          if (inFence) return line;
          return line.replace(
            /(from\s+['"])((?:\.\.\/)+)/g,
            (match, prefix, dots) => {
              const upCount = dots.match(/\.\.\//g).length;
              return upCount > depth ? `${prefix}../${dots}` : match;
            },
          );
        }).join('\n');
        if (updated !== original) {
          fs.writeFileSync(fullPath, updated);
          const rel = path.relative(versionedDocsPath, fullPath);
          console.log(`    Fixed imports in ${rel}`);
        }
      }
    }
  }

  walk(versionedDocsPath, 0);
}

function addVersion(section, version) {
  const config = loadConfig();

  if (!config[section]) {
    console.error(`Section '${section}' not found in config`);
    process.exit(1);
  }

  // Check if version already exists
  if (config[section].onlyIncludeVersions.includes(version)) {
    console.error(`Version ${version} already exists in ${section}`);
    process.exit(1);
  }

  console.log(`Creating version ${version} for ${section}...`);

  // Run Docusaurus version command
  const docusaurusCommand = section === 'docs'
    ? `yarn docusaurus docs:version ${version}`
    : `yarn docusaurus docs:version:${section} ${version}`;

  try {
    execSync(docusaurusCommand, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Failed to create version: ${error.message}`);
    process.exit(1);
  }

  // Freeze data imports BEFORE adjusting paths, so the depth-aware rewriter
  // doesn't process the now-local imports we just rewrote.
  freezeDataImports(section, version);

  // Fix relative imports in versioned content
  fixVersionedImports(section, version);

  // Update config
  // Add to onlyIncludeVersions array (after 'current')
  const versionIndex = config[section].onlyIncludeVersions.indexOf('current') + 1;
  config[section].onlyIncludeVersions.splice(versionIndex, 0, version);

  // Add version metadata
  const versionPath = section === 'docs' ? version : version;
  config[section].versions[version] = {
    label: version,
    path: versionPath,
    banner: 'none'
  };

  // Optionally update lastVersion if this is the first non-current version
  if (config[section].onlyIncludeVersions.length === 2) {
    config[section].lastVersion = version;
  }

  saveConfig(config);
  console.log(`✅ Version ${version} added successfully to ${section}`);
  console.log(`📝 Updated versions-config.json`);
}

function removeVersion(section, version) {
  const config = loadConfig();

  if (!config[section]) {
    console.error(`Section '${section}' not found in config`);
    process.exit(1);
  }

  if (version === 'current') {
    console.error(`Cannot remove 'current' version`);
    process.exit(1);
  }

  if (!config[section].onlyIncludeVersions.includes(version)) {
    console.error(`Version ${version} not found in ${section}`);
    process.exit(1);
  }

  console.log(`Removing version ${version} from ${section}...`);

  // Determine file paths based on section
  const versionedDocsDir = section === 'docs'
    ? `versioned_docs/version-${version}`
    : `${section}_versioned_docs/version-${version}`;

  const versionedSidebarsFile = section === 'docs'
    ? `versioned_sidebars/version-${version}-sidebars.json`
    : `${section}_versioned_sidebars/version-${version}-sidebars.json`;

  // Remove versioned files
  const docsPath = path.join(__dirname, '..', versionedDocsDir);
  const sidebarsPath = path.join(__dirname, '..', versionedSidebarsFile);

  if (fs.existsSync(docsPath)) {
    fs.rmSync(docsPath, { recursive: true });
    console.log(`  Removed ${versionedDocsDir}`);
  }

  if (fs.existsSync(sidebarsPath)) {
    fs.unlinkSync(sidebarsPath);
    console.log(`  Removed ${versionedSidebarsFile}`);
  }

  // Update versions.json file
  const versionsJsonFile = section === 'docs'
    ? 'versions.json'
    : `${section}_versions.json`;
  const versionsJsonPath = path.join(__dirname, '..', versionsJsonFile);

  if (fs.existsSync(versionsJsonPath)) {
    const versions = JSON.parse(fs.readFileSync(versionsJsonPath, 'utf8'));
    const versionIndex = versions.indexOf(version);
    if (versionIndex > -1) {
      versions.splice(versionIndex, 1);
      fs.writeFileSync(versionsJsonPath, JSON.stringify(versions, null, 2) + '\n');
      console.log(`  Updated ${versionsJsonFile}`);
    }
  }

  // Update config
  const versionIndex = config[section].onlyIncludeVersions.indexOf(version);
  config[section].onlyIncludeVersions.splice(versionIndex, 1);
  delete config[section].versions[version];

  // Update lastVersion if needed
  if (config[section].lastVersion === version) {
    // Set to the next available version or 'current'
    const remainingVersions = config[section].onlyIncludeVersions.filter(v => v !== 'current');
    config[section].lastVersion = remainingVersions.length > 0 ? remainingVersions[0] : 'current';
    console.log(`  Updated lastVersion to ${config[section].lastVersion}`);
  }

  saveConfig(config);
  console.log(`✅ Version ${version} removed successfully from ${section}`);
  console.log(`📝 Updated versions-config.json`);
}

function printUsage() {
  console.log(`
Usage:
  node scripts/manage-versions.js add <section> <version>
  node scripts/manage-versions.js remove <section> <version>

Where:
  - section: 'docs', 'developer_docs', or 'components'
  - version: version string (e.g., '1.2.0', '2.0.0')

Examples:
  node scripts/manage-versions.js add docs 2.0.0
  node scripts/manage-versions.js add developer_docs 1.3.0
  node scripts/manage-versions.js remove components 1.0.0
`);
}

// Main execution
if (!command || !section || !version) {
  printUsage();
  process.exit(1);
}

if (command === 'add') {
  addVersion(section, version);
} else if (command === 'remove') {
  removeVersion(section, version);
} else {
  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}
