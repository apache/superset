var fs = require("fs");

/**
 * Synchronously parse a PO file to JSON
 *
 * @param {String} fileName - File name
 * @param {Object} [options]
 * @return {Object|String} Translation JSON
 */

module.exports = function(fileName, options) {
  var data = fs.readFileSync(fs.realpathSync(fileName));

  return require("./parse")( data, options );
};