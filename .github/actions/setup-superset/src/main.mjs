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
import * as core from '@actions/core';
import { exec } from '@actions/exec';

const workspaceDirectory = process.env['GITHUB_WORKSPACE'];

// predefined backfunctions for the `prepare` and `run` commands to use.
const BASH_FUNCS = `
  # install python dependencies
  backend() {
    cd ${workspaceDirectory}
    pip install -r requirements.txt
    pip install -r requirements-dev.txt
    pip install -e ".[postgres,mysql]"
  }

  # prepare (lint and build) frontend code
  frontend() {
    echo "npm: $(npm --version)"
    echo "node: $(node --version)"
    cd ${workspaceDirectory}/superset-frontend/
    if [[ $1 eq '--cached' && -f ${workspaceDirectory}/superset/static/assets/manifest.json ]]
    then
      echo 'Skip because static assets already exist'
    else
      cd ${workspaceDirectory}/superset-frontend/
      npm ci
      npm run build -- --no-progress
    fi
  }

  testdata() {
    superset db upgrade
    superset load_test_users
    superset load_examples --load-test-data
    superset init
  }

  cypress() {
    cd ${workspaceDirectory}/superset-frontend/cypress-base
    npm ci
  }
`;

function runCommand(cmd) {
  return exec('bash', ['-c', `${BASH_FUNCS}\n${cmd}`]);
}

async function run() {
  try {
    const prepareCommands = (core.getInput('prepare') || '').trim();
    const additionalCommands = (core.getInput('run') || '').trim();
    const runInParallel = (core.getInput('parallel') || false) === 'true';

    if (prepareCommands) {
      console.log('Run prepare commands one by one...');
      await runCommand(prepareCommands);
    }

    if (additionalCommands) {
      if (runInParallel) {
        console.log('Run additional commands in parallel...');
        await Promise.all(additionalCommands.split('\n').map(runCommand));
      } else {
        await runCommand(additionalCommands);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
