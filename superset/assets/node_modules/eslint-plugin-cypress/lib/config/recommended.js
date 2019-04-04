'use strict'

module.exports = {
  plugins: ['cypress'],
  rules: {
    'cypress/no-assigning-return-values': 'error',
    'cypress/no-unnecessary-waiting': 'error',
  },
}
