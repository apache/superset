var Fraction = require('fraction.js');

/**
 * Attach type information
 */
Fraction.prototype.type = 'Fraction';
Fraction.prototype.isFraction = true;

/**
 * Get a JSON representation of a Fraction containing type information
 * @returns {Object} Returns a JSON object structured as:
 *                   `{"mathjs": "Fraction", "n": 3, "d": 8}`
 */
Fraction.prototype.toJSON = function () {
  return {
    mathjs: 'Fraction',
    n: this.s * this.n,
    d: this.d
  };
};

/**
 * Instantiate a Fraction from a JSON object
 * @param {Object} json  a JSON object structured as:
 *                       `{"mathjs": "Fraction", "n": 3, "d": 8}`
 * @return {BigNumber}
 */
Fraction.fromJSON = function (json) {
  return new Fraction(json);
};


function factory (type, config, load, typed) {
  return Fraction;
}

exports.name = 'Fraction';
exports.path = 'type';
exports.factory = factory;
