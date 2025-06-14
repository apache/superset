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

/* eslint-disable no-console */
const { sync } = require('fast-glob');
const { copy } = require('fs-extra');

const pkgGlob = process.argv[2] || '*';

const packages = sync([`{packages,plugins}/${pkgGlob}`], {
  onlyDirectories: true,
});

console.log('Copying asset files from package {src} to {lib,esm}...');
packages.forEach(pkg => {
  const assets = sync([`${pkg}/src/**/*.{png,gif,jpg,css,geojson}`]);
  assets.forEach(filePath => {
    ['lib', 'esm']
      .map(dir => filePath.replace(`${pkg}/src`, `${pkg}/${dir}`))
      .forEach(newFilePath => {
        copy(filePath, newFilePath, err => {
          if (err) {
            console.error(err);
          }
        });
      });
  });
  if (assets.length > 0) {
    console.log(
      `  Copied ${assets.length
        .toString()
        .padStart(2)} asset files for ${pkg.replace(
        'packages/superset-ui-',
        '',
      )}`,
    );
  }
});
