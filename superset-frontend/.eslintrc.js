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

const importCoreModules = [];
Object.entries(packageConfig.dependencies).forEach(([pkg]) => {
  if (/@superset-ui/.test(pkg)) {
    importCoreModules.push(pkg);
  }
});

// ignore files when running ForkTsCheckerWebpackPlugin
let ignorePatterns = [];
if (process.env.NODE_ENV === 'production') {
  ignorePatterns = [
    '*.test.{js,ts,jsx,tsx}',
    'plugins/**/test/**/*',
    'packages/**/test/**/*',
    'packages/generator-superset/**/*',
  ];
}

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
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      },
    },
    // Allow only core/src and core/test, avoid import modules from lib
    'import/internal-regex': /^@superset-ui\/core\/(src|test)\/.*/,
    'import/core-modules': importCoreModules,
    react: {
      version: 'detect',
    },
  },
  plugins: ['prettier', 'react', 'file-progress'],
  overrides: [
    {
      files: ['cypress-base/**/*'],
      rules: {
        'import/no-unresolved': 0,
        'global-require': 0,
      },
    },
    {
      files: ['webpack*.js'],
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
        '@typescript-eslint/no-use-before-define': 1, // disabled temporarily
        '@typescript-eslint/no-non-null-assertion': 0, // disabled temporarily
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/explicit-module-boundary-types': 0, // re-enable up for discussion
        camelcase: 0,
        'class-methods-use-this': 0,
        'func-names': 0,
        'guard-for-in': 0,
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
        'jsx-a11y/anchor-is-valid': 1,
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
          'warn',
          {
            paths: [
              {
                name: 'antd',
                message:
                  'Please import Ant components from the index of common/components',
              },
              {
                name: '@superset-ui/core',
                importNames: ['supersetTheme'],
                message:
                  'Please use the theme directly from the ThemeProvider rather than importing supersetTheme.',
              },
            ],
          },
        ],
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
        'react/sort-comp': 0, // TODO: re-enable in separate PR
        'react/static-property-placement': 0, // re-enable up for discussion
        'prettier/prettier': 'error',
        'file-progress/activate': 1,
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
      settings: {
        jest: {
          version: 'detect',
        },
      },
      extends: [
        'plugin:jest/recommended',
        'plugin:jest-dom/recommended',
        'plugin:testing-library/react',
      ],
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
        'no-only-tests/no-only-tests': 'error',
        'max-classes-per-file': 0,
        '@typescript-eslint/no-non-null-assertion': 0,
        // TODO: disabled temporarily, re-enable after monorepo
        'jest/consistent-test-it': 'error',
        'jest/expect-expect': 0,
        'jest/no-test-prefixes': 0,
        'jest/valid-expect-in-promise': 0,
        'jest/valid-expect': 0,
        'jest/valid-title': 0,
        'jest-dom/prefer-to-have-attribute': 0,
        'jest-dom/prefer-to-have-text-content': 0,
        'jest-dom/prefer-to-have-style': 0,
      },
    },
    {
      files: './packages/generator-superset/**/*.test.*',
      env: {
        node: true,
      },
      rules: {
        'jest/expect-expect': 0,
      },
    },
  ],
  rules: {
    camelcase: [
      'error',
      {
        allow: ['^UNSAFE_'],
        properties: 'never',
      },
    ],
    'class-methods-use-this': 0,
    curly: 2,
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
    'jsx-a11y/anchor-is-valid': 1,
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
    'react/sort-comp': 0, // TODO: re-enable in separate PR
    'react/static-property-placement': 0, // disabled temporarily
    'prettier/prettier': 'error',
  },
  ignorePatterns,
};
