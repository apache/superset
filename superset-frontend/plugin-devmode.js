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

/* eslint no-console: 0 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PLUGINS_REPO =
  process.env.SUPERSET_UI_PLUGINS_PATH ||
  path.resolve('../../superset-ui-plugins');

console.log('looking for plugins in ', PLUGINS_REPO);

const PACKAGES_ROOT = path.join(PLUGINS_REPO, 'packages');

// Blacklist packages that don't work from their /src folder, and thus don't support the npm-link technique.
// TODO refactor these troublesome packages so they can work with a symlink to their `src` directory
const unlinkablePackages = [
  '@superset-ui/legacy-preset-chart-nvd3', // doesn't work from /src folder
  '@superset-ui/preset-chart-xy', // doesn't work from /src folder
  '@superset-ui/legacy-plugin-chart-table', // Uncaught TypeError: Class constructor ChartPlugin cannot be invoked without 'new'
];

function findPackages() {
  if (!fs.existsSync(PACKAGES_ROOT)) {
    console.warn('Package root not found!');
    return [];
  }
  return fs
    .readdirSync(PACKAGES_ROOT, {
      withFileTypes: true,
    })
    .filter(thing => thing.isDirectory());
}

function linkPackages(packageDirs) {
  packageDirs.forEach((directory, i) => {
    const directoryPath = path.join(PACKAGES_ROOT, directory.name);
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const packageName = require(path.join(directoryPath, 'package.json')).name;
    console.log(`[${i + 1}/${packageDirs.length}] ${packageName}`);
    if (unlinkablePackages.includes(packageName)) {
      console.log(`Not linking this package!`);
    } else {
      execSync('npm link --loglevel error', {
        cwd: directoryPath,
        stdio: 'inherit',
      });
      execSync(`npm link ${packageName} --loglevel error`, {
        stdio: 'inherit',
      });
    }
  });
}

if (require.main === module) {
  console.log(`Enabling plugin devmode: Linking packages in ${PACKAGES_ROOT}`);

  linkPackages(findPackages());

  console.log('Plugin devmode enabled!');
}

module.exports = {
  findPackages,
  PACKAGES_ROOT,
  unlinkablePackages,
};
