/**
 * Minimal ESLint config for Superset-specific custom rules only
 * Used alongside OXC for a hybrid linting approach
 */
module.exports = {
  root: true,
  extends: [],
  plugins: ['theme-colors', 'icons', 'i18n-strings'],
  rules: {
    // Only enable our custom Superset rules
    'theme-colors/no-literal-colors': 'error',
    'icons/no-fa-icons-usage': 'error',
    'i18n-strings/no-template-vars': ['error', true],
  },
  // Only check files that might violate these rules
  overrides: [
    {
      files: ['**/*.tsx', '**/*.jsx'],
      rules: {
        'theme-colors/no-literal-colors': 'error',
        'icons/no-fa-icons-usage': 'error',
      },
    },
    {
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      rules: {
        'i18n-strings/no-template-vars': ['error', true],
      },
    },
  ],
  // Minimal parser config
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-react', '@babel/preset-env'],
    },
  },
};
