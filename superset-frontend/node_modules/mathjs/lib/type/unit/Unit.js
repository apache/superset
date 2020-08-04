'use strict';

var endsWith = require('../../utils/string').endsWith;
var clone = require('../../utils/object').clone;
var constants = require('../../utils/bignumber/constants');

function factory (type, config, load, typed, math) {
  var add       = load(require('../../function/arithmetic/addScalar'));
  var subtract  = load(require('../../function/arithmetic/subtract'));
  var multiply  = load(require('../../function/arithmetic/multiplyScalar'));
  var divide    = load(require('../../function/arithmetic/divideScalar'));
  var pow       = load(require('../../function/arithmetic/pow'));
  var abs       = load(require('../../function/arithmetic/abs'));
  var fix       = load(require('../../function/arithmetic/fix'));
  var round     = load(require('../../function/arithmetic/round'));
  var equal     = load(require('../../function/relational/equal'));
  var isNumeric = load(require('../../function/utils/isNumeric'));
  var format    = load(require('../../function/string/format'));
  var getTypeOf = load(require('../../function/utils/typeof'));
  var toNumber  = load(require('../../type/number'));
  var Complex   = load(require('../../type/complex/Complex'));

  /**
   * A unit can be constructed in the following ways:
   *     var a = new Unit(value, name);
   *     var b = new Unit(null, name);
   *     var c = Unit.parse(str);
   *
   * Example usage:
   *     var a = new Unit(5, 'cm');               // 50 mm
   *     var b = Unit.parse('23 kg');             // 23 kg
   *     var c = math.in(a, new Unit(null, 'm');  // 0.05 m
   *     var d = new Unit(9.81, "m/s^2");         // 9.81 m/s^2
   *
   * @class Unit
   * @constructor Unit
   * @param {number | BigNumber | Fraction | Complex | boolean} [value]  A value like 5.2
   * @param {string} [name]   A unit name like "cm" or "inch", or a derived unit of the form: "u1[^ex1] [u2[^ex2] ...] [/ u3[^ex3] [u4[^ex4]]]", such as "kg m^2/s^2", where each unit appearing after the forward slash is taken to be in the denominator. "kg m^2 s^-2" is a synonym and is also acceptable. Any of the units can include a prefix.
   */
  function Unit(value, name) {
    if (!(this instanceof Unit)) {
      throw new Error('Constructor must be called with the new operator');
    }

    if (!(value == undefined || isNumeric(value) || type.isComplex(value))) {
      throw new TypeError('First parameter in Unit constructor must be number, BigNumber, Fraction, Complex, or undefined');
    }
    if (name != undefined && (typeof name !== 'string' || name === '')) {
      throw new TypeError('Second parameter in Unit constructor must be a string');
    }

    if (name != undefined) {
      var u = Unit.parse(name);
      this.units = u.units;
      this.dimensions = u.dimensions;
    }
    else {
      this.units = [
        {
          unit: UNIT_NONE,
          prefix: PREFIXES.NONE,  // link to a list with supported prefixes
          power: 0
        }
      ];
      this.dimensions = []; 
      for(var i=0; i<BASE_DIMENSIONS.length; i++) {
        this.dimensions[i] = 0;
      }
    }

    this.value = (value != undefined) ? this._normalize(value) : null;

    this.fixPrefix = false; // if true, function format will not search for the
                            // best prefix but leave it as initially provided.
                            // fixPrefix is set true by the method Unit.to

    // The justification behind this is that if the constructor is explicitly called,
    // the caller wishes the units to be returned exactly as he supplied.
    this.isUnitListSimplified = true;

  }

  /**
   * Attach type information
   */
  Unit.prototype.type = 'Unit';
  Unit.prototype.isUnit = true;

  // private variables and functions for the Unit parser
  var text, index, c;

  function skipWhitespace() {
    while (c == ' ' || c == '\t') {
      next();
    }
  }

  function isDigitDot(c) {
    return ((c >= '0' && c <= '9') || c == '.');
  }

  function isDigit(c) {
    return ((c >= '0' && c <= '9'));
  }

  function next() {
    index++;
    c = text.charAt(index);
  }

  function revert(oldIndex) {
    index = oldIndex;
    c = text.charAt(index);
  }

  function parseNumber() {
    var number = '';
    var oldIndex;
    oldIndex = index;

    if (c == '+') {
      next();
    }
    else if (c == '-') {
      number += c;
      next();
    }

    if (!isDigitDot(c)) {
      // a + or - must be followed by a digit
      revert(oldIndex);
      return null;
    }

    // get number, can have a single dot
    if (c == '.') {
      number += c;
      next();
      if (!isDigit(c)) {
        // this is no legal number, it is just a dot
        revert(oldIndex);
        return null;
      }
    }
    else {
      while (isDigit(c)) {
        number += c;
        next();
      }
      if (c == '.') {
        number += c;
        next();
      }
    }
    while (isDigit(c)) {
      number += c;
      next();
    }

    // check for exponential notation like "2.3e-4" or "1.23e50"
    if (c == 'E' || c == 'e') {
      // The grammar branches here. This could either be part of an exponent or the start of a unit that begins with the letter e, such as "4exabytes"

      var tentativeNumber = '';
      var tentativeIndex = index;

      tentativeNumber += c;
      next();

      if (c == '+' || c == '-') {
        tentativeNumber += c;
        next();
      }

      // Scientific notation MUST be followed by an exponent (otherwise we assume it is not scientific notation)
      if (!isDigit(c)) {
        // The e or E must belong to something else, so return the number without the e or E.
        revert(tentativeIndex);
        return number;
      }
      
      // We can now safely say that this is scientific notation.
      number = number + tentativeNumber;
      while (isDigit(c)) {
        number += c;
        next();
      }
    }

    return number;
  }

  function parseUnit() {
    var unitName = '';

    // Alphanumeric characters only; matches [a-zA-Z0-9]
    var code = text.charCodeAt(index);
    while ( (code >= 48 && code <= 57) ||
            (code >= 65 && code <= 90) ||
            (code >= 97 && code <= 122)) {
      unitName += c;
      next();
      code = text.charCodeAt(index);
    }

    // Must begin with [a-zA-Z]
    code = unitName.charCodeAt(0);
    if ((code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122)) {
        return unitName || null;
    } 
    else {
      return null;
    }
  }

  function parseCharacter(toFind) {
    if (c === toFind) {
      next();
      return toFind;
    }
    else {
      return null;
    }
  }

  /**
   * Parse a string into a unit. The value of the unit is parsed as number,
   * BigNumber, or Fraction depending on the math.js config setting `number`.
   *
   * Throws an exception if the provided string does not contain a valid unit or
   * cannot be parsed.
   * @memberof Unit
   * @param {string} str        A string like "5.2 inch", "4e2 cm/s^2"
   * @return {Unit} unit
   */
  Unit.parse = function (str, options) {
    options = options || {};
    text = str;
    index = -1;
    c = '';

    if (typeof text !== 'string') {
      throw new TypeError('Invalid argument in Unit.parse, string expected');
    }

    var unit = new Unit();
    unit.units = [];

    // A unit should follow this pattern:
    // [number]unit[^number] [unit[^number]]...[/unit[^number] [unit[^number]]]

    // Rules:
    // number is any floating point number.
    // unit is any alphanumeric string beginning with an alpha. Units with names like e3 should be avoided because they look like the exponent of a floating point number!
    // The string may optionally begin with a number.
    // Each unit may optionally be followed by ^number.
    // Whitespace or a forward slash is recommended between consecutive units, although the following technically is parseable:
    //   2m^2kg/s^2
    // it is not good form. If a unit starts with e, then it could be confused as a floating point number:
    //   4erg

    next();
    skipWhitespace();
    // Optional number at the start of the string
    var valueStr = parseNumber();
    var value = null;
    if(valueStr) {
      if (config.number === 'BigNumber') {
        value = new type.BigNumber(valueStr);
      }
      else if (config.number === 'Fraction') {
        value = new type.Fraction(valueStr);
      }
      else { // number
        value = parseFloat(valueStr);
      }
    }
    skipWhitespace();    // Whitespace is not required here

    // Next, we read any number of unit[^number]
    var powerMultiplierCurrent = 1;
    var expectingUnit = false;

    // Stack to keep track of powerMultipliers applied to each parentheses group
    var powerMultiplierStack = [];

    // Running product of all elements in powerMultiplierStack
    var powerMultiplierStackProduct = 1;

    while (true) {
      skipWhitespace();

      // Check for and consume opening parentheses, pushing powerMultiplierCurrent to the stack
      // A '(' will always appear directly before a unit.
      while (c === '(') {
        powerMultiplierStack.push(powerMultiplierCurrent);
        powerMultiplierStackProduct *= powerMultiplierCurrent;
        powerMultiplierCurrent = 1;
        next();
        skipWhitespace();
      }

      // Is there something here?
      if(c) {
        var oldC = c;
        var uStr = parseUnit();
        if(uStr == null) {
          throw new SyntaxError('Unexpected "' + oldC + '" in "' + text + '" at index ' + index.toString());
        }
      }
      else {
        // End of input.
        break;
      }

      // Verify the unit exists and get the prefix (if any)
      var res = _findUnit(uStr);
      if(res == null) {
        // Unit not found.
        throw new SyntaxError('Unit "' + uStr + '" not found.');
      }

      var power = powerMultiplierCurrent * powerMultiplierStackProduct;
      // Is there a "^ number"?
      skipWhitespace();
      if (parseCharacter('^')) {
        skipWhitespace();
        var p = parseNumber();
        if(p == null) {
          // No valid number found for the power!
          throw new SyntaxError('In "' + str + '", "^" must be followed by a floating-point number');
        }
        power *= p;
      }

      // Add the unit to the list
      unit.units.push( {
        unit: res.unit,
        prefix: res.prefix,
        power: power
      });
      for(var i=0; i<BASE_DIMENSIONS.length; i++) {
        unit.dimensions[i] += (res.unit.dimensions[i] || 0) * power;
      }

      // Check for and consume closing parentheses, popping from the stack.
      // A ')' will always follow a unit.
      skipWhitespace();
      while (c === ')') {
        if(powerMultiplierStack.length === 0) {
          throw new SyntaxError('Unmatched ")" in "' + text + '" at index ' + index.toString());
        }
        powerMultiplierStackProduct /= powerMultiplierStack.pop();
        next();
        skipWhitespace();
      }

      // "*" and "/" should mean we are expecting something to come next.
      // Is there a forward slash? If so, negate powerMultiplierCurrent. The next unit or paren group is in the denominator.
      expectingUnit = false;

      if (parseCharacter('*')) {
        // explicit multiplication
        powerMultiplierCurrent = 1;
        expectingUnit = true;
      }
      else if (parseCharacter('/')) {
        // division
        powerMultiplierCurrent = -1;
        expectingUnit = true;
      }
      else {
        // implicit multiplication
        powerMultiplierCurrent = 1;
      }

      // Replace the unit into the auto unit system
      if(res.unit.base) {
        var baseDim = res.unit.base.key;
        UNIT_SYSTEMS.auto[baseDim] = {
          unit: res.unit,
          prefix: res.prefix
        };
      }
    }
    
    // Has the string been entirely consumed?
    skipWhitespace();
    if(c) {
      throw new SyntaxError('Could not parse: "' + str + '"');
    }

    // Is there a trailing slash?
    if(expectingUnit) {
      throw new SyntaxError('Trailing characters: "' + str + '"');
    }

    // Is the parentheses stack empty?
    if(powerMultiplierStack.length !== 0) {
      throw new SyntaxError('Unmatched "(" in "' + text + '"');
    }

    // Are there any units at all?
    if(unit.units.length == 0 && !options.allowNoUnits) {
      throw new SyntaxError('"' + str + '" contains no units');
    }

    unit.value = (value != undefined) ? unit._normalize(value) : null;
    return unit;
  };

  /**
   * create a copy of this unit
   * @memberof Unit
   * @return {Unit} Returns a cloned version of the unit
   */
  Unit.prototype.clone = function () {
    var unit = new Unit();

    unit.fixPrefix = this.fixPrefix;
    unit.isUnitListSimplified = this.isUnitListSimplified;

    unit.value = clone(this.value);
    unit.dimensions = this.dimensions.slice(0);
    unit.units = [];
    for(var i = 0; i < this.units.length; i++) {
      unit.units[i] = { };
      for (var p in this.units[i]) {
        if (this.units[i].hasOwnProperty(p)) {
          unit.units[i][p] = this.units[i][p];
        }
      }
    }

    return unit;
  };

  /**
   * Return whether the unit is derived (such as m/s, or cm^2, but not N)
   * @memberof Unit
   * @return {boolean} True if the unit is derived
   */
  Unit.prototype._isDerived = function() {
    if(this.units.length === 0) {
      return false;
    }
    return this.units.length > 1 || Math.abs(this.units[0].power - 1.0) > 1e-15;
  };

  /**
   * Normalize a value, based on its currently set unit(s)
   * @memberof Unit
   * @param {number | BigNumber | Fraction | boolean} value
   * @return {number | BigNumber | Fraction | boolean} normalized value
   * @private
   */
  Unit.prototype._normalize = function (value) {
    var unitValue, unitOffset, unitPower, unitPrefixValue;
    var convert;

    if (value == null || this.units.length === 0) {
      return value;
    }
    else if (this._isDerived()) {
      // This is a derived unit, so do not apply offsets.
      // For example, with J kg^-1 degC^-1 you would NOT want to apply the offset.
      var res = value;
      convert = Unit._getNumberConverter(getTypeOf(value)); // convert to Fraction or BigNumber if needed

      for(var i=0; i < this.units.length; i++) {
        unitValue       = convert(this.units[i].unit.value);
        unitPrefixValue = convert(this.units[i].prefix.value);
        unitPower       = convert(this.units[i].power);
        res = multiply(res, pow(multiply(unitValue, unitPrefixValue), unitPower));
      }

      return res;
    }
    else {
      // This is a single unit of power 1, like kg or degC
      convert = Unit._getNumberConverter(getTypeOf(value)); // convert to Fraction or BigNumber if needed

      unitValue       = convert(this.units[0].unit.value);
      unitOffset      = convert(this.units[0].unit.offset);
      unitPrefixValue = convert(this.units[0].prefix.value);

      return multiply(add(value, unitOffset), multiply(unitValue, unitPrefixValue));
    }
  };

  /**
   * Denormalize a value, based on its currently set unit(s)
   * @memberof Unit
   * @param {number} value
   * @param {number} [prefixValue]    Optional prefix value to be used (ignored if this is a derived unit)
   * @return {number} denormalized value
   * @private
   */
  Unit.prototype._denormalize = function (value, prefixValue) {
    var unitValue, unitOffset, unitPower, unitPrefixValue;
    var convert;

    if (value == null || this.units.length === 0) {
      return value;
    }
    else if (this._isDerived()) {
      // This is a derived unit, so do not apply offsets.
      // For example, with J kg^-1 degC^-1 you would NOT want to apply the offset.
      // Also, prefixValue is ignored--but we will still use the prefix value stored in each unit, since kg is usually preferable to g unless the user decides otherwise.
      var res = value;
      convert = Unit._getNumberConverter(getTypeOf(value)); // convert to Fraction or BigNumber if needed

      for (var i = 0; i < this.units.length; i++) {
        unitValue       = convert(this.units[i].unit.value);
        unitPrefixValue = convert(this.units[i].prefix.value);
        unitPower       = convert(this.units[i].power);
        res = divide(res, pow(multiply(unitValue, unitPrefixValue), unitPower));
      }

      return res;
    }
    else {
      // This is a single unit of power 1, like kg or degC
      convert = Unit._getNumberConverter(getTypeOf(value)); // convert to Fraction or BigNumber if needed

      unitValue       = convert(this.units[0].unit.value);
      unitPrefixValue = convert(this.units[0].prefix.value);
      unitOffset      = convert(this.units[0].unit.offset);

      if (prefixValue == undefined) {
        return subtract(divide(divide(value, unitValue), unitPrefixValue), unitOffset);
      }
      else {
        return subtract(divide(divide(value, unitValue), prefixValue), unitOffset);
      }
    }
  };

  /**
   * Find a unit from a string
   * @memberof Unit
   * @param {string} str              A string like 'cm' or 'inch'
   * @returns {Object | null} result  When found, an object with fields unit and
   *                                  prefix is returned. Else, null is returned.
   * @private
   */
  function _findUnit(str) {
  
    // First, match units names exactly. For example, a user could define 'mm' as 10^-4 m, which is silly, but then we would want 'mm' to match the user-defined unit.
    if(UNITS.hasOwnProperty(str)) {
      var unit = UNITS[str];
      var prefix = unit.prefixes[''];
      return {
        unit: unit,
        prefix: prefix
      }
    }

    for (var name in UNITS) {
      if (UNITS.hasOwnProperty(name)) {
        if (endsWith(str, name)) {
          var unit = UNITS[name];
          var prefixLen = (str.length - name.length);
          var prefixName = str.substring(0, prefixLen);
          var prefix = unit.prefixes.hasOwnProperty(prefixName)
              ? unit.prefixes[prefixName]
              : undefined;
          if (prefix !== undefined) {
            // store unit, prefix, and value
            return {
              unit: unit,
              prefix: prefix
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Test if the given expression is a unit.
   * The unit can have a prefix but cannot have a value.
   * @memberof Unit
   * @param {string} name   A string to be tested whether it is a value less unit.
   *                        The unit can have prefix, like "cm"
   * @return {boolean}      true if the given string is a unit
   */
  Unit.isValuelessUnit = function (name) {
    return (_findUnit(name) != null);
  };

  /**
   * check if this unit has given base unit
   * If this unit is a derived unit, this will ALWAYS return false, since by definition base units are not derived.
   * @memberof Unit
   * @param {BASE_UNITS | string | undefined} base
   */
  Unit.prototype.hasBase = function (base) {

    if(typeof(base) === "string") {
      base = BASE_UNITS[base];
    }

    if(!base)
      return false;


    // All dimensions must be the same
    for(var i=0; i<BASE_DIMENSIONS.length; i++) {
      if (Math.abs((this.dimensions[i] || 0) - (base.dimensions[i] || 0)) > 1e-12) {
        return false;
      }
    }
    return true;

  };

  /**
   * Check if this unit has a base or bases equal to another base or bases
   * For derived units, the exponent on each base also must match
   * @memberof Unit
   * @param {Unit} other
   * @return {boolean} true if equal base
   */
  Unit.prototype.equalBase = function (other) {
    // All dimensions must be the same
    for(var i=0; i<BASE_DIMENSIONS.length; i++) {
      if (Math.abs((this.dimensions[i] || 0) - (other.dimensions[i] || 0)) > 1e-12) {
        return false;
      }
    }
    return true;
  };

  /**
   * Check if this unit equals another unit
   * @memberof Unit
   * @param {Unit} other
   * @return {boolean} true if both units are equal
   */
  Unit.prototype.equals = function (other) {
    return (this.equalBase(other) && equal(this.value, other.value));
  };

  /**
   * Multiply this unit with another one
   * @memberof Unit
   * @param {Unit} other
   * @return {Unit} product of this unit and the other unit
   */
  Unit.prototype.multiply = function (other) {
    var res = this.clone();
    
    for(var i = 0; i<BASE_DIMENSIONS.length; i++) {
      // Dimensions arrays may be of different lengths. Default to 0.
      res.dimensions[i] = (this.dimensions[i] || 0) + (other.dimensions[i] || 0);
    }

    // Append other's units list onto res (simplify later in Unit.prototype.format)
    for(var i=0; i<other.units.length; i++) {
      // Make a deep copy
      var inverted = {};
      for(var key in other.units[i]) {
        inverted[key] = other.units[i][key];
      }
      res.units.push(inverted);
    }

    // If at least one operand has a value, then the result should also have a value
    if(this.value != null || other.value != null) {
      var valThis = this.value == null ? this._normalize(1) : this.value;
      var valOther = other.value == null ? other._normalize(1) : other.value;
      res.value = multiply(valThis, valOther);
    }
    else {
      res.value = null;
    }

    // Trigger simplification of the unit list at some future time
    res.isUnitListSimplified = false;

    return getNumericIfUnitless(res);
  };

  /**
   * Divide this unit by another one
   * @memberof Unit
   * @param {Unit} other
   * @return {Unit} result of dividing this unit by the other unit
   */
  Unit.prototype.divide = function (other) {
    var res = this.clone();
    
    for(var i=0; i<BASE_DIMENSIONS.length; i++) {
      // Dimensions arrays may be of different lengths. Default to 0.
      res.dimensions[i] = (this.dimensions[i] || 0) - (other.dimensions[i] || 0);
    }

    // Invert and append other's units list onto res (simplify later in Unit.prototype.format)
    for(var i=0; i<other.units.length; i++) {
      // Make a deep copy
      var inverted = {};
      for(var key in other.units[i]) {
        inverted[key] = other.units[i][key];
      }
      inverted.power = -inverted.power;
      res.units.push(inverted);
    }

    // If at least one operand has a value, the result should have a value
    if (this.value != null || other.value != null) {
      var valThis = this.value == null ? this._normalize(1) : this.value;
      var valOther = other.value == null ? other._normalize(1) : other.value;
      res.value = divide(valThis, valOther);
    }
    else {
      res.value = null;
    }

    // Trigger simplification of the unit list at some future time
    res.isUnitListSimplified = false;

    return getNumericIfUnitless(res);
  };

  /**
   * Calculate the power of a unit
   * @memberof Unit
   * @param {number | Fraction | BigNumber} p
   * @returns {Unit}      The result: this^p
   */
  Unit.prototype.pow = function (p) {
    var res = this.clone();
    
    for(var i=0; i<BASE_DIMENSIONS.length; i++) {
      // Dimensions arrays may be of different lengths. Default to 0.
      res.dimensions[i] = (this.dimensions[i] || 0) * p;
    }

    // Adjust the power of each unit in the list
    for(var i=0; i<res.units.length; i++) {
      res.units[i].power *= p;
    }

    if(res.value != null) {
      res.value = pow(res.value, p);

      // only allow numeric output, we don't want to return a Complex number
      //if (!isNumeric(res.value)) {
      //  res.value = NaN;
      //}
      // Update: Complex supported now
    }
    else {
      res.value = null;
    }

    // Trigger lazy evaluation of the unit list
    res.isUnitListSimplified = false;

    return getNumericIfUnitless(res);
  };

  /**
   * Return the numeric value of this unit if it is dimensionless, has a value, and config.predictable == false; or the original unit otherwise
   * @param {Unit} unit
   * @returns {number | Fraction | BigNumber | Unit}  The numeric value of the unit if conditions are met, or the original unit otherwise
   */
  var getNumericIfUnitless = function(unit) {
    if(unit.equalBase(BASE_UNITS.NONE) && unit.value !== null && !config.predictable) {
      return unit.value;
    }
    else {
      return unit;
    }
  }
    

  /**
   * Calculate the absolute value of a unit
   * @memberof Unit
   * @param {number | Fraction | BigNumber} x
   * @returns {Unit}      The result: |x|, absolute value of x
   */
  Unit.prototype.abs = function () {
    // This gives correct, but unexpected, results for units with an offset.
    // For example, abs(-283.15 degC) = -263.15 degC !!!
    var ret = this.clone();
    ret.value = abs(ret.value);

    for(var i in ret.units) {
      if(ret.units[i].unit.name === 'VA' || ret.units[i].unit.name === 'VAR') {
        ret.units[i].unit = UNITS["W"];
      }
    }

    return ret;
  };

  /**
   * Convert the unit to a specific unit name.
   * @memberof Unit
   * @param {string | Unit} valuelessUnit   A unit without value. Can have prefix, like "cm"
   * @returns {Unit} Returns a clone of the unit with a fixed prefix and unit.
   */
  Unit.prototype.to = function (valuelessUnit) {
    var other;
    var value = this.value == null ? this._normalize(1) : this.value;
    if (typeof valuelessUnit === 'string') {
      //other = new Unit(null, valuelessUnit);
      other = Unit.parse(valuelessUnit);
      if (!this.equalBase(other)) {
        throw new Error('Units do not match');
      }
      if (other.value !== null) {
        throw new Error('Cannot convert to a unit with a value');
      }

      other.value = clone(value);
      other.fixPrefix = true;
      other.isUnitListSimplified = true;
      return other;
    }
    else if (type.isUnit(valuelessUnit)) {
      if (!this.equalBase(valuelessUnit)) {
        throw new Error('Units do not match');
      }
      if (valuelessUnit.value !== null) {
        throw new Error('Cannot convert to a unit with a value');
      }
      other = valuelessUnit.clone();
      other.value = clone(value);
      other.fixPrefix = true;
      other.isUnitListSimplified = true;
      return other;
    }
    else {
      throw new Error('String or Unit expected as parameter');
    }
  };

  /**
   * Return the value of the unit when represented with given valueless unit
   * @memberof Unit
   * @param {string | Unit} valuelessUnit    For example 'cm' or 'inch'
   * @return {number} Returns the unit value as number.
   */
  // TODO: deprecate Unit.toNumber? It's always better to use toNumeric
  Unit.prototype.toNumber = function (valuelessUnit) {
    return toNumber(this.toNumeric(valuelessUnit));
  };

  /**
   * Return the value of the unit in the original numeric type
   * @memberof Unit
   * @param {string | Unit} valuelessUnit    For example 'cm' or 'inch'
   * @return {number | BigNumber | Fraction} Returns the unit value
   */
  Unit.prototype.toNumeric = function (valuelessUnit) {
    var other = this;
    if(valuelessUnit) {
      // Allow getting the numeric value without converting to a different unit
      other = this.to(valuelessUnit);
    }

    other.simplifyUnitListLazy();

    if(other._isDerived()) {
      return other._denormalize(other.value);
    }
    else {
      return other._denormalize(other.value, other.units[0].prefix.value);
    }
  };

  /**
   * Get a string representation of the unit.
   * @memberof Unit
   * @return {string}
   */
  Unit.prototype.toString = function () {
    return this.format();
  };

  /**
   * Get a JSON representation of the unit
   * @memberof Unit
   * @returns {Object} Returns a JSON object structured as:
   *                   `{"mathjs": "Unit", "value": 2, "unit": "cm", "fixPrefix": false}`
   */
  Unit.prototype.toJSON = function () {
    return {
      mathjs: 'Unit',
      value: this._denormalize(this.value),
      unit: this.formatUnits(),
      fixPrefix: this.fixPrefix
    };
  };

  /**
   * Instantiate a Unit from a JSON object
   * @memberof Unit
   * @param {Object} json  A JSON object structured as:
   *                       `{"mathjs": "Unit", "value": 2, "unit": "cm", "fixPrefix": false}`
   * @return {Unit}
   */
  Unit.fromJSON = function (json) {
    var unit = new Unit(json.value, json.unit);
    unit.fixPrefix = json.fixPrefix || false;
    return unit;
  };

  /**
   * Returns the string representation of the unit.
   * @memberof Unit
   * @return {string}
   */
  Unit.prototype.valueOf = Unit.prototype.toString;

  /**
   * Attempt to simplify the list of units for this unit according to the dimensions array and the current unit system. After the call, this Unit will contain a list of the "best" units for formatting.
   * Intended to be evaluated lazily. You must set isUnitListSimplified = false before the call! After the call, isUnitListSimplified will be set to true.
   */
  Unit.prototype.simplifyUnitListLazy = function() {

    if (this.isUnitListSimplified || this.value == null) {
      return;
    }

    var proposedUnitList = [];

    // Search for a matching base
    var matchingBase;
    for(var key in currentUnitSystem) {
      if(this.hasBase(BASE_UNITS[key])) {
        matchingBase = key;
        break;
      }
    }

    if(matchingBase === 'NONE')
    {
      this.units = [];
    }
    else {
      var matchingUnit;
      if(matchingBase) {
        // Does the unit system have a matching unit?
        if(currentUnitSystem.hasOwnProperty(matchingBase)) {
          matchingUnit = currentUnitSystem[matchingBase];
        }
      }
      var value;
      var str;
      if(matchingUnit) {
        this.units = [{
          unit: matchingUnit.unit,
          prefix: matchingUnit.prefix,
          power: 1.0
        }];
      }
      else {
        // Multiple units or units with powers are formatted like this:
        // 5 (kg m^2) / (s^3 mol)
        // Build an representation from the base units of the current unit system
        var missingBaseDim = false;
        for(var i=0; i<BASE_DIMENSIONS.length; i++) {
          var baseDim = BASE_DIMENSIONS[i];
          if(Math.abs(this.dimensions[i] || 0) > 1e-12) {
            if(currentUnitSystem.hasOwnProperty(baseDim)) {
              proposedUnitList.push({
                unit: currentUnitSystem[baseDim].unit,
                prefix: currentUnitSystem[baseDim].prefix,
                power: this.dimensions[i] || 0
              });
            }
            else {
              missingBaseDim = true;
            }
          }
        }

        // Is the proposed unit list "simpler" than the existing one?
        if(proposedUnitList.length < this.units.length && !missingBaseDim) {
          // Replace this unit list with the proposed list
          this.units = proposedUnitList;
        }
      }
    }

    this.isUnitListSimplified = true;
  };

  Unit.prototype.toSI = function() {

    var ret = this.clone();

    var proposedUnitList = [];

    // Multiple units or units with powers are formatted like this:
    // 5 (kg m^2) / (s^3 mol)
    // Build an representation from the base units of the SI unit system
    var missingBaseDim = false;
    for(var i=0; i<BASE_DIMENSIONS.length; i++) {
      var baseDim = BASE_DIMENSIONS[i];
      if(Math.abs(ret.dimensions[i] || 0) > 1e-12) {
        if(UNIT_SYSTEMS["si"].hasOwnProperty(baseDim)) {
          proposedUnitList.push({
            unit: UNIT_SYSTEMS["si"][baseDim].unit,
            prefix: UNIT_SYSTEMS["si"][baseDim].prefix,
            power: ret.dimensions[i] || 0
          });
        }
        else {
          throw new Error("Cannot express custom unit " + baseDim + " in SI units");
        }
      }
    }

    // Replace this unit list with the proposed list
    ret.units = proposedUnitList;

    ret.isUnitListSimplified = true;

    return ret;
  }

  /**
   * Get a string representation of the units of this Unit, without the value.
   * @memberof Unit
   * @return {string}
   */
  Unit.prototype.formatUnits = function () {

    // Lazy evaluation of the unit list
    this.simplifyUnitListLazy();

    var strNum = "";
    var strDen = "";
    var nNum = 0;
    var nDen = 0;

    for(var i=0; i<this.units.length; i++) {
      if(this.units[i].power > 0) {
        nNum++;
        strNum += " " + this.units[i].prefix.name + this.units[i].unit.name;
        if(Math.abs(this.units[i].power - 1.0) > 1e-15) {
          strNum += "^" + this.units[i].power;
        }
      }
      else if(this.units[i].power < 0) {
        nDen++;
      }
    }

    if(nDen > 0) {
      for(var i=0; i<this.units.length; i++) {
        if(this.units[i].power < 0) {
          if(nNum > 0) {
            strDen += " " + this.units[i].prefix.name + this.units[i].unit.name;
            if(Math.abs(this.units[i].power + 1.0) > 1e-15) {
              strDen += "^" + (-this.units[i].power);
            }
          }
          else {
            strDen += " " + this.units[i].prefix.name + this.units[i].unit.name;
            strDen += "^" + (this.units[i].power);
          }
        }
      }
    }
    // Remove leading " "
    strNum = strNum.substr(1);
    strDen = strDen.substr(1);

    // Add parans for better copy/paste back into the eval, for example, or for better pretty print formatting
    if(nNum > 1 && nDen > 0) {
      strNum = "(" + strNum + ")";
    }
    if(nDen > 1 && nNum > 0) {
      strDen = "(" + strDen + ")";
    }

    var str = strNum;
    if(nNum > 0 && nDen > 0) {
      str += " / ";
    }
    str += strDen;

    return str;
  };

  /**
   * Get a string representation of the Unit, with optional formatting options.
   * @memberof Unit
   * @param {Object | number | Function} [options]  Formatting options. See
   *                                                lib/utils/number:format for a
   *                                                description of the available
   *                                                options.
   * @return {string}
   */
  Unit.prototype.format = function (options) {

    // Simplfy the unit list, if necessary
    this.simplifyUnitListLazy();

    // Apply some custom logic for handling VA and VAR. The goal is to express the value of the unit as a real value, if possible. Otherwise, use a real-valued unit instead of a complex-valued one.
    var isImaginary = false;
    var isReal = true;
    if(typeof(this.value) !== 'undefined' && this.value !== null && type.isComplex(this.value)) {
      // TODO: Make this better, for example, use relative magnitude of re and im rather than absolute
      isImaginary = Math.abs(this.value.re) < 1e-14;
      isReal = Math.abs(this.value.im) < 1e-14;
    }
    
    for(var i in this.units) {
      if(this.units[i].unit) {
        if(this.units[i].unit.name === 'VA' && isImaginary) {
          this.units[i].unit = UNITS["VAR"];
        }
        else if(this.units[i].unit.name === 'VAR' && !isImaginary) {
          this.units[i].unit = UNITS["VA"];
        }
      }
    }


    // Now apply the best prefix
    // Units must have only one unit and not have the fixPrefix flag set
    if (this.units.length === 1 && !this.fixPrefix) {
      // Units must have integer powers, otherwise the prefix will change the
      // outputted value by not-an-integer-power-of-ten
      if (Math.abs(this.units[0].power - Math.round(this.units[0].power)) < 1e-14) {
        // Apply the best prefix
        this.units[0].prefix = this._bestPrefix();
      }
    }


    var value = this._denormalize(this.value);
    var str = (this.value !== null) ? format(value, options || {}) : '';
    var unitStr = this.formatUnits();
    if(this.value && type.isComplex(this.value)) {
      str = "(" + str + ")";    // Surround complex values with ( ) to enable better parsing 
    }
    if(unitStr.length > 0 && str.length > 0) {
      str += " ";
    }
    str += unitStr;

    return str;
  };

  /**
   * Calculate the best prefix using current value.
   * @memberof Unit
   * @returns {Object} prefix
   * @private
   */
  Unit.prototype._bestPrefix = function () {
    if (this.units.length !== 1) {
      throw new Error("Can only compute the best prefix for single units with integer powers, like kg, s^2, N^-1, and so forth!");
    }
    if (Math.abs(this.units[0].power - Math.round(this.units[0].power)) >= 1e-14) {
      throw new Error("Can only compute the best prefix for single units with integer powers, like kg, s^2, N^-1, and so forth!");
    }

    // find the best prefix value (resulting in the value of which
    // the absolute value of the log10 is closest to zero,
    // though with a little offset of 1.2 for nicer values: you get a
    // sequence 1mm 100mm 500mm 0.6m 1m 10m 100m 500m 0.6km 1km ...

    // Note: the units value can be any numeric type, but to find the best
    // prefix it's enough to work with limited precision of a regular number
    // Update: using mathjs abs since we also allow complex numbers
    var absValue = abs(this.value);
    var absUnitValue = abs(this.units[0].unit.value);
    var bestPrefix = this.units[0].prefix;
    if (absValue === 0) {
      return bestPrefix;
    }
    var power = this.units[0].power;
    var bestDiff = Math.log(absValue / Math.pow(bestPrefix.value * absUnitValue, power)) / Math.LN10 - 1.2;
    if(bestDiff > -2.200001 && bestDiff < 1.800001) return bestPrefix;    // Allow the original prefix
    bestDiff = Math.abs(bestDiff);
    var prefixes = this.units[0].unit.prefixes;
    for (var p in prefixes) {
      if (prefixes.hasOwnProperty(p)) {
        var prefix = prefixes[p];
        if (prefix.scientific) {

          var diff = Math.abs(
              Math.log(absValue / Math.pow(prefix.value * absUnitValue, power)) / Math.LN10 - 1.2);

          if (diff < bestDiff
              || (diff === bestDiff && prefix.name.length < bestPrefix.name.length)) {
                // choose the prefix with the smallest diff, or if equal, choose the one
                // with the shortest name (can happen with SHORTLONG for example)
                bestPrefix = prefix;
                bestDiff = diff;
          }
        }
      }
    }

    return bestPrefix;
  };

  /**
   * Returns an array of units whose sum is equal to this unit
   * @memberof Unit
   * @param {Array} [parts] An array of strings or valueless units. 
   *
   *   Example:
   *
   *   var u = new Unit(1, 'm');
   *   u.splitUnit(['feet', 'inch']);
   *     [ 3 feet, 3.3700787401575 inch ]
   *
   * @return {Array} An array of units.
   */
  Unit.prototype.splitUnit = function(parts) {

    var x = this.clone();
    var ret = [];
    for(var i=0; i<parts.length; i++) {
      // Convert x to the requested unit
      x = x.to(parts[i]);
      if(i==parts.length-1) break;

      // Get the numeric value of this unit
      var xNumeric = x.toNumeric();

      // Check to see if xNumeric is nearly equal to an integer,
      // since fix can incorrectly round down if there is round-off error
      var xRounded = round(xNumeric);
      var xFixed;
      var isNearlyEqual = equal(xRounded, xNumeric);
      if (isNearlyEqual) {
        xFixed = xRounded;
      }
      else {
        xFixed = fix(x.toNumeric());
      }

      var y = new Unit(xFixed, parts[i].toString());
      ret.push(y);
      x = subtract(x, y);
    }

    // This little bit fixes a bug where the remainder should be 0 but is a little bit off.
    // But instead of comparing x, the remainder, with zero--we will compare the sum of
    // all the parts so far with the original value. If they are nearly equal,
    // we set the remainder to 0.
    var testSum = 0;
    for(var i=0; i<ret.length; i++) {
      testSum = add(testSum, ret[i].value);
    }
    if(equal(testSum, this.value)) {
      x.value = 0;
    }

    ret.push(x);

    return ret;
  };

  var PREFIXES = {
    NONE: {
      '': {name: '', value: 1, scientific: true}
    },
    SHORT: {
      '': {name: '', value: 1, scientific: true},

      'da': {name: 'da', value: 1e1, scientific: false},
      'h': {name: 'h', value: 1e2, scientific: false},
      'k': {name: 'k', value: 1e3, scientific: true},
      'M': {name: 'M', value: 1e6, scientific: true},
      'G': {name: 'G', value: 1e9, scientific: true},
      'T': {name: 'T', value: 1e12, scientific: true},
      'P': {name: 'P', value: 1e15, scientific: true},
      'E': {name: 'E', value: 1e18, scientific: true},
      'Z': {name: 'Z', value: 1e21, scientific: true},
      'Y': {name: 'Y', value: 1e24, scientific: true},

      'd': {name: 'd', value: 1e-1, scientific: false},
      'c': {name: 'c', value: 1e-2, scientific: false},
      'm': {name: 'm', value: 1e-3, scientific: true},
      'u': {name: 'u', value: 1e-6, scientific: true},
      'n': {name: 'n', value: 1e-9, scientific: true},
      'p': {name: 'p', value: 1e-12, scientific: true},
      'f': {name: 'f', value: 1e-15, scientific: true},
      'a': {name: 'a', value: 1e-18, scientific: true},
      'z': {name: 'z', value: 1e-21, scientific: true},
      'y': {name: 'y', value: 1e-24, scientific: true}
    },
    LONG: {
      '': {name: '', value: 1, scientific: true},

      'deca': {name: 'deca', value: 1e1, scientific: false},
      'hecto': {name: 'hecto', value: 1e2, scientific: false},
      'kilo': {name: 'kilo', value: 1e3, scientific: true},
      'mega': {name: 'mega', value: 1e6, scientific: true},
      'giga': {name: 'giga', value: 1e9, scientific: true},
      'tera': {name: 'tera', value: 1e12, scientific: true},
      'peta': {name: 'peta', value: 1e15, scientific: true},
      'exa': {name: 'exa', value: 1e18, scientific: true},
      'zetta': {name: 'zetta', value: 1e21, scientific: true},
      'yotta': {name: 'yotta', value: 1e24, scientific: true},

      'deci': {name: 'deci', value: 1e-1, scientific: false},
      'centi': {name: 'centi', value: 1e-2, scientific: false},
      'milli': {name: 'milli', value: 1e-3, scientific: true},
      'micro': {name: 'micro', value: 1e-6, scientific: true},
      'nano': {name: 'nano', value: 1e-9, scientific: true},
      'pico': {name: 'pico', value: 1e-12, scientific: true},
      'femto': {name: 'femto', value: 1e-15, scientific: true},
      'atto': {name: 'atto', value: 1e-18, scientific: true},
      'zepto': {name: 'zepto', value: 1e-21, scientific: true},
      'yocto': {name: 'yocto', value: 1e-24, scientific: true}
    },
    SQUARED: {
      '': {name: '', value: 1, scientific: true},

      'da': {name: 'da', value: 1e2, scientific: false},
      'h': {name: 'h', value: 1e4, scientific: false},
      'k': {name: 'k', value: 1e6, scientific: true},
      'M': {name: 'M', value: 1e12, scientific: true},
      'G': {name: 'G', value: 1e18, scientific: true},
      'T': {name: 'T', value: 1e24, scientific: true},
      'P': {name: 'P', value: 1e30, scientific: true},
      'E': {name: 'E', value: 1e36, scientific: true},
      'Z': {name: 'Z', value: 1e42, scientific: true},
      'Y': {name: 'Y', value: 1e48, scientific: true},

      'd': {name: 'd', value: 1e-2, scientific: false},
      'c': {name: 'c', value: 1e-4, scientific: false},
      'm': {name: 'm', value: 1e-6, scientific: true},
      'u': {name: 'u', value: 1e-12, scientific: true},
      'n': {name: 'n', value: 1e-18, scientific: true},
      'p': {name: 'p', value: 1e-24, scientific: true},
      'f': {name: 'f', value: 1e-30, scientific: true},
      'a': {name: 'a', value: 1e-36, scientific: true},
      'z': {name: 'z', value: 1e-42, scientific: true},
      'y': {name: 'y', value: 1e-48, scientific: true}
    },
    CUBIC: {
      '': {name: '', value: 1, scientific: true},

      'da': {name: 'da', value: 1e3, scientific: false},
      'h': {name: 'h', value: 1e6, scientific: false},
      'k': {name: 'k', value: 1e9, scientific: true},
      'M': {name: 'M', value: 1e18, scientific: true},
      'G': {name: 'G', value: 1e27, scientific: true},
      'T': {name: 'T', value: 1e36, scientific: true},
      'P': {name: 'P', value: 1e45, scientific: true},
      'E': {name: 'E', value: 1e54, scientific: true},
      'Z': {name: 'Z', value: 1e63, scientific: true},
      'Y': {name: 'Y', value: 1e72, scientific: true},

      'd': {name: 'd', value: 1e-3, scientific: false},
      'c': {name: 'c', value: 1e-6, scientific: false},
      'm': {name: 'm', value: 1e-9, scientific: true},
      'u': {name: 'u', value: 1e-18, scientific: true},
      'n': {name: 'n', value: 1e-27, scientific: true},
      'p': {name: 'p', value: 1e-36, scientific: true},
      'f': {name: 'f', value: 1e-45, scientific: true},
      'a': {name: 'a', value: 1e-54, scientific: true},
      'z': {name: 'z', value: 1e-63, scientific: true},
      'y': {name: 'y', value: 1e-72, scientific: true}
    },
    BINARY_SHORT: {
      '': {name: '', value: 1, scientific: true},
      'k': {name: 'k', value: 1e3, scientific: true},
      'M': {name: 'M', value: 1e6, scientific: true},
      'G': {name: 'G', value: 1e9, scientific: true},
      'T': {name: 'T', value: 1e12, scientific: true},
      'P': {name: 'P', value: 1e15, scientific: true},
      'E': {name: 'E', value: 1e18, scientific: true},
      'Z': {name: 'Z', value: 1e21, scientific: true},
      'Y': {name: 'Y', value: 1e24, scientific: true},

      'Ki': {name: 'Ki', value: 1024, scientific: true},
      'Mi': {name: 'Mi', value: Math.pow(1024, 2), scientific: true},
      'Gi': {name: 'Gi', value: Math.pow(1024, 3), scientific: true},
      'Ti': {name: 'Ti', value: Math.pow(1024, 4), scientific: true},
      'Pi': {name: 'Pi', value: Math.pow(1024, 5), scientific: true},
      'Ei': {name: 'Ei', value: Math.pow(1024, 6), scientific: true},
      'Zi': {name: 'Zi', value: Math.pow(1024, 7), scientific: true},
      'Yi': {name: 'Yi', value: Math.pow(1024, 8), scientific: true}
    },
    BINARY_LONG: {
      '': {name: '', value: 1, scientific: true},
      'kilo': {name: 'kilo', value: 1e3, scientific: true},
      'mega': {name: 'mega', value: 1e6, scientific: true},
      'giga': {name: 'giga', value: 1e9, scientific: true},
      'tera': {name: 'tera', value: 1e12, scientific: true},
      'peta': {name: 'peta', value: 1e15, scientific: true},
      'exa': {name: 'exa', value: 1e18, scientific: true},
      'zetta': {name: 'zetta', value: 1e21, scientific: true},
      'yotta': {name: 'yotta', value: 1e24, scientific: true},

      'kibi': {name: 'kibi', value: 1024, scientific: true},
      'mebi': {name: 'mebi', value: Math.pow(1024, 2), scientific: true},
      'gibi': {name: 'gibi', value: Math.pow(1024, 3), scientific: true},
      'tebi': {name: 'tebi', value: Math.pow(1024, 4), scientific: true},
      'pebi': {name: 'pebi', value: Math.pow(1024, 5), scientific: true},
      'exi': {name: 'exi', value: Math.pow(1024, 6), scientific: true},
      'zebi': {name: 'zebi', value: Math.pow(1024, 7), scientific: true},
      'yobi': {name: 'yobi', value: Math.pow(1024, 8), scientific: true}
    },
    BTU: {
      '':   {name: '',   value: 1,   scientific: true},
      'MM': {name: 'MM', value: 1e6, scientific: true}
    }
  };

  // Add a prefix list for both short and long prefixes (for ohm in particular, since Mohm and megaohm are both acceptable):
  PREFIXES.SHORTLONG = {};
  for (var key in PREFIXES.SHORT) {
    if(PREFIXES.SHORT.hasOwnProperty(key)) {
      PREFIXES.SHORTLONG[key] = PREFIXES.SHORT[key];
    }
  }
  for (var key in PREFIXES.LONG) {
    if(PREFIXES.LONG.hasOwnProperty(key)) {
      PREFIXES.SHORTLONG[key] = PREFIXES.LONG[key];
    }
  }

  /* Internally, each unit is represented by a value and a dimension array. The elements of the dimensions array have the following meaning:
   * Index  Dimension
   * -----  ---------
   *   0    Length
   *   1    Mass
   *   2    Time
   *   3    Current
   *   4    Temperature
   *   5    Luminous intensity
   *   6    Amount of substance
   *   7    Angle
   *   8    Bit (digital)
   * For example, the unit "298.15 K" is a pure temperature and would have a value of 298.15 and a dimension array of [0, 0, 0, 0, 1, 0, 0, 0, 0]. The unit "1 cal / (gm °C)" can be written in terms of the 9 fundamental dimensions as [length^2] / ([time^2] * [temperature]), and would a value of (after conversion to SI) 4184.0 and a dimensions array of [2, 0, -2, 0, -1, 0, 0, 0, 0].
   *
   */

  var BASE_DIMENSIONS = ["MASS", "LENGTH", "TIME", "CURRENT", "TEMPERATURE", "LUMINOUS_INTENSITY", "AMOUNT_OF_SUBSTANCE", "ANGLE", "BIT"];

  var BASE_UNITS = {
    NONE: {
      dimensions: [0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    MASS: {
      dimensions: [1, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    LENGTH: {
      dimensions: [0, 1, 0, 0, 0, 0, 0, 0, 0]
    },
    TIME: {
      dimensions: [0, 0, 1, 0, 0, 0, 0, 0, 0]
    },
    CURRENT: {
      dimensions: [0, 0, 0, 1, 0, 0, 0, 0, 0]
    },
    TEMPERATURE: {
      dimensions: [0, 0, 0, 0, 1, 0, 0, 0, 0]
    },
    LUMINOUS_INTENSITY: {
      dimensions: [0, 0, 0, 0, 0, 1, 0, 0, 0]
    },
    AMOUNT_OF_SUBSTANCE: {
      dimensions: [0, 0, 0, 0, 0, 0, 1, 0, 0]
    },

    FORCE: {
      dimensions: [1, 1, -2, 0, 0, 0, 0, 0, 0]
    },
    SURFACE: {
      dimensions: [0, 2, 0, 0, 0, 0, 0, 0, 0]
    },
    VOLUME: {
      dimensions: [0, 3, 0, 0, 0, 0, 0, 0, 0]
    },
    ENERGY: {
      dimensions: [1, 2, -2, 0, 0, 0, 0, 0, 0]
    },
    POWER: {
      dimensions: [1, 2, -3, 0, 0, 0, 0, 0, 0]
    },
    PRESSURE: {
      dimensions: [1, -1, -2, 0, 0, 0, 0, 0, 0]
    },

    ELECTRIC_CHARGE: {
      dimensions: [0, 0, 1, 1, 0, 0, 0, 0, 0]
    },
    ELECTRIC_CAPACITANCE: {
      dimensions: [-1, -2, 4, 2, 0, 0, 0, 0, 0]
    },
    ELECTRIC_POTENTIAL: {
      dimensions: [1, 2, -3, -1, 0, 0, 0, 0, 0]
    },
    ELECTRIC_RESISTANCE: {
      dimensions: [1, 2, -3, -2, 0, 0, 0, 0, 0]
    },
    ELECTRIC_INDUCTANCE: {
      dimensions: [1, 2, -2, -2, 0, 0, 0, 0, 0]
    },
    ELECTRIC_CONDUCTANCE: {
      dimensions: [-1, -2, 3, 2, 0, 0, 0, 0, 0]
    },
    MAGNETIC_FLUX: {
      dimensions: [1, 2, -2, -1, 0, 0, 0, 0, 0]
    },
    MAGNETIC_FLUX_DENSITY: {
      dimensions: [1, 0, -2, -1, 0, 0, 0, 0, 0]
    },

    FREQUENCY: {
      dimensions: [0, 0, -1, 0, 0, 0, 0, 0, 0]
    },
    ANGLE: {
      dimensions: [0, 0, 0, 0, 0, 0, 0, 1, 0]
    },
    BIT: {
      dimensions: [0, 0, 0, 0, 0, 0, 0, 0, 1]
    }
  };

  for(var key in BASE_UNITS) {
    BASE_UNITS[key].key = key;
  }

  var BASE_UNIT_NONE = {};

  var UNIT_NONE = {name: '', base: BASE_UNIT_NONE, value: 1, offset: 0, dimensions: [0,0,0,0,0,0,0,0,0]};

  var UNITS = {
    // length
    meter: {
      name: 'meter',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    inch: {
      name: 'inch',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 0.0254,
      offset: 0
    },
    foot: {
      name: 'foot',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 0.3048,
      offset: 0
    },
    yard: {
      name: 'yard',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 0.9144,
      offset: 0
    },
    mile: {
      name: 'mile',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 1609.344,
      offset: 0
    },
    link: {
      name: 'link',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 0.201168,
      offset: 0
    },
    rod: {
      name: 'rod',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 5.029210,
      offset: 0
    },
    chain: {
      name: 'chain',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 20.1168,
      offset: 0
    },
    angstrom: {
      name: 'angstrom',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 1e-10,
      offset: 0
    },

    m: {
      name: 'm',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    'in': {
      name: 'in',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 0.0254,
      offset: 0
    },
    ft: {
      name: 'ft',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 0.3048,
      offset: 0
    },
    yd: {
      name: 'yd',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 0.9144,
      offset: 0
    },
    mi: {
      name: 'mi',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 1609.344,
      offset: 0
    },
    li: {
      name: 'li',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 0.201168,
      offset: 0
    },
    rd: {
      name: 'rd',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 5.029210,
      offset: 0
    },
    ch: {
      name: 'ch',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 20.1168,
      offset: 0
    },
    mil: {
      name: 'mil',
      base: BASE_UNITS.LENGTH,
      prefixes: PREFIXES.NONE,
      value: 0.0000254,
      offset: 0
    }, // 1/1000 inch

    // Surface
    m2: {
      name: 'm2',
      base: BASE_UNITS.SURFACE,
      prefixes: PREFIXES.SQUARED,
      value: 1,
      offset: 0
    },
    sqin: {
      name: 'sqin',
      base: BASE_UNITS.SURFACE,
      prefixes: PREFIXES.NONE,
      value: 0.00064516,
      offset: 0
    }, // 645.16 mm2
    sqft: {
      name: 'sqft',
      base: BASE_UNITS.SURFACE,
      prefixes: PREFIXES.NONE,
      value: 0.09290304,
      offset: 0
    }, // 0.09290304 m2
    sqyd: {
      name: 'sqyd',
      base: BASE_UNITS.SURFACE,
      prefixes: PREFIXES.NONE,
      value: 0.83612736,
      offset: 0
    }, // 0.83612736 m2
    sqmi: {
      name: 'sqmi',
      base: BASE_UNITS.SURFACE,
      prefixes: PREFIXES.NONE,
      value: 2589988.110336,
      offset: 0
    }, // 2.589988110336 km2
    sqrd: {
      name: 'sqrd',
      base: BASE_UNITS.SURFACE,
      prefixes: PREFIXES.NONE,
      value: 25.29295,
      offset: 0
    }, // 25.29295 m2
    sqch: {
      name: 'sqch',
      base: BASE_UNITS.SURFACE,
      prefixes: PREFIXES.NONE,
      value: 404.6873,
      offset: 0
    }, // 404.6873 m2
    sqmil: {
      name: 'sqmil',
      base: BASE_UNITS.SURFACE,
      prefixes: PREFIXES.NONE,
      value: 6.4516e-10,
      offset: 0
    }, // 6.4516 * 10^-10 m2
    acre: {
      name: 'acre',
      base: BASE_UNITS.SURFACE,
      prefixes: PREFIXES.NONE,
      value: 4046.86,
      offset: 0
    }, // 4046.86 m2
    hectare: {
      name: 'hectare',
      base: BASE_UNITS.SURFACE,
      prefixes: PREFIXES.NONE,
      value: 10000,
      offset: 0
    }, // 10000 m2

    // Volume
    m3: {
      name: 'm3',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.CUBIC,
      value: 1,
      offset: 0
    },
    L: {
      name: 'L',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.SHORT,
      value: 0.001,
      offset: 0
    }, // litre
    l: {
      name: 'l',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.SHORT,
      value: 0.001,
      offset: 0
    }, // litre
    litre: {
      name: 'litre',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.LONG,
      value: 0.001,
      offset: 0
    },
    cuin: {
      name: 'cuin',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 1.6387064e-5,
      offset: 0
    }, // 1.6387064e-5 m3
    cuft: {
      name: 'cuft',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.028316846592,
      offset: 0
    }, // 28.316 846 592 L
    cuyd: {
      name: 'cuyd',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.764554857984,
      offset: 0
    }, // 764.554 857 984 L
    teaspoon: {
      name: 'teaspoon',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.000005,
      offset: 0
    }, // 5 mL
    tablespoon: {
      name: 'tablespoon',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.000015,
      offset: 0
    }, // 15 mL
    //{name: 'cup', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.000240, offset: 0}, // 240 mL  // not possible, we have already another cup
    drop: {
      name: 'drop',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 5e-8,
      offset: 0
    },  // 0.05 mL = 5e-8 m3
    gtt: {
      name: 'gtt',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 5e-8,
      offset: 0
    },  // 0.05 mL = 5e-8 m3

    // Liquid volume
    minim: {
      name: 'minim',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.00000006161152,
      offset: 0
    }, // 0.06161152 mL
    fluiddram: {
      name: 'fluiddram',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.0000036966911,
      offset: 0
    },  // 3.696691 mL
    fluidounce: {
      name: 'fluidounce',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.00002957353,
      offset: 0
    }, // 29.57353 mL
    gill: {
      name: 'gill',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.0001182941,
      offset: 0
    }, // 118.2941 mL
    cc: {
      name: 'cc',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 1e-6,
      offset: 0
    }, // 1e-6 L
    cup: {
      name: 'cup',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.0002365882,
      offset: 0
    }, // 236.5882 mL
    pint: {
      name: 'pint',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.0004731765,
      offset: 0
    }, // 473.1765 mL
    quart: {
      name: 'quart',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.0009463529,
      offset: 0
    }, // 946.3529 mL
    gallon: {
      name: 'gallon',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.003785412,
      offset: 0
    }, // 3.785412 L
    beerbarrel: {
      name: 'beerbarrel',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.1173478,
      offset: 0
    }, // 117.3478 L
    oilbarrel: {
      name: 'oilbarrel',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.1589873,
      offset: 0
    }, // 158.9873 L
    hogshead: {
      name: 'hogshead',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.2384810,
      offset: 0
    }, // 238.4810 L

    //{name: 'min', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.00000006161152, offset: 0}, // 0.06161152 mL // min is already in use as minute
    fldr: {
      name: 'fldr',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.0000036966911,
      offset: 0
    },  // 3.696691 mL
    floz: {
      name: 'floz',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.00002957353,
      offset: 0
    }, // 29.57353 mL
    gi: {
      name: 'gi',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.0001182941,
      offset: 0
    }, // 118.2941 mL
    cp: {
      name: 'cp',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.0002365882,
      offset: 0
    }, // 236.5882 mL
    pt: {
      name: 'pt',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.0004731765,
      offset: 0
    }, // 473.1765 mL
    qt: {
      name: 'qt',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.0009463529,
      offset: 0
    }, // 946.3529 mL
    gal: {
      name: 'gal',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.003785412,
      offset: 0
    }, // 3.785412 L
    bbl: {
      name: 'bbl',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.1173478,
      offset: 0
    }, // 117.3478 L
    obl: {
      name: 'obl',
      base: BASE_UNITS.VOLUME,
      prefixes: PREFIXES.NONE,
      value: 0.1589873,
      offset: 0
    }, // 158.9873 L
    //{name: 'hogshead', base: BASE_UNITS.VOLUME, prefixes: PREFIXES.NONE, value: 0.2384810, offset: 0}, // 238.4810 L // TODO: hh?

    // Mass
    g: {
      name: 'g',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.SHORT,
      value: 0.001,
      offset: 0
    },
    gram: {
      name: 'gram',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.LONG,
      value: 0.001,
      offset: 0
    },

    ton: {
      name: 'ton',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.SHORT,
      value: 907.18474,
      offset: 0
    },
    tonne: {
      name: 'tonne',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.SHORT,
      value: 1000,
      offset: 0
    },

    grain: {
      name: 'grain',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 64.79891e-6,
      offset: 0
    },
    dram: {
      name: 'dram',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 1.7718451953125e-3,
      offset: 0
    },
    ounce: {
      name: 'ounce',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 28.349523125e-3,
      offset: 0
    },
    poundmass: {
      name: 'poundmass',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 453.59237e-3,
      offset: 0
    },
    hundredweight: {
      name: 'hundredweight',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 45.359237,
      offset: 0
    },
    stick: {
      name: 'stick',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 115e-3,
      offset: 0
    },
    stone: {
      name: 'stone',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 6.35029318,
      offset: 0
    },

    gr: {
      name: 'gr',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 64.79891e-6,
      offset: 0
    },
    dr: {
      name: 'dr',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 1.7718451953125e-3,
      offset: 0
    },
    oz: {
      name: 'oz',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 28.349523125e-3,
      offset: 0
    },
    lbm: {
      name: 'lbm',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 453.59237e-3,
      offset: 0
    },
    cwt: {
      name: 'cwt',
      base: BASE_UNITS.MASS,
      prefixes: PREFIXES.NONE,
      value: 45.359237,
      offset: 0
    },

    // Time
    s: {
      name: 's',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    min: {
      name: 'min',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.NONE,
      value: 60,
      offset: 0
    },
    h: {
      name: 'h',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.NONE,
      value: 3600,
      offset: 0
    },
    second: {
      name: 'second',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    sec: {
      name: 'sec',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    minute: {
      name: 'minute',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.NONE,
      value: 60,
      offset: 0
    },
    hour: {
      name: 'hour',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.NONE,
      value: 3600,
      offset: 0
    },
    day: {
      name: 'day',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.NONE,
      value: 86400,
      offset: 0
    },
    week: {
      name: 'week',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.NONE,
      value: 7*86400,
      offset: 0
    },
    month: {
      name: 'month',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.NONE,
      value: 2629800, //1/12th of Julian year
      offset: 0
    },
    year: {
      name: 'year',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.NONE,
      value: 31557600, //Julian year
      offset: 0
    },
    decade: {
      name: 'year',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.NONE,
      value: 315576000, //Julian decade
      offset: 0
    },
    century: {
      name: 'century',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.NONE,
      value: 3155760000, //Julian century
      offset: 0
    },
    millennium: {
      name: 'millennium',
      base: BASE_UNITS.TIME,
      prefixes: PREFIXES.NONE,
      value: 31557600000, //Julian millennium
      offset: 0
    },

    // Frequency
    hertz: {
      name: 'Hertz',
      base: BASE_UNITS.FREQUENCY,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0,
      reciprocal: true
    },
    Hz: {
      name: 'Hz',
      base: BASE_UNITS.FREQUENCY,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0,
      reciprocal: true
    },

    // Angle
    rad: {
      name: 'rad',
      base: BASE_UNITS.ANGLE,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    // deg = rad / (2*pi) * 360 = rad / 0.017453292519943295769236907684888
    deg: {
      name: 'deg',
      base: BASE_UNITS.ANGLE,
      prefixes: PREFIXES.LONG,
      value: null, // will be filled in by calculateAngleValues()
      offset: 0
    },
    // grad = rad / (2*pi) * 400  = rad / 0.015707963267948966192313216916399
    grad: {
      name: 'grad',
      base: BASE_UNITS.ANGLE,
      prefixes: PREFIXES.LONG,
      value: null, // will be filled in by calculateAngleValues()
      offset: 0
    },
    // cycle = rad / (2*pi) = rad / 6.2831853071795864769252867665793
    cycle: {
      name: 'cycle',
      base: BASE_UNITS.ANGLE,
      prefixes: PREFIXES.NONE,
      value: null, // will be filled in by calculateAngleValues()
      offset: 0
    },
    // arcsec = rad / (3600 * (360 / 2 * pi)) = rad / 0.0000048481368110953599358991410235795
    arcsec: {
      name: 'arcsec',
      base: BASE_UNITS.ANGLE,
      prefixes: PREFIXES.NONE,
      value: null, // will be filled in by calculateAngleValues()
      offset: 0
    },
    // arcmin = rad / (60 * (360 / 2 * pi)) = rad / 0.00029088820866572159615394846141477
    arcmin: {
      name: 'arcmin',
      base: BASE_UNITS.ANGLE,
      prefixes: PREFIXES.NONE,
      value: null, // will be filled in by calculateAngleValues()
      offset: 0
    },
    
    // Electric current
    A: {
      name: 'A',
      base: BASE_UNITS.CURRENT,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    ampere: {
      name: 'ampere',
      base: BASE_UNITS.CURRENT,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },

    // Temperature
    // K(C) = °C + 273.15
    // K(F) = (°F + 459.67) / 1.8
    // K(R) = °R / 1.8
    K: {
      name: 'K',
      base: BASE_UNITS.TEMPERATURE,
      prefixes: PREFIXES.NONE,
      value: 1,
      offset: 0
    },
    degC: {
      name: 'degC',
      base: BASE_UNITS.TEMPERATURE,
      prefixes: PREFIXES.NONE,
      value: 1,
      offset: 273.15
    },
    degF: {
      name: 'degF',
      base: BASE_UNITS.TEMPERATURE,
      prefixes: PREFIXES.NONE,
      value: 1 / 1.8,
      offset: 459.67
    },
    degR: {
      name: 'degR',
      base: BASE_UNITS.TEMPERATURE,
      prefixes: PREFIXES.NONE,
      value: 1 / 1.8,
      offset: 0
    },
    kelvin: {
      name: 'kelvin',
      base: BASE_UNITS.TEMPERATURE,
      prefixes: PREFIXES.NONE,
      value: 1,
      offset: 0
    },
    celsius: {
      name: 'celsius',
      base: BASE_UNITS.TEMPERATURE,
      prefixes: PREFIXES.NONE,
      value: 1,
      offset: 273.15
    },
    fahrenheit: {
      name: 'fahrenheit',
      base: BASE_UNITS.TEMPERATURE,
      prefixes: PREFIXES.NONE,
      value: 1 / 1.8,
      offset: 459.67
    },
    rankine: {
      name: 'rankine',
      base: BASE_UNITS.TEMPERATURE,
      prefixes: PREFIXES.NONE,
      value: 1 / 1.8,
      offset: 0
    },

    // amount of substance
    mol: {
      name: 'mol',
      base: BASE_UNITS.AMOUNT_OF_SUBSTANCE,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    mole: {
      name: 'mole',
      base: BASE_UNITS.AMOUNT_OF_SUBSTANCE,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },

    // luminous intensity
    cd: {
      name: 'cd',
      base: BASE_UNITS.LUMINOUS_INTENSITY,
      prefixes: PREFIXES.NONE,
      value: 1,
      offset: 0
    },
    candela: {
      name: 'candela',
      base: BASE_UNITS.LUMINOUS_INTENSITY,
      prefixes: PREFIXES.NONE,
      value: 1,
      offset: 0
    },
    // TODO: units STERADIAN
    //{name: 'sr', base: BASE_UNITS.STERADIAN, prefixes: PREFIXES.NONE, value: 1, offset: 0},
    //{name: 'steradian', base: BASE_UNITS.STERADIAN, prefixes: PREFIXES.NONE, value: 1, offset: 0},

    // Force
    N: {
      name: 'N',
      base: BASE_UNITS.FORCE,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    newton: {
      name: 'newton',
      base: BASE_UNITS.FORCE,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    dyn: {
      name: 'dyn',
      base: BASE_UNITS.FORCE,
      prefixes: PREFIXES.SHORT,
      value: 0.00001,
      offset: 0
    },
    dyne: {
      name: 'dyne',
      base: BASE_UNITS.FORCE,
      prefixes: PREFIXES.LONG,
      value: 0.00001,
      offset: 0
    },
    lbf: {
      name: 'lbf',
      base: BASE_UNITS.FORCE,
      prefixes: PREFIXES.NONE,
      value: 4.4482216152605,
      offset: 0
    },
    poundforce: {
      name: 'poundforce',
      base: BASE_UNITS.FORCE,
      prefixes: PREFIXES.NONE,
      value: 4.4482216152605,
      offset: 0
    },
    kip: {
      name: 'kip',
      base: BASE_UNITS.FORCE,
      prefixes: PREFIXES.LONG,
      value: 4448.2216,
      offset: 0
    },
	
    // Energy
    J: {
      name: 'J',
      base: BASE_UNITS.ENERGY,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    joule: {
      name: 'joule',
      base: BASE_UNITS.ENERGY,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    erg: {
      name: 'erg',
      base: BASE_UNITS.ENERGY,
      prefixes: PREFIXES.NONE,
      value: 1e-7,
      offset: 0
    },
    Wh: {
      name: 'Wh',
      base: BASE_UNITS.ENERGY,
      prefixes: PREFIXES.SHORT,
      value: 3600,
      offset: 0
    },
    BTU: {
      name: 'BTU',
      base: BASE_UNITS.ENERGY,
      prefixes: PREFIXES.BTU,
      value: 1055.05585262,
      offset: 0
    },
    eV: {
      name: 'eV',
      base: BASE_UNITS.ENERGY,
      prefixes: PREFIXES.SHORT,
      value: 1.602176565e-19,
      offset: 0
    },
    electronvolt: {
      name: 'electronvolt',
      base: BASE_UNITS.ENERGY,
      prefixes: PREFIXES.LONG,
      value: 1.602176565e-19,
      offset: 0
    },


    // Power
    W: {
      name: 'W',
      base: BASE_UNITS.POWER,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    watt: {
      name: 'W',
      base: BASE_UNITS.POWER,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    hp: {
      name: 'hp',
      base: BASE_UNITS.POWER,
      prefixes: PREFIXES.NONE,
      value: 745.6998715386,
      offset: 0
    },

    // Electrical power units
    VAR: {
      name: 'VAR',
      base: BASE_UNITS.POWER,
      prefixes: PREFIXES.SHORT,
      value: Complex.I,
      offset: 0
    },
    
    VA: {
      name: 'VA',
      base: BASE_UNITS.POWER,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },

    // Pressure
    Pa: {
      name: 'Pa',
      base: BASE_UNITS.PRESSURE,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    psi: {
      name: 'psi',
      base: BASE_UNITS.PRESSURE,
      prefixes: PREFIXES.NONE,
      value: 6894.75729276459,
      offset: 0
    },
    atm: {
      name: 'atm',
      base: BASE_UNITS.PRESSURE,
      prefixes: PREFIXES.NONE,
      value: 101325,
      offset: 0
    },
    bar: {
      name: 'bar',
      base: BASE_UNITS.PRESSURE,
      prefixes: PREFIXES.NONE,
      value: 100000,
      offset: 0
    },
    torr: {
      name: 'torr',
      base: BASE_UNITS.PRESSURE,
      prefixes: PREFIXES.NONE,
      value: 133.322,
      offset: 0
    },
    mmHg: {
      name: 'mmHg',
      base: BASE_UNITS.PRESSURE,
      prefixes: PREFIXES.NONE,
      value: 133.322,
      offset: 0
    },
    mmH2O: {
      name: 'mmH2O',
      base: BASE_UNITS.PRESSURE,
      prefixes: PREFIXES.NONE,
      value: 9.80665,
      offset: 0
    },
    cmH2O: {
      name: 'cmH2O',
      base: BASE_UNITS.PRESSURE,
      prefixes: PREFIXES.NONE,
      value: 98.0665,
      offset: 0
    },

    // Electric charge
    coulomb: {
      name: 'coulomb',
      base: BASE_UNITS.ELECTRIC_CHARGE,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    C: {
      name: 'C',
      base: BASE_UNITS.ELECTRIC_CHARGE,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    // Electric capacitance
    farad: {
      name: 'farad',
      base: BASE_UNITS.ELECTRIC_CAPACITANCE,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    F: {
      name: 'F',
      base: BASE_UNITS.ELECTRIC_CAPACITANCE,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    // Electric potential
    volt: {
      name: 'volt',
      base: BASE_UNITS.ELECTRIC_POTENTIAL,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    V: {
      name: 'V',
      base: BASE_UNITS.ELECTRIC_POTENTIAL,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    // Electric resistance
    ohm: {
      name: 'ohm',
      base: BASE_UNITS.ELECTRIC_RESISTANCE,
      prefixes: PREFIXES.SHORTLONG,    // Both Mohm and megaohm are acceptable
      value: 1,
      offset: 0
    },
    /*
     * Unicode breaks in browsers if charset is not specified
    Ω: {
      name: 'Ω',
      base: BASE_UNITS.ELECTRIC_RESISTANCE,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    */
    // Electric inductance
    henry: {
      name: 'henry',
      base: BASE_UNITS.ELECTRIC_INDUCTANCE,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    H: {
      name: 'H',
      base: BASE_UNITS.ELECTRIC_INDUCTANCE,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    // Electric conductance
    siemens: {
      name: 'siemens',
      base: BASE_UNITS.ELECTRIC_CONDUCTANCE,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    S: {
      name: 'S',
      base: BASE_UNITS.ELECTRIC_CONDUCTANCE,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    // Magnetic flux
    weber: {
      name: 'weber',
      base: BASE_UNITS.MAGNETIC_FLUX,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    Wb: {
      name: 'Wb',
      base: BASE_UNITS.MAGNETIC_FLUX,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },
    // Magnetic flux density
    tesla: {
      name: 'tesla',
      base: BASE_UNITS.MAGNETIC_FLUX_DENSITY,
      prefixes: PREFIXES.LONG,
      value: 1,
      offset: 0
    },
    T: {
      name: 'T',
      base: BASE_UNITS.MAGNETIC_FLUX_DENSITY,
      prefixes: PREFIXES.SHORT,
      value: 1,
      offset: 0
    },

    // Binary
    b: {
      name: 'b',
      base: BASE_UNITS.BIT,
      prefixes: PREFIXES.BINARY_SHORT,
      value: 1,
      offset: 0
    },
    bits: {
      name: 'bits',
      base: BASE_UNITS.BIT,
      prefixes: PREFIXES.BINARY_LONG,
      value: 1,
      offset: 0
    },
    B: {
      name: 'B',
      base: BASE_UNITS.BIT,
      prefixes: PREFIXES.BINARY_SHORT,
      value: 8,
      offset: 0
    },
    bytes: {
      name: 'bytes',
      base: BASE_UNITS.BIT,
      prefixes: PREFIXES.BINARY_LONG,
      value: 8,
      offset: 0
    }
  };

  // aliases (formerly plurals)
  var ALIASES = {
    meters: 'meter',
    inches: 'inch',
    feet: 'foot',
    yards: 'yard',
    miles: 'mile',
    links: 'link',
    rods: 'rod',
    chains: 'chain',
    angstroms: 'angstrom',

    lt: 'l',
    litres: 'litre',
    liter: 'litre',
    liters: 'litre',
    teaspoons: 'teaspoon',
    tablespoons: 'tablespoon',
    minims: 'minim',
    fluiddrams: 'fluiddram',
    fluidounces: 'fluidounce',
    gills: 'gill',
    cups: 'cup',
    pints: 'pint',
    quarts: 'quart',
    gallons: 'gallon',
    beerbarrels: 'beerbarrel',
    oilbarrels: 'oilbarrel',
    hogsheads: 'hogshead',
    gtts: 'gtt',

    grams: 'gram',
    tons: 'ton',
    tonnes: 'tonne',
    grains: 'grain',
    drams: 'dram',
    ounces: 'ounce',
    poundmasses: 'poundmass',
    hundredweights: 'hundredweight',
    sticks: 'stick',
    lb: 'lbm',
    lbs: 'lbm',
	
    kips: 'kip',

    acres: 'acre',
    hectares: 'hectare',
    sqfeet: 'sqft',
    sqyard: 'sqyd',
    sqmile: 'sqmi',
    sqmiles: 'sqmi',

    mmhg: 'mmHg',
    mmh2o: 'mmH2O',
    cmh2o: 'cmH2O',

    seconds: 'second',
    secs: 'second',
    minutes: 'minute',
    mins: 'minute',
    hours: 'hour',
    hr: 'hour',
    hrs: 'hour',
    days: 'day',
    weeks: 'week',
    months: 'month',
    years: 'year',

    hertz: 'hertz',

    radians: 'rad',
    degree: 'deg',
    degrees: 'deg',
    gradian: 'grad',
    gradians: 'grad',
    cycles: 'cycle',
    arcsecond: 'arcsec',
    arcseconds: 'arcsec',
    arcminute: 'arcmin',
    arcminutes: 'arcmin',

    BTUs: 'BTU',
    watts: 'watt',
    joules: 'joule',

    amperes: 'ampere',
    coulombs: 'coulomb',
    volts: 'volt',
    ohms: 'ohm',
    farads: 'farad',
    webers: 'weber',
    teslas: 'tesla',
    electronvolts: 'electronvolt',
    moles: 'mole'

  };

  /**
   * Calculate the values for the angle units.
   * Value is calculated as number or BigNumber depending on the configuration
   * @param {{number: 'number' | 'BigNumber'}} config
   */
  function calculateAngleValues (config) {
    if (config.number === 'BigNumber') {
      var pi = constants.pi(type.BigNumber);
      UNITS.rad.value = new type.BigNumber(1);
      UNITS.deg.value = pi.div(180);        // 2 * pi / 360;
      UNITS.grad.value = pi.div(200);       // 2 * pi / 400;
      UNITS.cycle.value = pi.times(2);      // 2 * pi
      UNITS.arcsec.value = pi.div(648000);  // 2 * pi / 360 / 3600
      UNITS.arcmin.value = pi.div(10800);   // 2 * pi / 360 / 60
    }
    else { // number
      UNITS.rad.value = 1;
      UNITS.deg.value = Math.PI / 180;        // 2 * pi / 360;
      UNITS.grad.value = Math.PI / 200;       // 2 * pi / 400;
      UNITS.cycle.value = Math.PI * 2;        // 2 * pi
      UNITS.arcsec.value = Math.PI / 648000;  // 2 * pi / 360 / 3600;
      UNITS.arcmin.value = Math.PI / 10800;   // 2 * pi / 360 / 60;
    }
  }

  // apply the angle values now
  calculateAngleValues(config);

  // recalculate the values on change of configuration
  math.on('config', function (curr, prev) {
    if (curr.number !== prev.number) {
      calculateAngleValues(curr);
    }
  });

  /**
   * A unit system is a set of dimensionally independent base units plus a set of derived units, formed by multiplication and division of the base units, that are by convention used with the unit system.
   * A user perhaps could issue a command to select a preferred unit system, or use the default (see below).
   * Auto unit system: The default unit system is updated on the fly anytime a unit is parsed. The corresponding unit in the default unit system is updated, so that answers are given in the same units the user supplies.
   */
  var UNIT_SYSTEMS = {
    si: {
      // Base units
      NONE:                  {unit: UNIT_NONE, prefix: PREFIXES.NONE['']},
      LENGTH:                {unit: UNITS.m,   prefix: PREFIXES.SHORT['']},
      MASS:                  {unit: UNITS.g,   prefix: PREFIXES.SHORT['k']}, 
      TIME:                  {unit: UNITS.s,   prefix: PREFIXES.SHORT['']}, 
      CURRENT:               {unit: UNITS.A,   prefix: PREFIXES.SHORT['']}, 
      TEMPERATURE:           {unit: UNITS.K,   prefix: PREFIXES.SHORT['']}, 
      LUMINOUS_INTENSITY:    {unit: UNITS.cd,  prefix: PREFIXES.SHORT['']}, 
      AMOUNT_OF_SUBSTANCE:   {unit: UNITS.mol, prefix: PREFIXES.SHORT['']}, 
      ANGLE:                 {unit: UNITS.rad, prefix: PREFIXES.SHORT['']}, 
      BIT:                   {unit: UNITS.bit, prefix: PREFIXES.SHORT['']}, 

      // Derived units
      FORCE:                 {unit: UNITS.N,   prefix: PREFIXES.SHORT['']}, 
      ENERGY:                {unit: UNITS.J,   prefix: PREFIXES.SHORT['']},
      POWER:                 {unit: UNITS.W,   prefix: PREFIXES.SHORT['']},
      PRESSURE:              {unit: UNITS.Pa,  prefix: PREFIXES.SHORT['']},
      ELECTRIC_CHARGE:       {unit: UNITS.C,   prefix: PREFIXES.SHORT['']},
      ELECTRIC_CAPACITANCE:  {unit: UNITS.F,   prefix: PREFIXES.SHORT['']},
      ELECTRIC_POTENTIAL:    {unit: UNITS.V,   prefix: PREFIXES.SHORT['']},
      ELECTRIC_RESISTANCE:   {unit: UNITS.ohm, prefix: PREFIXES.SHORT['']},
      ELECTRIC_INDUCTANCE:   {unit: UNITS.H,   prefix: PREFIXES.SHORT['']},
      ELECTRIC_CONDUCTANCE:  {unit: UNITS.S,   prefix: PREFIXES.SHORT['']},
      MAGNETIC_FLUX:         {unit: UNITS.Wb,  prefix: PREFIXES.SHORT['']},
      MAGNETIC_FLUX_DENSITY: {unit: UNITS.T,   prefix: PREFIXES.SHORT['']},
      FREQUENCY:             {unit: UNITS.Hz,  prefix: PREFIXES.SHORT['']}
    }
  };

  // Clone to create the other unit systems
  UNIT_SYSTEMS.cgs = JSON.parse(JSON.stringify(UNIT_SYSTEMS.si));
  UNIT_SYSTEMS.cgs.LENGTH = {unit: UNITS.m,   prefix: PREFIXES.SHORT['c']};
  UNIT_SYSTEMS.cgs.MASS =   {unit: UNITS.g,   prefix: PREFIXES.SHORT['']};
  UNIT_SYSTEMS.cgs.FORCE =  {unit: UNITS.dyn, prefix: PREFIXES.SHORT['']};
  UNIT_SYSTEMS.cgs.ENERGY = {unit: UNITS.erg, prefix: PREFIXES.NONE['']};
  // there are wholly 4 unique cgs systems for electricity and magnetism,
  // so let's not worry about it unless somebody complains
  
  UNIT_SYSTEMS.us = JSON.parse(JSON.stringify(UNIT_SYSTEMS.si));
  UNIT_SYSTEMS.us.LENGTH =      {unit: UNITS.ft,   prefix: PREFIXES.NONE['']};
  UNIT_SYSTEMS.us.MASS =        {unit: UNITS.lbm,  prefix: PREFIXES.NONE['']};
  UNIT_SYSTEMS.us.TEMPERATURE = {unit: UNITS.degF, prefix: PREFIXES.NONE['']};
  UNIT_SYSTEMS.us.FORCE =       {unit: UNITS.lbf,  prefix: PREFIXES.NONE['']};
  UNIT_SYSTEMS.us.ENERGY =      {unit: UNITS.BTU,  prefix: PREFIXES.BTU['']};
  UNIT_SYSTEMS.us.POWER =       {unit: UNITS.hp,   prefix: PREFIXES.NONE['']};
  UNIT_SYSTEMS.us.PRESSURE =    {unit: UNITS.psi,  prefix: PREFIXES.NONE['']};

  // Add additional unit systems here.



  // Choose a unit system to seed the auto unit system.
  UNIT_SYSTEMS.auto = JSON.parse(JSON.stringify(UNIT_SYSTEMS.si));

  // Set the current unit system
  var currentUnitSystem = UNIT_SYSTEMS.auto;

  /**
   * Set a unit system for formatting derived units.
   * @param {string} [name] The name of the unit system.
   */
  Unit.setUnitSystem = function(name) {
    if(UNIT_SYSTEMS.hasOwnProperty(name)) {
      currentUnitSystem = UNIT_SYSTEMS[name];
    }
    else {
      throw new Error('Unit system ' + name + ' does not exist. Choices are: ' + Object.keys(UNIT_SYSTEMS).join(', '));
    }
  };

  /**
   * Return the current unit system.
   * @return {string} The current unit system.
   */
  Unit.getUnitSystem = function() {
    for(var key in UNIT_SYSTEMS) {
      if(UNIT_SYSTEMS[key] === currentUnitSystem) {
        return key;
      }
    }
  };

  /**
   * Converters to convert from number to an other numeric type like BigNumber
   * or Fraction
   */
  Unit.typeConverters = {
    BigNumber: function (x) {
      return new type.BigNumber(x + ''); // stringify to prevent constructor error
    },

    Fraction: function (x) {
      return new type.Fraction(x);
    },

    Complex: function (x) {
      return x;
    },

    number: function (x) {
      return x;
    }
  };

  /**
   * Retrieve the right convertor function corresponding with the type
   * of provided exampleValue.
   *
   * @param {string} type   A string 'number', 'BigNumber', or 'Fraction'
   *                        In case of an unknown type,
   * @return {Function}
   */
  Unit._getNumberConverter = function (type) {
    if (!Unit.typeConverters[type]) {
      throw new TypeError('Unsupported type "' + type + '"');
    }

    return Unit.typeConverters[type];
  };

  // Add dimensions to each built-in unit
  for (var key in UNITS) {
    var unit = UNITS[key];
    unit.dimensions = unit.base.dimensions;
  }    

  // Create aliases
  for (var name in ALIASES) {
    if(ALIASES.hasOwnProperty(name)) {
      var unit = UNITS[ALIASES[name]];
      var alias = {};
      for(var key in unit) {
        if(unit.hasOwnProperty(key)) {
          alias[key] = unit[key];
        }
      }
      alias.name = name;
      UNITS[name] = alias;
    }
  }

  function assertUnitNameIsValid(name) {
    for(var i=0; i<name.length; i++) {
      var c = name.charAt(i);
       
      var isValidAlpha = function (p) {
        return /^[a-zA-Z]$/.test(p);
      };

      var isDigit = function (c) {
        return (c >= '0' && c <= '9');
      }

      if(i === 0 && !isValidAlpha(c))
        throw new Error('Invalid unit name (must begin with alpha character): "' + name + '"');

      if(i > 0 && !( isValidAlpha(c)
                  || isDigit(c)))
        throw new Error('Invalid unit name (only alphanumeric characters are allowed): "' + name + '"');

    }
  }

  /**
   * Wrapper around createUnitSingle.
   * Example: 
   *  createUnit({
   *    foo: { },
   *    bar: {
   *      definition: 'kg/foo',
   *      aliases: ['ba', 'barr', 'bars'],
   *      offset: 200
   *    },
   *    baz: '4 bar'
   *  }, 
   *  {
   *    override: true;
   *  });
   * @param {object} obj      Object map. Each key becomes a unit which is defined by its value.
   * @param {object} options
   */
  Unit.createUnit = function(obj, options) {
    
    if(typeof(obj) !== 'object') {
      throw new TypeError("createUnit expects first parameter to be of type 'Object'");
    }

    // Remove all units and aliases we are overriding
    if(options && options.override) {
      for(var key in obj) {
        if(obj.hasOwnProperty(key)) {
          Unit.deleteUnit(key);
        }
        if(obj[key].aliases) {
          for(var i=0; i<obj[key].aliases.length; i++) {
            Unit.deleteUnit(obj[key].aliases[i]);
          }
        }
      }
    }

    // TODO: traverse multiple times until all units have been added
    var lastUnit;
    for(var key in obj) {
      if(obj.hasOwnProperty(key)) {
        lastUnit = Unit.createUnitSingle(key, obj[key]);
      }
    }
    return lastUnit;
  };

  /**
   * Create a user-defined unit and register it with the Unit type.
   * Example: 
   *  createUnitSingle('knot', '0.514444444 m/s')
   *  createUnitSingle('acre', new Unit(43560, 'ft^2'))
   *
   * @param {string} name      The name of the new unit. Must be unique. Example: 'knot'
   * @param {string, Unit} definition      Definition of the unit in terms of existing units. For example, '0.514444444 m / s'.
   * @param {Object} options   (optional) An object containing any of the following properties:
   *     prefixes {string} "none", "short", "long", "binary_short", or "binary_long". The default is "none".
   *     aliases {Array} Array of strings. Example: ['knots', 'kt', 'kts']
   *     offset {Numeric} An offset to apply when converting from the unit. For example, the offset for celsius is 273.15 and the offset for farhenheit is 459.67. Default is 0.
   *
   * @return {Unit} 
   */
  Unit.createUnitSingle = function(name, obj, options) {

    if(typeof(obj) === 'undefined' || obj === null) {
      obj = {};
    }
    
    if(typeof(name) !== 'string') {
      throw new TypeError("createUnitSingle expects first parameter to be of type 'string'");
    }
   
    // Check collisions with existing units
    if(UNITS.hasOwnProperty(name)) {
      throw new Error('Cannot create unit "' + name + '": a unit with that name already exists');
    }

    // TODO: Validate name for collisions with other built-in functions (like abs or cos, for example), and for acceptable variable names. For example, '42' is probably not a valid unit. Nor is '%', since it is also an operator.

    assertUnitNameIsValid(name);

    var defUnit = null;   // The Unit from which the new unit will be created.
    var aliases = [];
    var offset = 0;
    var definition;
    var prefixes;
    if(obj && obj.type === 'Unit') {
      defUnit = obj.clone();
    }
    else if(typeof(obj) === 'string') {
      if(obj !== '') {
        definition = obj;
      }
    }
    else if(typeof(obj) === 'object') {
      definition = obj.definition;
      prefixes = obj.prefixes; 
      offset = obj.offset;
      if (obj.aliases) {
        aliases = obj.aliases.valueOf(); // aliases could be a Matrix, so convert to Array
      }
    }
    else {
      throw new TypeError('Cannot create unit "' + name + '" from "' + obj.toString() + '": expecting "string" or "Unit" or "Object"');
    }

    if(aliases) {
      for (var i=0; i<aliases.length; i++) {
        if(UNITS.hasOwnProperty(aliases[i])) {
          throw new Error('Cannot create alias "' + aliases[i] + '": a unit with that name already exists');
        }
      }
    }

    if(definition && typeof(definition) === 'string' && !defUnit) {
      try {
        defUnit = Unit.parse(definition, {allowNoUnits: true});
      }
      catch (ex) {
        ex.message = 'Could not create unit "' + name + '" from "' + definition + '": ' + ex.message;
        throw(ex);
      }
    }
    else if(definition && definition.type === 'Unit') {
      defUnit = definition.clone();
    }

    aliases = aliases || [];
    offset = offset || 0;
    if(prefixes && prefixes.toUpperCase) 
      prefixes = PREFIXES[prefixes.toUpperCase()] || PREFIXES.NONE;
    else
      prefixes = PREFIXES.NONE;


    // If defUnit is null, it is because the user did not
    // specify a defintion. So create a new base dimension.
    var newUnit = {};
    if(!defUnit) {
      // Add a new base dimension
      var baseName = name + "_STUFF";   // foo --> foo_STUFF, or the essence of foo
      if(BASE_DIMENSIONS.indexOf(baseName) >= 0) {
        throw new Error('Cannot create new base unit "' + name + '": a base unit with that name already exists (and cannot be overridden)');
      }
      BASE_DIMENSIONS.push(baseName);

      // Push 0 onto existing base units
      for(var b in BASE_UNITS) {
        if(BASE_UNITS.hasOwnProperty(b)) {
          BASE_UNITS[b].dimensions[BASE_DIMENSIONS.length-1] = 0;
        }
      }

      // Add the new base unit
      var newBaseUnit = { dimensions: [] };
      for(var i=0; i<BASE_DIMENSIONS.length; i++) {
        newBaseUnit.dimensions[i] = 0;
      }
      newBaseUnit.dimensions[BASE_DIMENSIONS.length-1] = 1;
      newBaseUnit.key = baseName;
      BASE_UNITS[baseName] = newBaseUnit;
       
      newUnit = {
        name: name,
        value: 1,
        dimensions: BASE_UNITS[baseName].dimensions.slice(0),
        prefixes: prefixes,
        offset: offset,
        base: baseName
      };

      currentUnitSystem[baseName] = {
        unit: newUnit,
        prefix: PREFIXES.NONE['']
      };

    }
    else {

      newUnit = {
        name: name,
        value: defUnit.value,
        dimensions: defUnit.dimensions.slice(0),
        prefixes: prefixes,
        offset: offset,
      };
      
      // Create a new base if no matching base exists
      var anyMatch = false;
      for(var i in BASE_UNITS) {
        if(BASE_UNITS.hasOwnProperty(i)) {
          var match = true;
          for(var j=0; j<BASE_DIMENSIONS.length; j++) {
            if (Math.abs((newUnit.dimensions[j] || 0) - (BASE_UNITS[i].dimensions[j] || 0)) > 1e-12) {
              match = false;
              break;
            }
          }
          if(match) {
            anyMatch = true;
            break;
          }
        }
      }
      if(!anyMatch) {
        var baseName = name + "_STUFF";   // foo --> foo_STUFF, or the essence of foo
        // Add the new base unit
        var newBaseUnit = { dimensions: defUnit.dimensions.slice(0) };
        newBaseUnit.key = baseName;
        BASE_UNITS[baseName] = newBaseUnit;

        currentUnitSystem[baseName] = {
          unit: newUnit,
          prefix: PREFIXES.NONE['']
        };

        newUnit.base = baseName;
      }
    }

    Unit.UNITS[name] = newUnit;

    for (var i=0; i<aliases.length; i++) {
      var aliasName = aliases[i];
      var alias = {};
      for(var key in newUnit) {
        if(newUnit.hasOwnProperty(key)) {
          alias[key] = newUnit[key];
        }
      }
      alias.name = aliasName;
      Unit.UNITS[aliasName] = alias;
    }

    return new Unit(null, name);
  };

  Unit.deleteUnit = function(name) {
    delete Unit.UNITS[name];
  };

  // expose arrays with prefixes, dimensions, units, systems
  Unit.PREFIXES = PREFIXES;
  Unit.BASE_DIMENSIONS = BASE_DIMENSIONS;
  Unit.BASE_UNITS = BASE_UNITS;
  Unit.UNIT_SYSTEMS = UNIT_SYSTEMS;
  Unit.UNITS = UNITS;

  return Unit;
}

exports.name = 'Unit';
exports.path = 'type';
exports.factory = factory;
exports.math = true; // request access to the math namespace
