'use strict';

var deepMap = require('../../../utils/collection/deepMap');

function factory (type, config, load, typed) {
  /**
   * Create a user-defined unit and register it with the Unit type.
   *
   * Syntax:
   *
   *     math.createUnit({
   *       baseUnit1: {
   *         aliases: [string, ...]
   *         prefixes: object
   *       },
   *       unit2: {
   *         definition: string,
   *         aliases: [string, ...]
   *         prefixes: object,
   *         offset: number
   *       },
   *       unit3: string    // Shortcut
   *     })
   *
   *     // Another shortcut:
   *     math.createUnit(string, unit : string, [object])
   *
   * Examples: 
   *
   *     math.createUnit('foo');
   *     math.createUnit('knot', {definition: '0.514444444 m/s', aliases: ['knots', 'kt', 'kts']});
   *     math.createUnit('mph', '1 mile/hour');
   *
   * @param {string} name      The name of the new unit. Must be unique. Example: 'knot'
   * @param {string, Unit} definition      Definition of the unit in terms of existing units. For example, '0.514444444 m / s'.
   * @param {Object} options   (optional) An object containing any of the following properties:
   *     prefixes {string} "none", "short", "long", "binary_short", or "binary_long". The default is "none".
   *     aliases {Array} Array of strings. Example: ['knots', 'kt', 'kts']
   *     offset {Numeric} An offset to apply when converting from the unit. For example, the offset for celsius is 273.15. Default is 0.
   *
   * See also:
   *
   *     unit
   *
   * @return {Unit} The new unit
   */
  var createUnit = typed('createUnit', {

    // General function signature. First parameter is an object where each property is the definition of a new unit. The object keys are the unit names and the values are the definitions. The values can be objects, strings, or Units. If a property is an empty object or an empty string, a new base unit is created. The second parameter is the options.
    'Object, Object': function(obj, options) {
      return type.Unit.createUnit(obj, options);
    },

    // Same as above but without the options.
    'Object': function(obj) {
      return type.Unit.createUnit(obj, {});
    },

    // Shortcut method for creating one unit.
    'string, Unit | string | Object, Object': function (name, def, options) {
      var obj = {};
      obj[name] = def;
      return type.Unit.createUnit(obj, options);
    },

    // Same as above but without the options.
    'string, Unit | string | Object': function (name, def) {
      var obj = {};
      obj[name] = def;
      return type.Unit.createUnit(obj, {});
    },

    // Without a definition, creates a base unit.
    'string': function (name) {
      var obj = {};
      obj[name] = {};
      return type.Unit.createUnit(obj, {});
    },
  });

  return createUnit;
}

exports.name = 'createUnit';
exports.factory = factory;
