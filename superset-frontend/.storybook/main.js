import { dirname, join } from 'path';
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
// Superset's webpack.config.js
const customConfig = require('../webpack.config.js');

// Filter out plugins that shouldn't be included in Storybook's static build
// ReactRefreshWebpackPlugin adds Fast Refresh code that requires a dev server runtime,
// which isn't available when serving the static storybook build
// ForkTsCheckerWebpackPlugin causes TypeScript project reference errors in Storybook context
const pluginsToExclude = [
  'ReactRefreshWebpackPlugin',
  'ForkTsCheckerWebpackPlugin',
];
const filteredPlugins = customConfig.plugins.filter(
  plugin => !pluginsToExclude.includes(plugin.constructor.name),
);

// Deep clone and modify rules to disable React Fast Refresh and dev mode in SWC loader
// The Fast Refresh transform adds $RefreshSig$ calls that require a runtime
// which isn't present when serving the static build.
// Also disable development mode to use jsx instead of jsxDEV runtime.
const disableDevModeInRules = rules =>
  rules.map(rule => {
    if (!rule.use) return rule;

    const newUse = (Array.isArray(rule.use) ? rule.use : [rule.use]).map(
      loader => {
        // Check if this is the swc-loader with react transform settings
        if (
          typeof loader === 'object' &&
          loader.loader?.includes('swc-loader') &&
          loader.options?.jsc?.transform?.react
        ) {
          return {
            ...loader,
            options: {
              ...loader.options,
              jsc: {
                ...loader.options.jsc,
                transform: {
                  ...loader.options.jsc.transform,
                  react: {
                    ...loader.options.jsc.transform.react,
                    refresh: false,
                    development: false,
                  },
                },
              },
            },
          };
        }
        return loader;
      },
    );

    return {
      ...rule,
      use: Array.isArray(rule.use) ? newUse : newUse[0],
    };
  });

module.exports = {
  stories: [
    '../src/**/*.stories.tsx',
    '../packages/superset-ui-core/src/**/*.stories.tsx',
    '../plugins/*/src/**/*.stories.tsx',
  ],

  addons: [
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-links'),
    '@mihkeleidast/storybook-addon-source',
    getAbsolutePath('@storybook/addon-controls'),
    getAbsolutePath('@storybook/addon-mdx-gfm'),
  ],

  staticDirs: ['../src/assets/images'],

  webpackFinal: config => ({
    ...config,
    module: {
      ...config.module,
      rules: disableDevModeInRules(customConfig.module.rules),
    },
    resolve: {
      ...config.resolve,
      ...customConfig.resolve,
      alias: {
        ...config.resolve?.alias,
        ...customConfig.resolve?.alias,
        // Fix for Storybook 8.6.x with React 17 - resolve ESM module paths
        'react-dom/test-utils': require.resolve('react-dom/test-utils'),
        // Shared storybook utilities
        '@storybook-shared': join(__dirname, 'shared'),
      },
    },
    plugins: [...config.plugins, ...filteredPlugins],
  }),

  typescript: {
    reactDocgen: getAbsolutePath('react-docgen-typescript'),
  },

  framework: {
    name: getAbsolutePath('@storybook/react-webpack5'),
    options: {},
  },

  docs: {
    autodocs: false,
  },
};

function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, 'package.json')));
}
