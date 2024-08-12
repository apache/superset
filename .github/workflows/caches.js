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

// always use absolute directory
const workspaceDirectory = process.env.GITHUB_WORKSPACE;
const homeDirectory = process.env.HOME;

const assetsConfig = {
  path: [`${workspaceDirectory}/superset/static/assets`],
  hashFiles: [
    `${workspaceDirectory}/superset-frontend/src/**/*`,
    `${workspaceDirectory}/superset-frontend/packages/**/*`,
    `${workspaceDirectory}/superset-frontend/plugins/**/*`,
    `${workspaceDirectory}/superset-frontend/*.js`,
    `${workspaceDirectory}/superset-frontend/*.json`,
  ],
  // dont use restore keys as it may give an invalid older build
  restoreKeys: '',
};

// Multi-layer cache definition
module.exports = {
  pip: {
    path: [`${homeDirectory}/.cache/pip`],
    hashFiles: [`${workspaceDirectory}/requirements/*.txt`],
  },
  npm: {
    path: [`${homeDirectory}/.npm`],
    hashFiles: [`${workspaceDirectory}/superset-frontend/package-lock.json`],
  },
  assets: assetsConfig,
  // use separate cache for instrumented JS files and regular assets
  // one is built with `npm run build`,
  // another is built with `npm run build-instrumented`
  'instrumented-assets': assetsConfig,
  cypress: {
    path: [`${homeDirectory}/.cache/Cypress`],
    hashFiles: [
      `${workspaceDirectory}/superset-frontend/cypress-base/package-lock.json`,
    ],
  },
};
