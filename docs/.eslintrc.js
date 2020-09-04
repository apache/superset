module.exports = {
  parser: 'babel-eslint',
  rules: {
    strict: 0,
    'react/jsx-filename-extension': [2, { 'extensions': ['.js', '.jsx', '.ts', '.tsx'] }],
    'import/extensions': 'off',
    'react/jsx-props-no-spreading': 'off',
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/iframe-has-title': 'off',
    'jsx-a11y/interactive-supports-focus': 'off',
    'react-hooks/rules-of-hooks': 'off',
  },
  extends: ['airbnb', 'airbnb/hooks'],
  env: {
    browser: true,
    node: true,
    jasmine: true,
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      }
    }
  }
}
