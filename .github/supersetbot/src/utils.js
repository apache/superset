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

import { spawnSync } from 'child_process';

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPackageJson() {
  try {
    const packageJsonPath = path.join(dirname, '../package.json');
    const data = await readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(data);
    return packageJson;
  } catch (error) {
    console.error('Error reading package.json:', error);
    return null;
  }
}
export async function currentPackageVersion() {
  const data = await loadPackageJson();
  return data.version;
}

export function runShellCommand({ command, raiseOnError = true, exitOnError = true, cwd = null, verbose = false }) {
  const args = command.split(/\s+/).filter((s) => !!s && s !== '\\');
  const spawnOptions = { stdio: 'inherit', shell: true };
  if (verbose) {
    console.log(`RUN: ${command}`);
  }
  if (cwd) {
    spawnOptions.cwd = cwd;
  }

  const result = spawnSync(args.shift(), args, spawnOptions);

  if (result.status !== 0) {
    const msg = `Command failed with exit code ${result.status}: ${result.stderr?.toString()}`;
    console.error(msg);

    if (raiseOnError) {
      throw new Error(msg);
    }
    if (exitOnError) {
      process.exit(1);
    }
  }

  return result.stdout?.toString();
}
