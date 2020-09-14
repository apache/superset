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
  extends: ['airbnb', 'prettier', 'prettier/react'],
  parser: 'babel-eslint',
  parserOptions: {
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
    },
  },
  env: {
    browser: true,
  },
  plugins: ['prettier', 'react'],
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
      rules: {
        'import/no-extraneous-dependencies': 0,
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
        '@typescript-eslint/no-non-null-assertion': 0, // disabled temporarily
        '@typescript-eslint/no-use-before-define': 1, // disabled temporarily
        '@typescript-eslint/no-unused-vars': 0, // disabled temporarily
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
        'import/no-named-as-default': 0,
        'import/no-named-as-default-member': 0,
        'import/prefer-default-export': 0,
        indent: 0,
        'jsx-a11y/anchor-has-content': 0,
        'jsx-a11y/anchor-is-valid': 0, // disabled temporarily
        'jsx-a11y/click-events-have-key-events': 0, // re-enable up for discussion
        'jsx-a11y/control-has-associated-label': 0, // disabled temporarily
        'jsx-a11y/mouse-events-have-key-events': 0, // re-enable up for discussion
        'lines-between-class-members': 0, // disabled temporarily
        'new-cap': 0,
        'no-bitwise': 0,
        'no-continue': 0,
        'no-else-return': 0, // disabled temporarily
        'no-mixed-operators': 0,
        'no-multi-assign': 0,
        'no-multi-spaces': 0,
        'no-plusplus': 0,
        'no-prototype-builtins': 0,
        'no-restricted-globals': 0, // disabled temporarily
        'no-restricted-properties': 0,
        'no-restricted-syntax': 0,
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
        'no-use-before-define': 0, // disabled temporarily
        'padded-blocks': 0,
        'prefer-arrow-callback': 0,
        'prefer-destructuring': ['error', { object: true, array: false }],
        'react/default-props-match-prop-types': 0, // disabled temporarily
        'react/destructuring-assignment': 0, // re-enable up for discussion
        'react/forbid-prop-types': 0,
        'react/jsx-curly-brace-presence': 0, // disabled temporarily
        'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }],
        'react/jsx-fragments': 1,
        'react/jsx-no-bind': 0,
        'react/jsx-props-no-spreading': 0, // re-enable up for discussion
        'react/no-access-state-in-setstate': 0, // disabled temporarily
        'react/no-array-index-key': 0,
        'react/no-string-refs': 0,
        'react/no-unescaped-entities': 0,
        'react/no-unused-prop-types': 0,
        'react/prop-types': 0,
        'react/require-default-props': 0,
        'react/sort-comp': 0, // disabled temporarily
        'react/state-in-constructor': 0, // disabled temporarily
        'react/static-property-placement': 0, // re-enable up for discussion
        'prettier/prettier': 'error',
      },
      settings: {
        'import/resolver': 'webpack',
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
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.test.js',
        'src/**/*.test.jsx',
      ],
      plugins: ['jest', 'no-only-tests'],
      env: {
        'jest/globals': true,
      },
      extends: ['plugin:jest/recommended'],
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
        'jest/consistent-test-it': 'error',
        'no-only-tests/no-only-tests': 'error',
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
    'import/no-named-as-default': 0,
    'import/prefer-default-export': 0,
    indent: 0,
    'jsx-a11y/anchor-has-content': 0,
    'jsx-a11y/anchor-is-valid': 0, // disabled temporarily
    'jsx-a11y/click-events-have-key-events': 0, // re-enable up for discussion
    'jsx-a11y/control-has-associated-label': 0, // disabled temporarily
    'jsx-a11y/mouse-events-have-key-events': 0, // re-enable up for discussion
    'lines-between-class-members': 0, // disabled temporarily
    'new-cap': 0,
    'no-restricted-globals': 0, // disabled temporarily
    'no-else-return': 0, // disabled temporarily
    'no-bitwise': 0,
    'no-continue': 0,
    'no-mixed-operators': 0,
    'no-multi-assign': 0,
    'no-multi-spaces': 0,
    'no-plusplus': 0,
    'no-prototype-builtins': 0,
    'no-restricted-properties': 0,
    'no-restricted-syntax': 0,
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
    'react/default-props-match-prop-types': 0, // disabled temporarily
    'react/destructuring-assignment': 0, // re-enable up for discussion
    'react/forbid-prop-types': 0,
    'react/jsx-curly-brace-presence': 0, // disabled temporarily
    'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }],
    'react/jsx-fragments': 1,
    'react/jsx-no-bind': 0,
    'react/jsx-props-no-spreading': 0, // re-enable up for discussion
    'react/no-access-state-in-setstate': 0, // disabled temporarily
    'react/no-array-index-key': 0,
    'react/no-string-refs': 0,
    'react/no-unescaped-entities': 0,
    'react/no-unused-prop-types': 0,
    'react/prop-types': 0,
    'react/require-default-props': 0,
    'react/sort-comp': 0, // disabled temporarily
    'react/state-in-constructor': 0, // disabled temporarily
    'react/static-property-placement': 0, // disabled temporarily
    'prettier/prettier': 'error',
  },
  settings: {
    'import/resolver': 'webpack',
    react: {
      version: 'detect',
    },
  },
};
