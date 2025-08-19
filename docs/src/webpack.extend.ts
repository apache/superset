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
      return {
        resolve: {
          alias: {
            ...config.resolve.alias,
            // Allow importing from superset-frontend
            src: path.resolve(__dirname, '../../superset-frontend/src'),
            '@superset-ui/core': path.resolve(
              __dirname,
              '../../superset-frontend/node_modules/@superset-ui/core',
            ),
            'storybook/internal/components': require.resolve(
              '@storybook/components',
            ),
            'storybook/internal/theming': require.resolve('@storybook/theming'),
            'storybook/internal/client-logger': require.resolve(
              '@storybook/client-logger',
            ),
            'storybook/internal/csf': require.resolve('@storybook/csf'),
            'storybook/internal/preview-api': require.resolve(
              '@storybook/preview-api',
            ),
            'storybook/internal/docs-tools': require.resolve(
              '@storybook/docs-tools',
            ),
            'storybook/internal/core-events': require.resolve(
              '@storybook/core-events',
            ),
            'storybook/internal/channels': require.resolve(
              '@storybook/channels',
            ),
          },
        },
        module: {
          rules: [
            {
              test: /\.tsx?$/,
              use: 'ts-loader',
              // Only process files from superset-frontend, not our own TypeScript files
              include: [path.resolve(__dirname, '../../superset-frontend')],
              exclude: [/node_modules/, path.resolve(__dirname, '../src')],
            },
          ],
        },
      };
    },
  };
}
