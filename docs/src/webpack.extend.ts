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
import type { Plugin } from '@docusaurus/types';

export default function webpackExtendPlugin(): Plugin<void> {
  return {
    name: 'custom-webpack-plugin',
    configureWebpack(config) {
      const isDev = process.env.NODE_ENV === 'development';
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
          alias: {
            ...config.resolve.alias,
            // Allow importing from superset-frontend
            src: path.resolve(__dirname, '../../superset-frontend/src'),
            // Add aliases for our components to make imports easier
            '@docs/components': path.resolve(__dirname, '../src/components'),
            '@superset/components': path.resolve(
              __dirname,
              '../../superset-frontend/packages/superset-ui-core/src/components',
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
