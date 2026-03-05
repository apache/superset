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

      // Stub out heavy third-party packages that are transitive dependencies of
      // superset-frontend components. The barrel file (components/index.ts)
      // re-exports all components, so webpack must resolve their imports even
      // though these components are never rendered on the docs site.
      const nullModuleShim = path.resolve(__dirname, './shims/null-module.js');
      const heavyDepsPatterns = [
        /^brace(\/|$)/, // ACE editor modes/themes
        /^react-ace(\/|$)/,
        /^ace-builds(\/|$)/,
        /^react-js-cron(\/|$)/, // Cron picker + CSS
        // react-resize-detector: NOT shimmed — DropdownContainer needs it at runtime
        // for overflow detection. Resolves from superset-frontend/node_modules.
        /^react-window(\/|$)/,
        /^re-resizable(\/|$)/,
        /^react-draggable(\/|$)/,
        /^ag-grid-react(\/|$)/,
        /^ag-grid-community(\/|$)/,
      ];
      heavyDepsPatterns.forEach(pattern => {
        config.plugins?.push(
          new webpack.NormalModuleReplacementPlugin(pattern, nullModuleShim),
        );
      });

      // Add YAML loader rule directly to existing rules
      config.module?.rules?.push({
        test: /\.ya?ml$/,
        use: 'js-yaml-loader',
      });

      // Add swc-loader rule for superset-frontend files
      // SWC is a Rust-based transpiler that's significantly faster than babel
      const supersetFrontendPath = path.resolve(
        __dirname,
        '../../superset-frontend',
      );
      config.module?.rules?.push({
        test: /\.(tsx?|jsx?)$/,
        include: supersetFrontendPath,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            // Ignore superset-frontend/.swcrc which references plugins not
            // installed in the docs workspace (e.g. @swc/plugin-emotion)
            swcrc: false,
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                  importSource: '@emotion/react',
                },
              },
            },
          },
        },
      });

      return {
        devtool: isDev ? false : config.devtool,
        cache: {
          type: 'filesystem' as const,
          buildDependencies: {
            config: [__filename],
          },
        },
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
            // Lightweight shim for @superset-ui/core that re-exports only the
            // utilities needed by components (ensureIsArray, usePrevious, etc.).
            // Avoids pulling in the full barrel which includes d3, color, query
            // modules and causes OOM. Required for Rspack which is stricter about
            // module resolution than webpack.
            '@superset-ui/core$': path.resolve(
              __dirname,
              './shims/superset-ui-core.ts',
            ),
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
            // Extension API package - resolve @apache-superset/core and its sub-paths
            // to source so the docs build doesn't depend on pre-built lib/ artifacts.
            // More specific sub-path aliases must come first; webpack matches the
            // longest prefix.
            '@apache-superset/core/ui': path.resolve(
              __dirname,
              '../../superset-frontend/packages/superset-core/src/ui',
            ),
            '@apache-superset/core/api/core': path.resolve(
              __dirname,
              '../../superset-frontend/packages/superset-core/src/api/core',
            ),
            '@apache-superset/core': path.resolve(
              __dirname,
              '../../superset-frontend/packages/superset-core/src',
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
      };
    },
  };
}
