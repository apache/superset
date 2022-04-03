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

const { execSync } = require('child_process');
const axios = require('axios');
const { name, version } = require('./package.json');

function log(...args) {
  console.log('[embedded-sdk-release]', ...args);
}

function logError(...args) {
  console.error('[embedded-sdk-release]', ...args);
}

(async () => {
  log(`checking if ${name}@${version} needs releasing`);

  const packageUrl = `https://registry.npmjs.org/${name}/${version}`;
  // npm commands output a bunch of garbage in the edge cases,
  // and require sending semi-validated strings to the command line,
  // so let's just use good old http.
  const { status } = await axios.get(packageUrl, {
    validateStatus: (status) => true // we literally just want the status so any status is valid
  });

  if (status === 200) {
    log('version already exists on npm, exiting');
  } else if (status === 404) {
    log('release required, building');
    try {
      execSync('npm run build', { stdio: 'pipe' });
      log('build successful, publishing')
      execSync('npm publish --access public', { stdio: 'pipe' });
      log(`published ${version} to npm`);
    } catch (err) {
      console.error(String(err.stdout));
      logError('Encountered an error, details should be above');
      process.exitCode = 1;
    }
  } else {
    logError(`ERROR: Received unexpected http status code ${status} from GET ${packageUrl}
The embedded sdk release script might need to be fixed, or maybe you just need to try again later.`);
    process.exitCode = 1;
  }
})();
