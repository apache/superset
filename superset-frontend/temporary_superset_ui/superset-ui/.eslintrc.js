const path = require('path');

module.exports = {
  extends: [
    './node_modules/@airbnb/config-eslint/lib/presets/base.js',
    './node_modules/@airbnb/config-eslint/lib/presets/next.js',
    './node_modules/@airbnb/config-eslint/lib/presets/typescript.js',
    './node_modules/@airbnb/config-eslint/lib/presets/prettier.js',
    'prettier/@typescript-eslint',
    'prettier/unicorn',
  ],
  parserOptions: {
    project: path.join(__dirname, './tsconfig.eslint.json'),
  },
  rules: {
    'arrow-parens': ['warn', 'as-needed'],
  },
  overrides: [
    {
      files: '**/*.d.ts',
      rules: {
        'max-classes-per-file': 0,
      },
    },
    {
      files: './packages/generator-superset/**/*.test.{js,jsx,ts,tsx}',
      rules: {
        'jest/expect-expect': 0,
      },
    },
    {
      files: '**/test/**/*',
      rules: {
        'import/no-extraneous-dependencies': 0,
        'promise/param-names': 0,
        'jest/require-to-throw-message': 0,
        'jest/no-test-return-statement': 0,
        'jest/no-expect-resolves': 0,
        '@typescript-eslint/no-require-imports': 0,
        'global-require': 0,
      },
    },
    {
      files: '*.{js,jsx,ts,tsx}',
      rules: {
        'import/extensions': 0,
        'no-plusplus': 0,
        'react/jsx-no-literals': 0,
        '@typescript-eslint/no-unsafe-member-access': 0,
        '@typescript-eslint/no-unsafe-call': 0,
        '@typescript-eslint/no-explicit-any': [
          'warn',
          {
            fixToUnknown: false,
          },
        ],
      },
    },
    {
      files: ['./scripts/*', './*.config.js'],
      rules: {
        'no-console': 0,
      },
      env: {
        node: true,
      },
    },
  ],
};
