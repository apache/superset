var Decimal = require('decimal.js/decimal.js'); // make sure to pick the es5 version

function factory (type, config, load, typed, math) {
  var BigNumber = Decimal.clone({precision: config.precision});

  /**
   * Attach type information
   */
  BigNumber.prototype.type = 'BigNumber';
  BigNumber.prototype.isBigNumber = true;

  /**
   * Get a JSON representation of a BigNumber containing
   * type information
   * @returns {Object} Returns a JSON object structured as:
   *                   `{"mathjs": "BigNumber", "value": "0.2"}`
   */
  BigNumber.prototype.toJSON = function () {
    return {
      mathjs: 'BigNumber',
      value: this.toString()
    };
  };

  /**
   * Instantiate a BigNumber from a JSON object
   * @param {Object} json  a JSON object structured as:
   *                       `{"mathjs": "BigNumber", "value": "0.2"}`
   * @return {BigNumber}
   */
  BigNumber.fromJSON = function (json) {
    return new BigNumber(json.value);
  };

  // listen for changed in the configuration, automatically apply changed precision
  math.on('config', function (curr, prev) {
    if (curr.precision !== prev.precision) {
      BigNumber.config({ precision: curr.precision });
    }
  });

  return BigNumber;
}

exports.name = 'BigNumber';
exports.path = 'type';
exports.factory = factory;
exports.math = true; // request access to the math namespace