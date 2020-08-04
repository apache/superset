var assert = require('assert');
var math = require('../../../../index');
var splitUnit = math.splitUnit;
var Unit = math.type.Unit;

describe('splitUnit', function() {
    it('should split a unit into parts', function() {
      assert.equal(splitUnit(new Unit(1, 'm'), ['ft', 'in']).toString(), "3 ft,3.3700787401574765 in");
      assert.equal(splitUnit(new Unit(-1, 'm'), ['ft', 'in']).toString(), "-3 ft,-3.3700787401574765 in");
      assert.equal(splitUnit(new Unit(1, 'm/s'), ['m/s']).toString(), "1 m / s");

      assert.equal(math.eval('splitUnit(1 m, [ft, in])').toString(), "3 ft,3.3700787401574765 in");
    });
});
