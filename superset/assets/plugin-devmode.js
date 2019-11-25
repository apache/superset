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

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PLUGINS_REPO =
  process.env.SUPERSET_UI_PLUGINS_PATH
  || path.resolve('../../../superset-ui-plugins');

const PACKAGES_ROOT = path.join(PLUGINS_REPO, 'packages');

function findPackages() {
  if (!fs.existsSync(PACKAGES_ROOT)) {
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
    execSync('npm link --loglevel error', {
      cwd: directoryPath,
      stdio: 'inherit',
    });
    execSync(`npm link ${packageName} --loglevel error`, {
      stdio: 'inherit',
    });
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
};
