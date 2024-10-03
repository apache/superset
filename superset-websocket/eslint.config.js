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

const typescriptEslintParser = require('@typescript-eslint/parser');
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin');
const typescriptEslint = require('typescript-eslint');
const lodashEslintPlugin = require('eslint-plugin-lodash');
const eslintConfigPrettier = require('eslint-config-prettier');
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    ignores: ['*.min.js', 'node_modules', 'dist', 'coverage'],
    languageOptions: {
      parser: typescriptEslintParser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      typescript: typescriptEslintPlugin,
      lodash: lodashEslintPlugin,
    },
    rules: {
      'lodash/import-scope': [2, 'member'],
      '@typescript-eslint/explicit-module-boundary-types': 0,
      '@typescript-eslint/no-var-requires': 0,
      '@typescript-eslint/no-require-imports': 0, // Re-enable once superset-websocket is converted to ESM
    },
  },
];
