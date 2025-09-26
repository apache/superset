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

const fs = require('fs');
const path = require('path');

// Minimal project.json that inherits everything from nx.json targetDefaults
const minimalProjectConfig = (name) => ({
  name,
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "targets": {
    "build": {}  // Empty object inherits all defaults from nx.json
  }
});

// Find all project.json files
const packagesDir = path.join(__dirname, '..', 'superset-frontend', 'packages');
const pluginsDir = path.join(__dirname, '..', 'superset-frontend', 'plugins');

function updateProjectJson(dir) {
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const itemPath = path.join(dir, item);
    const projectJsonPath = path.join(itemPath, 'project.json');

    if (fs.existsSync(projectJsonPath)) {
      const projectName = item;
      const minimalConfig = minimalProjectConfig(projectName);

      fs.writeFileSync(
        projectJsonPath,
        JSON.stringify(minimalConfig, null, 2) + '\n'
      );
      console.log(`✓ Simplified ${projectJsonPath}`);
    }
  });
}

console.log('Simplifying Nx project.json files to use targetDefaults from nx.json...\n');

updateProjectJson(packagesDir);
updateProjectJson(pluginsDir);

console.log('\n✅ All project.json files have been simplified!');
console.log('The common configuration now lives in nx.json targetDefaults.');
