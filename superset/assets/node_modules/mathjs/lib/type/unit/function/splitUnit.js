'use strict';

var deepMap = require('../../../utils/collection/deepMap');

function factory (type, config, load, typed) {

  /**
   * Split a unit in an array of units whose sum is equal to the original unit.
   *
   * Syntax:
   *
   *     splitUnit(unit: Unit, parts: Array.<Unit>)
   *
   * Example:
   *
   *     math.splitUnit(new Unit(1, 'm'), ['feet', 'inch']);
   *     // [ 3 feet, 3.3700787401575 inch ]
   *
   * See also:
   *
   *     unit
   *
   * @param {Array} [parts] An array of strings or valueless units.
   * @return {Array} An array of units.
   */
  var splitUnit = typed('splitUnit', {
    'Unit, Array': function(unit, parts) {
      return unit.splitUnit(parts);
    }
  });

  return splitUnit;

}

exports.name = 'splitUnit';
exports.factory = factory;
