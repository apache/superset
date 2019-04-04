const create = require('./create')

module.exports = {
  get defaults() { return create() },
  get jsWithTs() { return create({ allowJs: true }) },
  get jsWithBabel() {
    return create({ allowJs: false }, {
      transform: {
        '^.+\\.jsx?$': 'babel-jest',
      },
    })
  },
}
