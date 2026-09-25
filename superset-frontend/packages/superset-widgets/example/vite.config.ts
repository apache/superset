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
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import svgr from 'vite-plugin-svgr';

const exampleRoot = fileURLToPath(new URL('.', import.meta.url));
const packages = fileURLToPath(new URL('../..', import.meta.url));

// Consumes the widgets package and the Superset packages it builds on from
// source. Third-party dependencies (react, antd, emotion, echarts) resolve from
// superset-frontend/node_modules, which is why this app declares none.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, exampleRoot, '');
  return {
    plugins: [
      react({
        jsxImportSource: '@emotion/react',
        babel: { plugins: ['@emotion/babel-plugin'] },
      }),
      // Superset imports SVGs as React components (svgr in its webpack build).
      svgr({ include: '**/*.svg', svgrOptions: { exportType: 'default' } }),
    ],
    envPrefix: ['SUPERSET_URL', 'EMBED_', 'FILTER_'],
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        mode === 'production' ? 'production' : 'development',
      ),
      'process.env.WEBPACK_MODE': JSON.stringify(mode),
      'process.env.SCARF_ANALYTICS': JSON.stringify('false'),
      global: 'globalThis',
    },
    resolve: {
      alias: [
        {
          find: /^@apache-superset\/widgets$/,
          replacement: `${packages}superset-widgets/src/index.ts`,
        },
        {
          find: /^@apache-superset\/core$/,
          replacement: `${packages}superset-core/src/index.ts`,
        },
        {
          find: /^@apache-superset\/core\/(.*)$/,
          replacement: `${packages}superset-core/src/$1`,
        },
        {
          find: /^@superset-ui\/core$/,
          replacement: `${packages}superset-ui-core/src/index.ts`,
        },
        {
          find: /^@superset-ui\/core\/(.*)$/,
          replacement: `${packages}superset-ui-core/src/$1`,
        },
      ],
      dedupe: ['react', 'react-dom', '@emotion/react', 'antd'],
    },
    server: {
      port: 5173,
      strictPort: true,
      fs: { allow: [fileURLToPath(new URL('../../..', import.meta.url))] },
      proxy: {
        '/api/guest-token': `http://127.0.0.1:${env.BROKER_PORT || 3001}`,
      },
    },
    build: {
      chunkSizeWarningLimit: 4000,
    },
  };
});
