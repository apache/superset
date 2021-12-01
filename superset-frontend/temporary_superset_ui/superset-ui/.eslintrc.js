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
module.exports = {
  extends: [
    'airbnb',
    'prettier',
    'prettier/react',
    'plugin:react-hooks/recommended',
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
    },
  },
  env: {
    browser: true,
  },
  settings: {
    'import/resolver': {
      webpack: {},
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
    // Allow core/src and core/test, not import modules from lib
    'import/internal-regex': /^@superset-ui\/core\/(src|test)/,
    'import/core-modules': [
      '@superset-ui/core',
      '@superset-ui/chart-controls',
      '@superset-ui/legacy-plugin-chart-calendar',
      '@superset-ui/legacy-plugin-chart-chord',
      '@superset-ui/legacy-plugin-chart-country-map',
      '@superset-ui/legacy-plugin-chart-event-flow',
      '@superset-ui/legacy-plugin-chart-force-directed',
      '@superset-ui/legacy-plugin-chart-heatmap',
      '@superset-ui/legacy-plugin-chart-histogram',
      '@superset-ui/legacy-plugin-chart-horizon',
      '@superset-ui/legacy-plugin-chart-map-box',
      '@superset-ui/legacy-plugin-chart-paired-t-test',
      '@superset-ui/legacy-plugin-chart-parallel-coordinates',
      '@superset-ui/legacy-plugin-chart-partition',
      '@superset-ui/legacy-plugin-chart-pivot-table',
      '@superset-ui/legacy-plugin-chart-rose',
      '@superset-ui/legacy-plugin-chart-sankey',
      '@superset-ui/legacy-plugin-chart-sankey-loop',
      '@superset-ui/legacy-plugin-chart-sunburst',
      '@superset-ui/legacy-plugin-chart-time-table',
      '@superset-ui/legacy-plugin-chart-treemap',
      '@superset-ui/legacy-plugin-chart-world-map',
      '@superset-ui/legacy-preset-chart-big-number',
      '@superset-ui/legacy-preset-chart-nvd3',
      '@superset-ui/plugin-chart-echarts',
      '@superset-ui/plugin-chart-table',
      '@superset-ui/plugin-chart-word-cloud',
      '@superset-ui/preset-chart-xy',
    ],
    react: {
      version: 'detect',
    },
  },
  plugins: ['prettier', 'react'],
  rules: {
    camelcase: [
      'error',
      {
        allow: ['^UNSAFE_'],
        properties: 'never',
      },
    ],
    curly: 2,
    'class-methods-use-this': 0,
    'func-names': 0,
    'guard-for-in': 0,
    'import/extensions': [
      'error',
      {
        '.js': 'always',
        '.jsx': 'always',
        '.ts': 'always',
        '.tsx': 'always',
        '.json': 'always',
      },
    ],
    'import/no-cycle': 0, // re-enable up for discussion, might require some major refactors
    'import/prefer-default-export': 0,
    indent: 0,
    'jsx-a11y/anchor-is-valid': 0, // disabled temporarily
    'jsx-a11y/click-events-have-key-events': 0, // re-enable up for discussion
    'jsx-a11y/mouse-events-have-key-events': 0, // re-enable up for discussion
    'new-cap': 0,
    'no-bitwise': 0,
    'no-continue': 0,
    'no-mixed-operators': 0,
    'no-multi-assign': 0,
    'no-multi-spaces': 0,
    'no-nested-ternary': 0,
    'no-prototype-builtins': 0,
    'no-restricted-properties': 0,
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'antd',
            message:
              'Please import Ant components from the index of common/components',
          },
        ],
      },
    ],
    'no-shadow': 0, // re-enable up for discussion
    'padded-blocks': 0,
    'prefer-arrow-callback': 0,
    'prefer-object-spread': 1,
    'prefer-destructuring': ['error', { object: true, array: false }],
    'react/destructuring-assignment': 0, // re-enable up for discussion
    'react/forbid-prop-types': 0,
    'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }],
    'react/jsx-fragments': 1,
    'react/jsx-no-bind': 0,
    'react/jsx-props-no-spreading': 0, // re-enable up for discussion
    'react/no-array-index-key': 0,
    'react/no-string-refs': 0,
    'react/no-unescaped-entities': 0,
    'react/no-unused-prop-types': 0,
    'react/prop-types': 0,
    'react/require-default-props': 0,
    'react/static-property-placement': 0, // disabled temporarily
    'prettier/prettier': 'error',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      extends: [
        'airbnb',
        'plugin:@typescript-eslint/recommended',
        'prettier',
        'prettier/@typescript-eslint',
        'prettier/react',
      ],
      plugins: ['@typescript-eslint/eslint-plugin', 'prettier', 'react'],
      rules: {
        '@typescript-eslint/ban-ts-ignore': 0,
        '@typescript-eslint/ban-ts-comment': 0, // disabled temporarily
        '@typescript-eslint/ban-types': 0, // disabled temporarily
        '@typescript-eslint/no-empty-function': 0,
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/no-use-before-define': 1,
        '@typescript-eslint/no-non-null-assertion': 0, // disabled temporarily
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/explicit-module-boundary-types': 0, // re-enable up for discussion
        camelcase: 0,
        'class-methods-use-this': 0,
        'func-names': 0,
        'guard-for-in': 0,
        // there is a bug related to re-exports with this rule
        // which doesn't seem to have been fixed: https://github.com/benmosher/eslint-plugin-import/issues/1460
        'import/named': 0,
        'import/no-cycle': 0, // re-enable up for discussion, might require some major refactors
        'import/extensions': [
          'error',
          {
            '.ts': 'always',
            '.tsx': 'always',
            '.json': 'always',
          },
        ],
        'import/no-named-as-default-member': 0,
        'import/prefer-default-export': 0,
        indent: 0,
        'jsx-a11y/anchor-is-valid': 0, // disabled temporarily
        'jsx-a11y/click-events-have-key-events': 0, // re-enable up for discussion
        'jsx-a11y/mouse-events-have-key-events': 0, // re-enable up for discussion
        'new-cap': 0,
        'no-bitwise': 0,
        'no-continue': 0,
        'no-mixed-operators': 0,
        'no-multi-assign': 0,
        'no-multi-spaces': 0,
        'no-nested-ternary': 0,
        'no-prototype-builtins': 0,
        'no-restricted-properties': 0,
        'no-shadow': 0, // re-enable up for discussion
        'no-use-before-define': 0, // disabled temporarily
        'padded-blocks': 0,
        'prefer-arrow-callback': 0,
        'prefer-destructuring': ['error', { object: true, array: false }],
        'react/destructuring-assignment': 0, // re-enable up for discussion
        'react/forbid-prop-types': 0,
        'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }],
        'react/jsx-fragments': 1,
        'react/jsx-no-bind': 0,
        'react/jsx-props-no-spreading': 0, // re-enable up for discussion
        'react/no-array-index-key': 0,
        'react/no-string-refs': 0,
        'react/no-unescaped-entities': 0,
        'react/no-unused-prop-types': 0,
        'react/prop-types': 0,
        'react/require-default-props': 0,
        'react/static-property-placement': 0, // re-enable up for discussion
        'react/sort-comp': 0,
        'prettier/prettier': 'error',
      },
      settings: {
        'import/resolver': {
          webpack: {},
          typescript: {},
        },
        react: {
          version: 'detect',
        },
      },
    },
    {
      files: ['*.stories.jsx', '*.stories.tsx'],
      rules: {
        // this is to keep eslint from complaining about storybook addons,
        // since they are included as dev dependencies rather than direct dependencies.
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
      },
    },
    {
      files: ['*.d.ts'],
      rules: {
        'max-classes-per-file': 0,
      },
    },
    {
      files: [
        '*.test.ts',
        '*.test.tsx',
        '*.test.js',
        '*.test.jsx',
        'fixtures.*',
      ],
      plugins: ['jest', 'jest-dom', 'no-only-tests', 'testing-library'],
      env: {
        'jest/globals': true,
      },
      extends: ['plugin:jest/recommended', 'plugin:testing-library/react'],
      rules: {
        'import/no-extraneous-dependencies': 0,
        'jest/consistent-test-it': 'error',
        'jest/no-try-expect': 0,
        'max-classes-per-file': 0,
        'no-only-tests/no-only-tests': 'error',
        'prefer-promise-reject-errors': 0,
      },
    },
    {
      files: ['webpack*.js', '.*rc.js', '*.config.js'],
      env: {
        node: true,
      },
      settings: {
        'import/resolver': {
          node: {},
        },
      },
    },
    {
      files: './packages/generator-superset/**/*.test.*',
      env: {
        node: true,
      },
      settings: {
        'import/resolver': {
          node: {},
        },
      },
      rules: {
        'jest/expect-expect': 0,
      },
    },
  ],
};
