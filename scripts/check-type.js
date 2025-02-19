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
const { join, dirname, normalize, sep } = require("node:path");
const { readdir, stat } = require("node:fs/promises");
const { existsSync } = require("node:fs");
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

  const packageRootDir = await getPackage(packageArg);
  const updatedArgs = removePackageSegment(remainingArgs, packageRootDir);
  const argsStr = updatedArgs.join(" ");

  const excludedDeclarationDirs = getExcludedDeclarationDirs(
    excludeDeclarationDirArg
  );
  let declarationFiles = await getFilesRecursively(
    packageRootDir,
    DECLARATION_FILE_REGEX,
    excludedDeclarationDirs
  );
  declarationFiles = removePackageSegment(declarationFiles, packageRootDir);
  const declarationFilesStr = declarationFiles.join(" ");

  const packageRootDirAbsolute = join(SUPERSET_ROOT, packageRootDir);
  const tsConfig = getTsConfig(packageRootDirAbsolute);
  const command = `--noEmit --allowJs --composite false --project ${tsConfig} ${argsStr} ${declarationFilesStr}`;

  try {
    chdir(packageRootDirAbsolute);
    // Please ensure that tscw-config is installed in the package being type-checked.
    const tscw = packageRequire("tscw-config");
    const child = await tscw`${command}`;

    if (child.stdout) {
      console.log(child.stdout);
    }

    if (child.stderr) {
      console.error(child.stderr);
    }

    exit(child.exitCode);
  } catch (e) {
    console.error("Failed to execute type checking:", e);
    console.error("Package:", packageRootDir);
    console.error("Command:", `tscw ${command}`);
    exit(1);
  }
})();

/**
 *
 * @param {string} fullPath
 * @param {string[]} excludedDirs
 */
function shouldExcludeDir(fullPath, excludedDirs) {
  return excludedDirs.some((excludedDir) => {
    const normalizedExcludedDir = normalize(excludedDir);
    const normalizedPath = normalize(fullPath);
    return (
      normalizedExcludedDir === normalizedPath ||
      normalizedPath
        .split(sep)
        .filter((segment) => segment)
        .includes(normalizedExcludedDir)
    );
  });
}

/**
 * @param {string} dir
 * @param {RegExp} regex
 * @param {string[]} excludedDirs
 *
 * @returns {Promise<string[]>}
 */

async function getFilesRecursively(dir, regex, excludedDirs) {
  try {
    const files = await readdir(dir, { withFileTypes: true });
    const recursivePromises = [];
    const result = [];

    for (const file of files) {
      const fullPath = join(dir, file.name);

      if (file.isDirectory() && !shouldExcludeDir(fullPath, excludedDirs)) {
        recursivePromises.push(
          getFilesRecursively(fullPath, regex, excludedDirs)
        );
      } else if (regex.test(file.name)) {
        result.push(fullPath);
      }
    }

    const recursiveResults = await Promise.all(recursivePromises);
    return result.concat(...recursiveResults);
  } catch (e) {
    console.error(`Error reading directory: ${dir}`);
    console.error(e);
    exit(1);
  }
}

/**
 *
 * @param {string} packageArg
 * @returns {Promise<string>}
 */
async function getPackage(packageArg) {
  const packageDir = packageArg.split("=")[1].replace(/\/$/, "");
  try {
    const stats = await stat(packageDir);
    if (!stats.isDirectory()) {
      console.error(
        `Please specify a valid package, ${packageDir} is not a directory.`
      );
      exit(1);
    }
  } catch (e) {
    console.error(`Error reading package: ${packageDir}`);
    console.error(e);
    exit(1);
  }
  return packageDir;
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
 * @param {string} package
 * @returns {string[]}
 */
function removePackageSegment(args, package) {
  const packageSegment = package.concat(sep);
  return args.map((arg) => {
    const normalizedPath = normalize(arg);

    if (normalizedPath.startsWith(packageSegment)) {
      return normalizedPath.slice(packageSegment.length);
    }
    return arg;
  });
}

/**
 *
 * @param {string} dir
 */
function getTsConfig(dir) {
  const defaultTsConfig = "tsconfig.json";
  const tsConfig = join(dir, defaultTsConfig);

  if (!existsSync(tsConfig)) {
    console.error(`Error: ${defaultTsConfig} not found in ${dir}`);
    exit(1);
  }
  return tsConfig;
}

/**
 *
 * @param {string} module
 */
function packageRequire(module) {
  try {
    const localRequire = createRequire(join(cwd(), "node_modules"));
    return localRequire(module);
  } catch (e) {
    console.error(
      `Error: ${module} is not installed in ${cwd()}. Please install it first.`
    );
    exit(1);
  }
}
