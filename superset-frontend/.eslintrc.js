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
  extends: ['airbnb', 'prettier'],
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
      }
    },
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      extends: [
        'airbnb',
        'plugin:@typescript-eslint/recommended',
        'prettier',
        'prettier/@typescript-eslint',
      ],
      plugins: ['@typescript-eslint/eslint-plugin', 'prettier', 'react'],
      rules: {
        '@typescript-eslint/ban-ts-ignore': 0,
        '@typescript-eslint/camelcase': [
          'error',
          {
            allow: ['^UNSAFE_'],
            properties: 'never',
          },
        ],
        '@typescript-eslint/no-empty-function': 0,
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/explicit-function-return-type': 0,
        camelcase: 0,
        'class-methods-use-this': 0,
        'func-names': 0,
        'guard-for-in': 0,
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
        'jsx-a11y/href-no-hash': 0,
        'jsx-a11y/no-static-element-interactions': 0,
        'new-cap': 0,
        'no-bitwise': 0,
        'no-confusing-arrow': 0,
        'no-continue': 0,
        'no-mixed-operators': 0,
        'no-multi-assign': 0,
        'no-multi-spaces': 0,
        'no-plusplus': 0,
        'no-prototype-builtins': 0,
        'no-restricted-properties': 0,
        'no-restricted-syntax': 0,
        'no-unused-vars': 0,
        'padded-blocks': 0,
        'prefer-arrow-callback': 0,
        'prefer-template': 0,
        'react/forbid-prop-types': 0,
        'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }],
        'react/jsx-no-bind': 0,
        'react/no-array-index-key': 0,
        'react/no-string-refs': 0,
        'react/no-unescaped-entities': 0,
        'react/no-unused-prop-types': 0,
        'react/require-default-props': 0,
        'react/jsx-fragments': 1,
        'react/prop-types': 0,
        'prettier/prettier': 'error',
      },
      settings: {
        'import/resolver': 'webpack',
        react: {
          version: 'detect',
        },
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
    'import/no-named-as-default': 0,
    'import/prefer-default-export': 0,
    indent: 0,
    'jsx-a11y/anchor-has-content': 0,
    'jsx-a11y/href-no-hash': 0,
    'jsx-a11y/no-static-element-interactions': 0,
    'new-cap': 0,
    'no-bitwise': 0,
    'no-confusing-arrow': 0,
    'no-continue': 0,
    'no-mixed-operators': 0,
    'no-multi-assign': 0,
    'no-multi-spaces': 0,
    'no-plusplus': 0,
    'no-prototype-builtins': 0,
    'no-restricted-properties': 0,
    'no-restricted-syntax': 0,
    'no-unused-vars': 0,
    'padded-blocks': 0,
    'prefer-arrow-callback': 0,
    'prefer-object-spread': 1,
    'prefer-template': 0,
    'react/forbid-prop-types': 0,
    'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }],
    'react/jsx-no-bind': 0,
    'react/no-array-index-key': 0,
    'react/no-string-refs': 0,
    'react/no-unescaped-entities': 0,
    'react/no-unused-prop-types': 0,
    'react/require-default-props': 0,
    'react/jsx-fragments': 1,
    'react/prop-types': 0,
    'prettier/prettier': 'error',
  },
  settings: {
    'import/resolver': 'webpack',
    react: {
      version: 'detect',
    },
  },
};
