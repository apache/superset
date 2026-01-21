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

import path from 'path';
import webpack from 'webpack';
import type { Plugin } from '@docusaurus/types';

export default function webpackExtendPlugin(): Plugin<void> {
  return {
    name: 'custom-webpack-plugin',
    configureWebpack(config) {
      const isDev = process.env.NODE_ENV === 'development';

      // Use NormalModuleReplacementPlugin to forcefully replace react-table
      // This is necessary because regular aliases don't work for modules in nested node_modules
      const reactTableShim = path.resolve(__dirname, './shims/react-table.js');
      config.plugins?.push(
        new webpack.NormalModuleReplacementPlugin(
          /^react-table$/,
          reactTableShim,
        ),
      );

      // Add YAML loader rule directly to existing rules
      config.module?.rules?.push({
        test: /\.ya?ml$/,
        use: 'js-yaml-loader',
      });

      // Add babel-loader rule for superset-frontend files
      // This ensures Emotion CSS-in-JS is processed correctly for SSG
      const supersetFrontendPath = path.resolve(
        __dirname,
        '../../superset-frontend',
      );
      config.module?.rules?.push({
        test: /\.(tsx?|jsx?)$/,
        include: supersetFrontendPath,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-react',
                {
                  runtime: 'automatic',
                  importSource: '@emotion/react',
                },
              ],
              '@babel/preset-typescript',
            ],
            plugins: ['@emotion/babel-plugin'],
          },
        },
      });

      return {
        devtool: isDev ? 'eval-source-map' : config.devtool,
        ...(isDev && {
          optimization: {
            ...config.optimization,
            minimize: false,
            removeAvailableModules: false,
            removeEmptyChunks: false,
            splitChunks: false,
          },
        }),
        resolve: {
          // Add superset-frontend node_modules to module resolution
          modules: [
            ...(config.resolve?.modules || []),
            path.resolve(__dirname, '../../superset-frontend/node_modules'),
          ],
          alias: {
            ...config.resolve.alias,
            // Ensure single React instance across all modules (critical for hooks to work)
            react: path.resolve(__dirname, '../node_modules/react'),
            'react-dom': path.resolve(__dirname, '../node_modules/react-dom'),
            // Allow importing from superset-frontend
            src: path.resolve(__dirname, '../../superset-frontend/src'),
            // '@superset-ui/core': path.resolve(
            //   __dirname,
            //   '../../superset-frontend/packages/superset-ui-core',
            // ),
            // Add aliases for our components to make imports easier
            '@docs/components': path.resolve(__dirname, '../src/components'),
            '@superset/components': path.resolve(
              __dirname,
              '../../superset-frontend/packages/superset-ui-core/src/components',
            ),
            // Also alias the full package path for internal imports within components
            '@superset-ui/core/components': path.resolve(
              __dirname,
              '../../superset-frontend/packages/superset-ui-core/src/components',
            ),
            // Use a shim for react-table to handle CommonJS to ES module interop
            // react-table v7 is CommonJS, but Superset components import it with ES module syntax
            'react-table': path.resolve(__dirname, './shims/react-table.js'),
            // Extension API package - allows docs to import from @apache-superset/core/ui
            // This matches the established pattern used throughout the Superset codebase
            // Note: TypeScript types come from docs/src/types/apache-superset-core (see tsconfig.json)
            // This split is intentional: webpack resolves actual source, tsconfig provides simplified types
            '@apache-superset/core/ui': path.resolve(
              __dirname,
              '../../superset-frontend/packages/superset-core/src/ui',
            ),
            '@apache-superset/core/api/core': path.resolve(
              __dirname,
              '../../superset-frontend/packages/superset-core/src/api/core',
            ),
            // Add proper Storybook aliases
            '@storybook/blocks': path.resolve(
              __dirname,
              '../node_modules/@storybook/blocks',
            ),
            '@storybook/components': path.resolve(
              __dirname,
              '../node_modules/@storybook/components',
            ),
            '@storybook/theming': path.resolve(
              __dirname,
              '../node_modules/@storybook/theming',
            ),
            '@storybook/client-logger': path.resolve(
              __dirname,
              '../node_modules/@storybook/client-logger',
            ),
            '@storybook/core-events': path.resolve(
              __dirname,
              '../node_modules/@storybook/core-events',
            ),
            // Add internal Storybook aliases
            'storybook/internal/components': path.resolve(
              __dirname,
              '../node_modules/@storybook/components',
            ),
            'storybook/internal/theming': path.resolve(
              __dirname,
              '../node_modules/@storybook/theming',
            ),
            'storybook/internal/client-logger': path.resolve(
              __dirname,
              '../node_modules/@storybook/client-logger',
            ),
            'storybook/internal/csf': path.resolve(
              __dirname,
              '../node_modules/@storybook/csf',
            ),
            'storybook/internal/preview-api': path.resolve(
              __dirname,
              '../node_modules/@storybook/preview-api',
            ),
            'storybook/internal/docs-tools': path.resolve(
              __dirname,
              '../node_modules/@storybook/docs-tools',
            ),
            'storybook/internal/core-events': path.resolve(
              __dirname,
              '../node_modules/@storybook/core-events',
            ),
            'storybook/internal/channels': path.resolve(
              __dirname,
              '../node_modules/@storybook/channels',
            ),
          },
        },
        // We're removing the ts-loader rule that was processing superset-frontend files
        // This will prevent TypeScript errors from files outside the docs directory
      };
    },
  };
}
