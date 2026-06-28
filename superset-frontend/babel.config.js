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
const packageConfig = require('./package');

module.exports = {
  sourceMaps: true,
  sourceType: 'module',
  retainLines: true,
  // Babel 8 removed the `loose`/`spec` options from preset-env and plugins in
  // favor of granular compiler assumptions. These mirror the previous loose
  // behavior. See https://babeljs.io/assumptions
  assumptions: {
    setPublicClassFields: true,
    privateFieldsAsProperties: true,
    noDocumentAll: true,
  },
  presets: [
    [
      '@babel/preset-env',
      {
        modules: false,
        shippedProposals: true,
        targets: packageConfig.browserslist,
      },
    ],
    // preset-react is scoped to .jsx/.tsx via `overrides` below. In Babel 8 its
    // JSX syntax plugin would otherwise apply to .ts files and make TypeScript
    // generic arrows (e.g. `<T = unknown>(x: T) => x`) parse as JSX.
    ['@babel/preset-typescript', { onlyRemoveTypeImports: false }],
  ],
  plugins: [
    // Babel 8 removed preset-env's `useBuiltIns`/`corejs`; core-js polyfill
    // injection is now handled directly by babel-plugin-polyfill-corejs3.
    ['babel-plugin-polyfill-corejs3', { method: 'usage-global' }],
    '@babel/plugin-transform-export-namespace-from',
    // The class-properties/class-static-block/optional-chaining/private-methods/
    // nullish-coalescing transforms are bundled into preset-env in Babel 8 and
    // ordered correctly after preset-typescript; their loose behavior is now
    // covered by the top-level `assumptions`.
    ['@babel/plugin-transform-runtime', { corejs: 3 }],
    // @emotion/babel-plugin is scoped to .jsx/.tsx via `overrides` below: it
    // enables JSX syntax (for the `css` prop), which on .ts files would make
    // TypeScript generic arrows parse as JSX.
  ],
  env: {
    // Setup a different config for tests as they run in node instead of a browser
    test: {
      presets: [
        [
          '@babel/preset-env',
          {
            shippedProposals: true,
            // Let preset-env handle the CommonJS transform so it runs after
            // preset-typescript strips type-only imports/exports. A standalone
            // transform-modules-commonjs plugin would run first (Babel 8 orders
            // plugins before presets) and rewrite type-only re-exports into
            // requires before they can be elided.
            modules: 'commonjs',
            targets: { node: 'current' },
          },
        ],
        // preset-react is applied via the top-level `overrides` (scoped to
        // .jsx/.tsx), which also apply in this env.
        ['@babel/preset-typescript', { onlyRemoveTypeImports: false }],
      ],
      plugins: [
        ['babel-plugin-polyfill-corejs3', { method: 'usage-global' }],
        'babel-plugin-dynamic-import-node',
        '@babel/plugin-transform-export-namespace-from',
      ],
    },
    // build instrumented code for testing code coverage with Cypress
    instrumented: {
      plugins: [
        [
          'istanbul',
          {
            exclude: ['plugins/**/*', 'packages/**/*'],
          },
        ],
      ],
    },
    production: {
      plugins: [
        [
          'babel-plugin-jsx-remove-data-test-id',
          {
            // The plugin matches attribute names exactly (no prefix match),
            // so each data-test* attribute must be listed explicitly.
            attributes: [
              'data-test',
              'data-test-drag-source-id',
              'data-test-drop-target-id',
            ],
          },
        ],
      ],
    },
    testableProduction: {
      plugins: [],
    },
  },
  overrides: [
    {
      test: './plugins/plugin-chart-handlebars/node_modules/just-handlebars-helpers/*',
      sourceType: 'unambiguous',
    },
    {
      // Apply JSX-dependent transforms (preset-react and @emotion/babel-plugin)
      // only to files that can contain JSX. Both enable the JSX syntax plugin,
      // which on .ts files would make TypeScript generic arrows parse as JSX.
      test: /\.(jsx|tsx)$/,
      presets: [
        [
          '@babel/preset-react',
          {
            development: process.env.BABEL_ENV === 'development',
            runtime: 'automatic',
          },
        ],
      ],
      plugins: [
        [
          '@emotion/babel-plugin',
          {
            autoLabel: 'dev-only',
            labelFormat: '[local]',
          },
        ],
      ],
    },
  ],
};
