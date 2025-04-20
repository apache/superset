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

// eslint-disable-next-line no-restricted-syntax
import * as fs from 'fs';
// eslint-disable-next-line no-restricted-syntax
import * as path from 'path';
import archiver from 'archiver';

interface Manifest {
  name: string;
  version: string;
  description: string;
  moduleFederation: any;
  contributions: any; // TODO: Import type from @apache-superset/types?
  extensionDependencies: string[];
}

function createManifest(): Manifest {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const webpackConfigPath = path.resolve(process.cwd(), 'webpack.config.js');

  if (!fs.existsSync(packageJsonPath)) {
    console.error('Error: package.json not found in the current directory.');
    process.exit(1);
  }
  if (!fs.existsSync(webpackConfigPath)) {
    console.error(
      'Error: webpack.config.js not found in the current directory.',
    );
    process.exit(1);
  }

  // Load configuration files using require.
  // eslint-disable-next-line import/no-dynamic-require, global-require, @typescript-eslint/no-var-requires
  const packageJson = require(packageJsonPath);
  // eslint-disable-next-line import/no-dynamic-require, global-require, @typescript-eslint/no-var-requires
  const webpackConfig = require(webpackConfigPath);

  const manifest: Manifest = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    contributions: packageJson.contributions,
    extensionDependencies: packageJson.extensionDependencies || [],
    moduleFederation: {},
  };

  // If webpack.config.js exports an object, check for plugins.
  if (webpackConfig.plugins && Array.isArray(webpackConfig.plugins)) {
    manifest.moduleFederation = webpackConfig.plugins
      .filter(
        (plugin: any) =>
          plugin.constructor &&
          plugin.constructor.name === 'ModuleFederationPlugin',
      )
      // eslint-disable-next-line no-underscore-dangle
      .map((mfPlugin: any) => mfPlugin?._options);
  }

  return manifest;
}

function bundle(): void {
  const manifest = createManifest();

  // Determine output filename, e.g., my-extension-1.0.0.zip
  const outputFilename = `${manifest.name}-${manifest.version}.zip`;
  const outputPath = path.resolve(process.cwd(), outputFilename);
  const outputZip = fs.createWriteStream(outputPath);

  const archive = archiver('zip', {
    zlib: { level: 9 }, // maximum compression
  });

  outputZip.on('close', () => {
    console.log(
      `Bundle created: ${outputFilename} (${archive.pointer()} total bytes)`,
    );
  });

  archive.on('error', (err: Error) => {
    throw err;
  });

  // Pipe archive data to the file.
  archive.pipe(outputZip);

  // Add manifest.json to the root of the zip.
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  // Add the "dist" directory into a subfolder in the zip (if it exists).
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    archive.directory(distDir, 'dist');
  } else {
    console.warn(
      'Warning: "dist" directory not found. No distribution files added.',
    );
  }

  archive.finalize();
}

bundle();
