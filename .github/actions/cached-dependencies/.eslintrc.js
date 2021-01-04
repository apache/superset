module.exports = {
  plugins: ['jest', '@typescript-eslint'],
  extends: ['plugin:jest/all'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 9,
    sourceType: 'module',
  },
  rules: {
    'eslint-comments/no-use': 'off',
    'import/no-namespace': 'off',
    'no-unused-vars': 'off',
    'no-console': 'off',
    'jest/prefer-expect-assertions': 'off',
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/prefer-to-have-length': 'warn',
    'jest/valid-expect': 'error',
  },
  env: {
    node: true,
    es6: true,
    'jest/globals': true,
  },
};
