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

import { spawn } from 'child_process';

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

export function runShellCommand({
  command, raiseOnError = true, exitOnError = true, cwd = null, verbose = false, dryRun = false,
}) {
  return new Promise((resolve, reject) => {
    const args = command.split(/\s+/).filter((s) => !!s && s !== '\\');
    const spawnOptions = {
      shell: true,
      cwd,
      env: { ...process.env },
    };

    if (cwd) {
      console.log(`RUN \`${command}\` in "${cwd}"`);
    } else {
      console.log(`RUN: \`${command}\``);
    }

    if (dryRun) {
      resolve({ stdout: '', stderr: '' });
      return;
    }

    const child = spawn(args.shift(), args, spawnOptions);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      if (verbose) {
        console.log(data.toString());
      }
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      if (verbose) {
        console.log(data.toString());
      }
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const msg = `Command failed with exit code ${code}: ${stderr}`;
        console.error(msg);

        if (raiseOnError) {
          reject(new Error(msg));
        }
        if (exitOnError) {
          process.exit(1);
        }
      }

      resolve({ stdout, stderr });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

export function shuffleArray(originalArray) {
  const array = [...originalArray]; // Create a shallow copy of the array
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
