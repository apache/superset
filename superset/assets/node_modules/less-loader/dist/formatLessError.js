'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var os = require('os');

/**
 * Tries to get an excerpt of the file where the error happened.
 * Uses err.line and err.column.
 *
 * Returns an empty string if the excerpt could not be retrieved.
 *
 * @param {LessError} err
 * @returns {Array<string>}
 */
function getFileExcerptIfPossible(lessErr) {
  try {
    var excerpt = lessErr.extract.slice(0, 2);
    var column = Math.max(lessErr.column - 1, 0);

    if (typeof excerpt[0] === 'undefined') {
      excerpt.shift();
    }

    excerpt.push(`${new Array(column).join(' ')}^`);

    return excerpt;
  } catch (unexpectedErr) {
    // If anything goes wrong here, we don't want any errors to be reported to the user
    return [];
  }
}

/**
 * Beautifies the error message from Less.
 *
 * @param {LessError} lessErr
 * @param {string} lessErr.type - e.g. 'Name'
 * @param {string} lessErr.message - e.g. '.undefined-mixin is undefined'
 * @param {string} lessErr.filename - e.g. '/path/to/style.less'
 * @param {number} lessErr.index - e.g. 352
 * @param {number} lessErr.line - e.g. 31
 * @param {number} lessErr.callLine - e.g. NaN
 * @param {string} lessErr.callExtract - e.g. undefined
 * @param {number} lessErr.column - e.g. 6
 * @param {Array<string>} lessErr.extract - e.g. ['    .my-style {', '      .undefined-mixin;', '      display: block;']
 * @returns {LessError}
 */
function formatLessError(err) {
  /* eslint-disable no-param-reassign */
  var msg = err.message;

  // Instruct webpack to hide the JS stack from the console
  // Usually you're only interested in the SASS stack in this case.
  err.hideStack = true;

  err.message = [os.EOL].concat(_toConsumableArray(getFileExcerptIfPossible(err)), [msg.charAt(0).toUpperCase() + msg.slice(1), `      in ${err.filename} (line ${err.line}, column ${err.column})`]).join(os.EOL);

  return err;
} /* eslint-enable no-param-reassign */

module.exports = formatLessError;