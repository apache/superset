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
const section = args[1]; // 'docs', 'developer_portal', or 'components'
const version = args[2]; // version string like '1.2.0'

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
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
  - section: 'docs', 'developer_portal', or 'components'
  - version: version string (e.g., '1.2.0', '2.0.0')

Examples:
  node scripts/manage-versions.js add docs 2.0.0
  node scripts/manage-versions.js add developer_portal 1.3.0
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
