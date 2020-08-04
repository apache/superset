if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/react-table.production.min.js')
} else {
  module.exports = require('./dist/react-table.development.js')
}
