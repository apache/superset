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

// @ts-check
const { exit } = require("node:process");
const { join, dirname } = require("node:path");
const { readdirSync } = require("node:fs");
const { chdir, cwd } = require("node:process");
const { createRequire } = require("node:module");

const SUPERSET_ROOT = dirname(__dirname);
const PACKAGE_ARG_REGEX = /^package=/;
const EXCLUDE_DECLARATION_DIR_REGEX = /^excludeDeclarationDir=/;
const DECLARATION_FILE_REGEX = /\.d\.ts$/;

void (async () => {
  const args = process.argv.slice(2);
  const {
    matchedArgs: [packageArg, excludeDeclarationDirArg],
    remainingArgs,
  } = extractArgs(args, [PACKAGE_ARG_REGEX, EXCLUDE_DECLARATION_DIR_REGEX]);

  if (!packageArg) {
    console.error("package is not specified");
    exit(1);
  }

  const packageRootDir = getPackage(packageArg);
  const packagePathRegex = new RegExp(`^${packageRootDir}\/`);
  const updatedArgs = removePackageSegment(remainingArgs, packagePathRegex);

  const excludedDeclarationDirs = getExcludedDeclarationDirs(
    excludeDeclarationDirArg
  );
  let declarationFiles = getFilesRecursivelySync(
    packageRootDir,
    DECLARATION_FILE_REGEX,
    excludedDeclarationDirs
  );
  declarationFiles = removePackageSegment(declarationFiles, packagePathRegex);

  try {
    chdir(join(SUPERSET_ROOT, packageRootDir));
    const packageRequire = createRequire(join(cwd(), "node_modules"));
    // Please ensure that tscw-config is installed in the package being type-checked.
    const tscw = packageRequire("tscw-config");
    const tsConfig = join(cwd(), "tsconfig.json");

    const child =
      await tscw`--noEmit --allowJs --project ${tsConfig} --composite false ${updatedArgs.join(
        " "
      )} ${declarationFiles.join(" ")}`;

    if (child.stdout) {
      console.log(child.stdout);
    } else {
      console.log(child.stderr);
    }

    exit(child.exitCode);
  } catch (e) {
    console.error(e);
    exit(1);
  }
})();

/**
 * @param {string} dir
 * @param {RegExp} regex
 * @param {string[]} excludedDirs
 *
 * @returns {string[]}
 */
function getFilesRecursivelySync(dir, regex, excludedDirs) {
  const files = readdirSync(dir, { withFileTypes: true });
  /** @type {string[]} */
  let result = [];

  for (const file of files) {
    const fullPath = join(dir, file.name);
    const shouldExclude = excludedDirs.includes(file.name);

    if (file.isDirectory() && !shouldExclude) {
      result = result.concat(
        getFilesRecursivelySync(fullPath, regex, excludedDirs)
      );
    } else if (regex.test(file.name)) {
      result.push(fullPath);
    }
  }
  return result;
}

/**
 *
 * @param {string} packageArg
 * @returns {string}
 */
function getPackage(packageArg) {
  return packageArg.split("=")[1].replace(/\/$/, "");
}

/**
 *
 * @param {string | undefined} excludeDeclarationDirArg
 * @returns {string[]}
 */
function getExcludedDeclarationDirs(excludeDeclarationDirArg) {
  const excludedDirs = ["node_modules"];

  return !excludeDeclarationDirArg
    ? excludedDirs
    : excludeDeclarationDirArg
        .split("=")[1]
        .split(",")
        .map((dir) => dir.replace(/\/$/, "").trim())
        .concat(excludedDirs);
}

/**
 *
 * @param {string[]} args
 * @param {RegExp[]} regexes
 * @returns {{ matchedArgs: (string | undefined)[], remainingArgs: string[] }}
 */

function extractArgs(args, regexes) {
  /**
   * @type {(string | undefined)[]}
   */
  const matchedArgs = [];
  const remainingArgs = [...args];

  regexes.forEach((regex) => {
    const index = remainingArgs.findIndex((arg) => regex.test(arg));
    if (index !== -1) {
      const [arg] = remainingArgs.splice(index, 1);
      matchedArgs.push(arg);
    } else {
      matchedArgs.push(undefined);
    }
  });

  return { matchedArgs, remainingArgs };
}

/**
 * Remove the package segment from path.
 *
 * For example: `superset-frontend/foo/bar.ts` -> `foo/bar.ts`
 *
 * @param {string[]} args
 * @param {RegExp} packagePathRegex
 * @returns {string[]}
 */
function removePackageSegment(args, packagePathRegex) {
  return args.map((arg) => arg.replace(packagePathRegex, ""));
}
