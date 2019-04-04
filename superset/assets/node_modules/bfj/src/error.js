'use strict'

module.exports = { create }

function create (actual, expected, line, column) {
  const error = new Error(
    /* eslint-disable prefer-template */
    'JSON error: encountered `' + actual +
    '` at line ' + line +
    ', column ' + column +
    ' where `' + expected +
    '` was expected.'
    /* eslint-enable prefer-template */
  )

  error.actual = actual
  error.expected = expected
  error.lineNumber = line
  error.columnNumber = column

  return error
}
