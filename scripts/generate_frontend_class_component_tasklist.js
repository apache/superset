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

// Run this from the superset-frontend directory with
// `node ../scripts/generate_frontend_ts_tasklist.js `, then copy and paste the output into
// https://github.com/apache/superset/discussions/26076
const { readdirSync, readFileSync } = require("fs");
const process = require("process");

const INITIAL_DIRECTORIES = ["spec", "src", "packages"];
const DEFAULT_DIRECTORY = process.cwd();

const getDirectories = (source) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

const getFilesByExtensions = (source, extensions) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) =>
      extensions.some((extension) => dirent.name.endsWith(extension))
    )
    .map((dirent) => dirent.name);

const hasClassComponent = (filePath) => {
  const fileContent = readFileSync(filePath, "utf8");
  const classComponentRegex =
    /class\s+\w+\s+extends\s+(React\.Component|React\.PureComponent)/g;
  return classComponentRegex.test(fileContent);
};

let directories = INITIAL_DIRECTORIES;

while (directories.length) {
  const curDirectory = directories.pop();
  process.chdir(curDirectory);
  // Check for existence of class components in js, jsx, ts, and tsx files. Show an empty box if
  // it has a class Component and a filled box if it does not.
  const files = getFilesByExtensions("./", [".js", ".jsx", ".ts", ".tsx"]);

  if (files.length > 0) {
    const hasClassComponents = files.some((file) =>
      hasClassComponent(`./${file}`)
    );
    if (hasClassComponents) {
      console.log(`- [ ] \`${curDirectory}\``);
    }
  }

  directories = directories.concat(
    getDirectories("./")
      .reverse() // For ABC order when pushed into the Array
      .filter((name) => name !== "node_modules") // Don't include node_modules in our packages
      .map((directory) => `${curDirectory}/${directory}`)
  );
  process.chdir(DEFAULT_DIRECTORY);
}
