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

/**
 * MINIMAL ESLint flat config - ONLY for rules OXC doesn't support.
 *
 * This config is run alongside the OXC (oxlint) linter, which handles the
 * bulk of linting. ESLint here only covers the custom Superset plugins and
 * Prettier formatting that oxlint cannot express. It is consumed by
 * `scripts/oxlint-metrics-uploader.js` (`npm run lint-stats`).
 *
 * Migrated from the legacy `.eslintrc.minimal.js` (eslintrc) format to flat
 * config for ESLint v9+/v10, where eslintrc is no longer supported.
 *
 * Only covers:
 * - Custom Superset plugins (theme-colors, icons, i18n-strings)
 * - Prettier formatting
 */

// Register the TypeScript require hook so ESLint can load the .ts plugin files
// from eslint-rules/*.
require('tsx/cjs');

const tsParser = require('@typescript-eslint/parser');
const prettierPlugin = require('eslint-plugin-prettier');
const themeColorsPlugin = require('eslint-plugin-theme-colors');
const iconsPlugin = require('eslint-plugin-icons');
const i18nStringsPlugin = require('eslint-plugin-i18n-strings');

module.exports = [
  // Files this config applies to. Flat config has no `--ext`; globs live here.
  // Only check src/ files where the theme/icon/i18n rules matter.
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      'coverage/**',
      '**/*.min.js',
      'vendor/**',
      // Skip packages/plugins since they have different theming rules
      'packages/**',
      'plugins/**',
      // Skip generated/external/config files
      '**/*.generated.*',
      '**/*.config.js',
      '**/webpack.*',
      '*.json',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      // The @typescript-eslint parser handles both TS/TSX and plain JS/JSX and
      // is compatible with ESLint v10's scope manager. (The legacy
      // @babel/eslint-parser does not support ESLint v10.) The custom rules
      // here are pure AST visitors and do not require type information, so no
      // `project` is configured — this keeps parsing fast.
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    // Don't report on eslint-disable comments for rules we don't have.
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    plugins: {
      prettier: prettierPlugin,
      'theme-colors': themeColorsPlugin,
      icons: iconsPlugin,
      'i18n-strings': i18nStringsPlugin,
    },
    rules: {
      // Prettier integration (formatting)
      'prettier/prettier': 'error',

      // Custom Superset plugins
      'theme-colors/no-literal-colors': 'error',
      'icons/no-fa-icons-usage': 'error',
      'i18n-strings/no-template-vars': 'error',
      // Enabled only for controlPanel files via the override below.
      'i18n-strings/no-eager-t-in-config': 'off',
    },
  },
  {
    // Eager t()/tn() in `label`/`description` config props is captured at
    // module-load time, before i18n initializes — labels stay in the fallback
    // language even after the user switches. Surfaced as a warning (with
    // autofix to `() => t(...)`) wherever this is a real foot-gun:
    // controlPanel files. Promote to `'error'` once the codebase is clean.
    files: ['**/controlPanel.{ts,tsx,js,jsx}'],
    rules: {
      'i18n-strings/no-eager-t-in-config': 'warn',
    },
  },
  {
    // Disable custom rules in test/story files
    files: [
      '**/*.test.*',
      '**/*.spec.*',
      '**/*.stories.*',
      '**/test/**',
      '**/tests/**',
      '**/spec/**',
      '**/__tests__/**',
      '**/__mocks__/**',
      'cypress-base/**',
    ],
    rules: {
      'theme-colors/no-literal-colors': 'off',
      'icons/no-fa-icons-usage': 'off',
      'i18n-strings/no-template-vars': 'off',
    },
  },
];
