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
const packageConfig = require('./package.json');

const importCoreModules = [];
Object.entries(packageConfig.dependencies).forEach(([pkg]) => {
  if (/@superset-ui/.test(pkg)) {
    importCoreModules.push(pkg);
  }
});

// ignore files in production mode
let ignorePatterns = [];
if (process.env.NODE_ENV === 'production') {
  ignorePatterns = [
    '*.test.{js,ts,jsx,tsx}',
    'plugins/**/test/**/*',
    'packages/**/test/**/*',
    'packages/generator-superset/**/*',
  ];
}

const restrictedImportsRules = {
  'no-design-icons': {
    name: '@ant-design/icons',
    message:
      'Avoid importing icons directly from @ant-design/icons. Use the src/components/Icons component instead.',
  },
  'no-moment': {
    name: 'moment',
    message:
      'Please use the dayjs library instead of moment.js. See https://day.js.org',
  },
  'no-lodash-memoize': {
    name: 'lodash/memoize',
    message: 'Lodash Memoize is unsafe! Please use memoize-one instead',
  },
  'no-testing-library-react': {
    name: '@superset-ui/core/spec',
    message: 'Please use spec/helpers/testing-library instead',
  },
  'no-testing-library-react-dom-utils': {
    name: '@testing-library/react-dom-utils',
    message: 'Please use spec/helpers/testing-library instead',
  },
  'no-antd': {
    name: 'antd',
    message: 'Please import Ant components from the index of src/components',
  },
  'no-superset-theme': {
    name: '@superset-ui/core',
    importNames: ['supersetTheme'],
    message:
      'Please use the theme directly from the ThemeProvider rather than importing supersetTheme.',
  },
  'no-query-string': {
    name: 'query-string',
    message: 'Please use the URLSearchParams API instead of query-string.',
  },
};

module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:react/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react-prefer-function-component/recommended',
    'plugin:storybook/recommended',
    'prettier',
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-react', '@babel/preset-env'],
    },
  },
  env: {
    browser: true,
    node: true,
    es2020: true,
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        moduleDirectory: ['node_modules', '.'],
      },
      typescript: {
        alwaysTryTypes: true,
        project: [
          './tsconfig.json',
          './packages/superset-ui-core/tsconfig.json',
          './packages/superset-ui-chart-controls/',
          './plugins/*/tsconfig.json',
        ],
      },
    },
    'import/core-modules': importCoreModules,
    react: {
      version: 'detect',
    },
  },
  plugins: [
    'import',
    'react',
    'jsx-a11y',
    'react-hooks',
    'file-progress',
    'lodash',
    'theme-colors',
    'icons',
    'i18n-strings',
    'react-prefer-function-component',
    'react-you-might-not-need-an-effect',
    'prettier',
    'react-you-might-not-need-an-effect',
  ],
  rules: {
    // === Essential Superset customizations ===

    // Prettier integration
    'prettier/prettier': 'error',

    // Custom Superset rules
    'theme-colors/no-literal-colors': 'error',
    'icons/no-fa-icons-usage': 'error',
    'i18n-strings/no-template-vars': ['error', true],

    // Core ESLint overrides for Superset
    'no-console': 'warn',
    'no-unused-vars': 'off', // TypeScript handles this
    camelcase: [
      'error',
      {
        allow: ['^UNSAFE_', '__REDUX_DEVTOOLS_EXTENSION_COMPOSE__'],
        properties: 'never',
      },
    ],
    'prefer-destructuring': ['error', { object: true, array: false }],
    'no-prototype-builtins': 0,
    curly: 'off',

    // Import plugin overrides
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        jsx: 'never',
        ts: 'never',
        tsx: 'never',
      },
    ],
    'import/no-cycle': 0,
    'import/prefer-default-export': 0,
    'import/no-named-as-default-member': 0,
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          'test/**',
          'tests/**',
          'spec/**',
          '**/__tests__/**',
          '**/__mocks__/**',
          '*.test.{js,jsx,ts,tsx}',
          '*.spec.{js,jsx,ts,tsx}',
          '**/*.test.{js,jsx,ts,tsx}',
          '**/*.spec.{js,jsx,ts,tsx}',
          '**/jest.config.js',
          '**/jest.setup.js',
          '**/webpack.config.js',
          '**/webpack.config.*.js',
          '**/.eslintrc.js',
        ],
        optionalDependencies: false,
      },
    ],

    // React plugin overrides
    'react/prop-types': 0,
    'react/require-default-props': 0,
    'react/forbid-prop-types': 0,
    'react/forbid-component-props': 1,
    'react/jsx-filename-extension': [1, { extensions: ['.jsx', '.tsx'] }],
    'react/jsx-fragments': 1,
    'react/jsx-no-bind': 0,
    'react/jsx-props-no-spreading': 0,
    'react/no-array-index-key': 0,
    'react/no-string-refs': 0,
    'react/no-unescaped-entities': 0,
    'react/no-unused-prop-types': 0,
    'react/destructuring-assignment': 0,
    'react/sort-comp': 0,
    'react/static-property-placement': 0,
    'react-prefer-function-component/react-prefer-function-component': 1,
    'react/react-in-jsx-scope': 0,
    'react/no-unknown-property': 0,
    'react/no-void-elements': 0,
    'react/function-component-definition': [
      0,
      {
        namedComponents: 'arrow-function',
      },
    ],
    'react/no-unstable-nested-components': 0,
    'react/jsx-no-useless-fragment': 0,
    'react/no-unused-class-component-methods': 0,

    // JSX-a11y overrides
    'jsx-a11y/anchor-is-valid': 1,
    'jsx-a11y/click-events-have-key-events': 0,
    'jsx-a11y/mouse-events-have-key-events': 0,
    'jsx-a11y/no-static-element-interactions': 0,

    // React effect best practices
    'react-you-might-not-need-an-effect/no-empty-effect': 'error',
    'react-you-might-not-need-an-effect/no-pass-live-state-to-parent': 'error',
    'react-you-might-not-need-an-effect/no-initialize-state': 'error',

    // Lodash
    'lodash/import-scope': [2, 'member'],

    // React effect best practices
    'react-you-might-not-need-an-effect/no-reset-all-state-on-prop-change':
      'error',
    'react-you-might-not-need-an-effect/no-chain-state-updates': 'error',
    'react-you-might-not-need-an-effect/no-event-handler': 'error',
    'react-you-might-not-need-an-effect/no-derived-state': 'error',

    // Storybook
    'storybook/prefer-pascal-case': 'error',

    // File progress
    'file-progress/activate': 1,

    // React effect rules
    'react-you-might-not-need-an-effect/no-adjust-state-on-prop-change':
      'error',
    'react-you-might-not-need-an-effect/no-pass-data-to-parent': 'error',

    // Restricted imports
    'no-restricted-imports': [
      'error',
      {
        paths: Object.values(restrictedImportsRules).filter(Boolean),
        patterns: ['antd/*'],
      },
    ],

    // Temporarily disabled for migration
    'no-unsafe-optional-chaining': 0,
    'no-import-assign': 0,
    'import/no-relative-packages': 0,
    'no-promise-executor-return': 0,
    'import/no-import-module-exports': 0,

    // Restrict certain syntax patterns
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "ImportDeclaration[source.value='react'] :matches(ImportDefaultSpecifier, ImportNamespaceSpecifier)",
        message:
          'Default React import is not required due to automatic JSX runtime in React 16.4',
      },
      {
        selector: 'ImportNamespaceSpecifier[parent.source.value!=/^(\\.|src)/]',
        message: 'Wildcard imports are not allowed',
      },
    ],
  },
  overrides: [
    // Ban JavaScript files in src/ - all new code must be TypeScript
    {
      files: ['src/**/*.js', 'src/**/*.jsx'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: 'Program',
            message:
              'JavaScript files are not allowed in src/. Please use TypeScript (.ts/.tsx) instead.',
          },
        ],
      },
    },
    // Ban JavaScript files in plugins/ - all plugin source code must be TypeScript
    {
      files: ['plugins/**/src/**/*.js', 'plugins/**/src/**/*.jsx'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: 'Program',
            message:
              'JavaScript files are not allowed in plugins/. Please use TypeScript (.ts/.tsx) instead.',
          },
        ],
      },
    },
    // Ban JavaScript files in packages/ - with exceptions for config files and generators
    {
      files: ['packages/**/src/**/*.js', 'packages/**/src/**/*.jsx'],
      excludedFiles: [
        'packages/generator-superset/**/*', // Yeoman generator templates run via Node
        'packages/**/__mocks__/**/*', // Test mocks
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: 'Program',
            message:
              'JavaScript files are not allowed in packages/. Please use TypeScript (.ts/.tsx) instead.',
          },
        ],
      },
    },
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
      },
      extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
      plugins: ['@typescript-eslint/eslint-plugin'],
      rules: {
        // TypeScript-specific rule overrides
        '@typescript-eslint/ban-ts-ignore': 0,
        '@typescript-eslint/ban-ts-comment': 0,
        '@typescript-eslint/ban-types': 0,
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: 'enum',
            format: ['PascalCase'],
          },
          {
            selector: 'enumMember',
            format: ['PascalCase'],
          },
        ],
        '@typescript-eslint/no-empty-function': 0,
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/no-use-before-define': 'error',
        '@typescript-eslint/no-non-null-assertion': 0,
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/explicit-module-boundary-types': 0,
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/prefer-optional-chain': 'error',

        // Disable base rules that conflict with TS versions
        'no-unused-vars': 'off',
        'no-use-before-define': 'off',
        'no-shadow': 'off',

        // Import overrides for TypeScript
        'import/extensions': [
          'error',
          'ignorePackages',
          {
            js: 'never',
            jsx: 'never',
            ts: 'never',
            tsx: 'never',
          },
        ],
      },
      settings: {
        'import/resolver': {
          typescript: {},
        },
      },
    },
    {
      files: ['packages/**'],
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
        'no-restricted-imports': [
          'error',
          {
            paths: [
              restrictedImportsRules['no-moment'],
              restrictedImportsRules['no-lodash-memoize'],
              restrictedImportsRules['no-superset-theme'],
            ],
            patterns: [],
          },
        ],
      },
    },
    {
      files: ['plugins/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              restrictedImportsRules['no-moment'],
              restrictedImportsRules['no-lodash-memoize'],
            ],
            patterns: [],
          },
        ],
      },
    },
    {
      files: ['src/components/**', 'src/theme/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: Object.values(restrictedImportsRules).filter(
              r => r.name !== 'antd',
            ),
            patterns: [],
          },
        ],
      },
    },
    {
      files: [
        '*.test.ts',
        '*.test.tsx',
        '*.test.js',
        '*.test.jsx',
        '*.stories.tsx',
        '*.stories.jsx',
        'fixtures.*',
        '**/test/**/*',
        '**/tests/**/*',
        'spec/**/*',
        '**/fixtures/**/*',
        '**/__mocks__/**/*',
        '**/spec/**/*',
      ],
      excludedFiles: 'cypress-base/cypress/**/*',
      plugins: ['jest-dom', 'no-only-tests', 'testing-library'],
      extends: ['plugin:jest-dom/recommended', 'plugin:testing-library/react'],
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
        'prefer-promise-reject-errors': 0,
        'max-classes-per-file': 0,

        // Temporary for migration
        'testing-library/await-async-queries': 0,
        'testing-library/await-async-utils': 0,
        'testing-library/no-await-sync-events': 0,
        'testing-library/no-render-in-lifecycle': 0,
        'testing-library/no-unnecessary-act': 0,
        'testing-library/no-wait-for-multiple-assertions': 0,
        'testing-library/prefer-screen-queries': 0,
        'testing-library/await-async-events': 0,
        'testing-library/no-node-access': 0,
        'testing-library/no-wait-for-side-effects': 0,
        'testing-library/prefer-presence-queries': 0,
        'testing-library/render-result-naming-convention': 0,
        'testing-library/no-container': 0,
        'testing-library/prefer-find-by': 0,
        'testing-library/no-manual-cleanup': 0,

        'no-restricted-syntax': [
          'error',
          {
            selector:
              "ImportDeclaration[source.value='react'] :matches(ImportDefaultSpecifier, ImportNamespaceSpecifier)",
            message:
              'Default React import is not required due to automatic JSX runtime in React 16.4',
          },
        ],
        'no-restricted-imports': 0,
      },
    },
    {
      files: [
        '*.test.ts',
        '*.test.tsx',
        '*.test.js',
        '*.test.jsx',
        '*.stories.tsx',
        '*.stories.jsx',
        'fixtures.*',
        '**/test/**/*',
        '**/tests/**/*',
        'spec/**/*',
        '**/fixtures/**/*',
        '**/__mocks__/**/*',
        '**/spec/**/*',
        'cypress-base/cypress/**/*',
        'Stories.tsx',
        'packages/superset-ui-core/src/theme/index.tsx',
      ],
      rules: {
        'theme-colors/no-literal-colors': 0,
        'icons/no-fa-icons-usage': 0,
        'i18n-strings/no-template-vars': 0,
        'no-restricted-imports': 0,
        'react/no-void-elements': 0,
      },
    },
    {
      files: [
        'packages/**/*.stories.*',
        'packages/**/*.overview.*',
        'packages/**/fixtures.*',
      ],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['playwright/**/*.ts', 'playwright/**/*.js'],
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
      },
    },
  ],
  ignorePatterns,
};
