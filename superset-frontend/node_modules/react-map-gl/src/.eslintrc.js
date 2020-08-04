// prettier-ignore
module.exports = {
  parser: "babel-eslint",
  plugins: ['flowtype', 'react'],
  extends: ['uber-jsx', 'uber-es2015', 'prettier', 'prettier/react', 'prettier/flowtype', 'plugin:import/errors'],
  overrides: {
    files: ['*.spec.js', 'webpack.config.js', '**/bundle/*.js'],
    rules: {
      'import/no-extraneous-dependencies': 0
    }
  },
  settings: {
    'import/core-modules': [
      'math.gl',
      'viewport-mercator-project'
    ]
  },
  rules: {
    'guard-for-in': 0,
    'no-inline-comments': 0,
    'no-invalid-this': 0,
    camelcase: 0,
    'react/forbid-prop-types': 0,
    'react/no-deprecated': 0,
    'import/no-unresolved': ['error', {ignore: ['test']}],
    'import/no-extraneous-dependencies': ['error', {devDependencies: false, peerDependencies: true}]
  },
  parserOptions: {
    ecmaVersion: 2018
  }
};
