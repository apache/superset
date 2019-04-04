var assert = require('assert');
var approx = require('../../../tools/approx');
var math = require('../../../index');
var Unit = math.type.Unit;

describe('Unit', function() {

  describe('constructor', function() {

    it('should create unit correctly', function() {
      var unit1 = new Unit(5000, 'cm');
      assert.equal(unit1.value, 50);
      assert.equal(unit1.units[0].unit.name, 'm');

      unit1 = new Unit(5, 'kg');
      assert.equal(unit1.value, 5);
      assert.equal(unit1.units[0].unit.name, 'g');

      unit1 = new Unit(null, 'kg');
      assert.equal(unit1.value, null);
      assert.equal(unit1.units[0].unit.name, 'g');

      unit1 = new Unit(10, 'Hz');
      assert.equal(unit1.value, 10);
      assert.equal(unit1.units[0].unit.name, 'Hz');

      unit1 = new Unit(9.81, "kg m/s^2");
      assert.equal(unit1.value, 9.81);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[1].unit.name, 'm');
      assert.equal(unit1.units[2].unit.name, 's');
    });

    it('should create a unit with Fraction value', function () {
      var unit1 = new Unit(math.fraction(1000, 3), 'cm');
      assert.deepEqual(unit1.value, math.fraction(10,3));
      assert.equal(unit1.units[0].unit.name, 'm');
    });

    it('should create a unit with BigNumber value', function () {
      var unit1 = new Unit(math.bignumber(5000), 'cm');
      assert.deepEqual(unit1.value, math.bignumber(50));
      assert.equal(unit1.units[0].unit.name, 'm');
    });

    it('should create a unit with Complex value', function () {
      var unit1 = new Unit(math.complex(500, 600), 'cm');
      assert.deepEqual(unit1.value, math.complex(5, 6));
      assert.equal(unit1.units[0].unit.name, 'm');
    });

    it('should create square meter correctly', function() {
      var unit1 = new Unit(0.000001, 'km2');
      assert.equal(unit1.value, 1);
      assert.equal(unit1.units[0].unit.name, 'm2');
    });

    it('should create cubic meter correctly', function() {
      var unit1 = new Unit(0.000000001, 'km3');
      assert.equal(unit1.value, 1);
      assert.equal(unit1.units[0].unit.name, 'm3');
    });

    it('should ignore properties on Object.prototype', function() {
      Object.prototype.foo = Unit.UNITS['meter'];

      assert.throws(function () {new Unit(1, 'foo')}, /Unit "foo" not found/);

      delete Object.prototype.foo;
    });

    it('should throw an error if called without new keyword', function() {
      assert.throws(function () {
        Unit(2, 'inch');
      });
    });

    it('should throw an error if called with wrong type of arguments', function() {
      assert.throws(function () { new Unit('24', 'inch'); });
      assert.throws(function () { new Unit(0, 'bla'); });
      assert.throws(function () { new Unit(4, ''); });
      assert.throws(function () { new Unit(0, 3); });
    });

  it('should flag unit as already simplified', function() {
      unit1 = new Unit(9.81, "kg m/s^2");
    assert.equal(unit1.isUnitListSimplified, true);
    assert.equal(unit1.toString(), "9.81 (kg m) / s^2");

      unit1 = new Unit(null, "kg m/s^2");
    assert.equal(unit1.isUnitListSimplified, true);
    assert.equal(unit1.toString(), "(kg m) / s^2");
  });

  });

  describe('isValuelessUnit', function() {

    it('should return true if the string is a plain unit', function() {
      assert.equal(Unit.isValuelessUnit('cm'), true);
      assert.equal(Unit.isValuelessUnit('inch'), true);
      assert.equal(Unit.isValuelessUnit('kb'), true);
    });

    it('should return false if the unit is not a plain unit', function() {
      assert.equal(Unit.isValuelessUnit('bla'), false);
      assert.equal(Unit.isValuelessUnit('5cm'), false);
    });

  });

  describe('type', function() {

    it('should have a property isUnit', function () {
      var a = new math.type.Unit(5, 'cm');
      assert.strictEqual(a.isUnit, true);
    });

    it('should have a property type', function () {
      var a = new math.type.Unit(5, 'cm');
      assert.strictEqual(a.type, 'Unit');
    });

  });

  describe('hasBase', function() {

    it('should test whether a unit has a certain base unit', function() {
      assert.equal(new Unit(5, 'cm').hasBase(Unit.BASE_UNITS.ANGLE), false);
      assert.equal(new Unit(5, 'cm').hasBase(Unit.BASE_UNITS.LENGTH), true);
      assert.equal(new Unit(5, 'kg m / s ^ 2').hasBase(Unit.BASE_UNITS.FORCE), true);
    });

  });

  describe('equalBase', function() {

    it('should test whether two units have the same base unit', function() {
      assert.equal(new Unit(5, 'cm').equalBase(new Unit(10, 'm')), true);
      assert.equal(new Unit(5, 'cm').equalBase(new Unit(10, 'kg')), false);
      assert.equal(new Unit(5, 'N').equalBase(new Unit(10, 'kg m / s ^ 2')), true);
      assert.equal(new Unit(8.314, 'J / mol K').equalBase(new Unit(0.02366, 'ft^3 psi / mol degF')), true);
    });

  });

  describe('equals', function() {

    it('should test whether two units are equal', function() {
      assert.equal(new Unit(100, 'cm').equals(new Unit(1, 'm')), true);
      assert.equal(new Unit(100, 'cm').equals(new Unit(2, 'm')), false);
      assert.equal(new Unit(100, 'cm').equals(new Unit(1, 'kg')), false);
      assert.equal(new Unit(100, 'ft lbf').equals(new Unit(1200, 'in lbf')), true);
      assert.equal(new Unit(100, 'N').equals(new Unit(100, 'kg m / s ^ 2')), true);
      assert.equal(new Unit(100, 'N').equals(new Unit(100, 'kg m / s')), false);
      assert.equal(new Unit(100, 'Hz').equals(new Unit (100, 's ^ -1')), true);
    });

    it('should test whether two units with Fractions are equal', function() {
      assert.equal(new Unit(math.fraction(100), 'cm').equals(new Unit(math.fraction(1), 'm')), true);
      assert.equal(new Unit(math.fraction(100), 'cm').equals(new Unit(math.fraction(2), 'm')), false);
    });

    it('should test whether two units with a Fraction and a number are equal', function() {
      assert.equal(new Unit(math.fraction(100), 'cm').equals(new Unit(1, 'm')), true);
      assert.equal(new Unit(100, 'cm').equals(new Unit(math.fraction(2), 'm')), false);
    });

    it('should test whether two Complex units are equal', function() {
      assert.equal(new Unit(math.complex(3, 4), 'km').equals(new Unit(math.complex(3000, 4000), 'm')), true);
      assert.equal(new Unit(math.complex(3, 4), 'km').equals(new Unit(math.complex(3000, 10), 'm')), false);
    });

    it('should test whether a Complex unit and a unit with a number are equal', function() {
      assert.equal(new Unit(math.complex(3, 0), 'km').equals(new Unit(3000, 'm')), true);
      assert.equal(new Unit(math.complex(3, 4), 'km').equals(new Unit(3000, 'm')), false);
    });

  });

  describe('clone', function() {

    it('should clone a unit', function() {
      var u1 = new Unit(100, 'cm');
      var u2 = u1.clone();
      assert(u1 !== u2);
      assert.deepEqual(u1, u2);

      var u3 = new Unit(100, 'cm').to('inch');
      var u4 = u3.clone();
      assert(u3 !== u4);
      assert.deepEqual(u3, u4);

      var u5 = new Unit(null, 'cm').to('inch');
      var u6 = u5.clone();
      assert(u5 !== u6);
      assert.deepEqual(u5, u6);

      var u7 = new Unit(8.314, 'kg m^2 / s^2 K mol');
      var u8 = u7.clone();
      assert(u7 !== u8);
      assert.deepEqual(u7, u8);

    });

    it('should clone a with a Fraction', function() {
      var u1 = new Unit(math.fraction(1,3), 'cm');
      var u2 = u1.clone();
      assert(u1 !== u2);
      assert.deepEqual(u1, u2);
      assert(u1.value !== u2.value); // should be cloned
    });

    it('should clone a Complex unit', function() {
      var u1 = new Unit(math.complex(1,3), 'cm');
      var u2 = u1.clone();
      assert(u1 !== u2);
      assert.deepEqual(u1, u2);
      assert(u1.value !== u2.value); // should be cloned
    });

  });

  describe('toNumber', function() {
    it ('should convert a unit to a number', function () {
      var u = new Unit(5000, 'cm');
      approx.equal(u.toNumber('mm'), 50000);

      approx.equal(new Unit(5.08, 'cm').toNumber('inch'), 2);

      approx.equal(new Unit(101325, 'N/m^2').toNumber('lbf/in^2'), 14.6959487763741);
    });

    it ('should convert a unit with fixed prefix to a number', function () {
      var u1 = new Unit(5000, 'cm');
      var u2 = u1.to('km');
      approx.equal(u2.toNumber('mm'), 50000);

      var u1 = new Unit(981, 'cm/s^2');
      var u2 = u1.to('km/ms^2');
      approx.equal(u2.toNumber('m/s^2'), 9.81);
    });

    it ('should convert a unit with fraction to a number', function () {
      var u = new Unit(math.fraction(5), 'cm');
      assert.strictEqual(u.toNumber('mm'), 50);
    });
  });

  describe('toNumeric', function() {
    it ('should convert a unit to a numeric value', function () {
      var u = new Unit(math.fraction(1,3), 'cm');
      assert.deepEqual(u.toNumeric('mm'), math.fraction(10,3));
    });
    it ('should simplify units before returning a numeric value', function () {
      var cm = new Unit(1, 'gram');
      var m = new Unit(1, 'kilogram');
      var product = cm.multiply(m)
      assert.deepEqual(product.toNumeric(), 0.001);
    });
  });

  describe('to', function() {

    it ('should convert a unit to a fixed unitName', function () {
      var u1 = new Unit(5000, 'cm');
      assert.equal(u1.value, 50);
      assert.equal(u1.units[0].unit.name, 'm');
      assert.equal(u1.units[0].prefix.name, 'c');
      assert.equal(u1.fixPrefix, false);

      var u2 = u1.to('inch');
      assert.notStrictEqual(u1, u2); // u2 must be a clone
      assert.equal(u2.value, 50);
      assert.equal(u2.units[0].unit.name, 'inch');
      assert.equal(u2.units[0].prefix.name, '');
      assert.equal(u2.fixPrefix, true);

      var u3 = new Unit(299792.458, 'km/s');
      assert.equal(u3.value, 299792458);
      assert.equal(u3.units[0].unit.name, 'm');
      assert.equal(u3.units[1].unit.name, 's');
      assert.equal(u3.units[0].prefix.name, 'k');
      assert.equal(u3.fixPrefix, false);

      var u4 = u3.to('mi/h');
      assert.notStrictEqual(u3, u4); // u4 must be a clone
      assert.equal(u4.value, 299792458);
      assert.equal(u4.units[0].unit.name, 'mi');
      assert.equal(u4.units[1].unit.name, 'h');
      assert.equal(u4.units[0].prefix.name, '');
      assert.equal(u4.fixPrefix, true);
    });

    it ('should convert a unit with a fraction', function () {
      var u1 = new Unit(math.fraction(1,3), 'm');

      var u2 = u1.to('cm');
      assert.deepEqual(u2.value, math.fraction(1,3));
      assert(math.type.isFraction(u2.value));
      assert.equal(u2.units[0].unit.name, 'm');
      assert.equal(u2.units[0].prefix.name, 'c');
      assert.equal(u2.fixPrefix, true);
    });

    it ('should convert a Complex unit', function() {
      var u1 = new Unit(math.complex(300,400), 'kPa');
      var u2 = u1.to('lbf/in^2');
      approx.deepEqual(u2.value, math.complex(300000, 400000));
      assert.deepEqual(u2.toString(), "(43.511321319062766 + 58.01509509208368i) lbf / in^2");
    });

    it ('should convert a unit to a fixed unit', function () {
      var u1 = new Unit(5000, 'cm');
      assert.equal(u1.value, 50);
      assert.equal(u1.units[0].unit.name, 'm');
      assert.equal(u1.units[0].prefix.name, 'c');
      assert.equal(u1.fixPrefix, false);

      var u2 = u1.to(new Unit(null, 'km'));
      assert.notStrictEqual(u1, u2); // u2 must be a clone
      assert.equal(u2.value, 50);
      assert.equal(u2.units[0].unit.name, 'm');
      assert.equal(u2.units[0].prefix.name, 'k');
      assert.equal(u2.fixPrefix, true);

      var u1 = new Unit(5000, 'cm/s');
      assert.equal(u1.value, 50);
      assert.equal(u1.units[0].unit.name, 'm');
      assert.equal(u1.units[1].unit.name, 's');
      assert.equal(u1.units[0].prefix.name, 'c');
      assert.equal(u1.fixPrefix, false);

      var u2 = u1.to(new Unit(null, 'km/h'));
      assert.notStrictEqual(u1, u2); // u2 must be a clone
      assert.equal(u2.value, 50);
      assert.equal(u2.units[0].unit.name, 'm');
      assert.equal(u2.units[1].unit.name, 'h');
      assert.equal(u2.units[0].prefix.name, 'k');
      assert.equal(u2.fixPrefix, true);
    });

    it ('should convert a valueless unit', function () {
      var u1 = new Unit(null, 'm');
      assert.equal(u1.value, null);
      assert.equal(u1.units[0].unit.name, 'm');
      assert.equal(u1.units[0].prefix.name, '');
      assert.equal(u1.fixPrefix, false);

      var u2 = u1.to(new Unit(null, 'cm'));
      assert.notStrictEqual(u1, u2); // u2 must be a clone
      assert.equal(u2.value, 1);     // u2 must have a value
      assert.equal(u2.units[0].unit.name, 'm');
      assert.equal(u2.units[0].prefix.name, 'c');
      assert.equal(u2.fixPrefix, true);

      var u1 = new Unit(null, 'm/s');
      assert.equal(u1.value, null);
      assert.equal(u1.units[0].unit.name, 'm');
      assert.equal(u1.units[1].unit.name, 's');
      assert.equal(u1.units[0].prefix.name, '');
      assert.equal(u1.fixPrefix, false);

      var u2 = u1.to(new Unit(null, 'cm/s'));
      assert.notStrictEqual(u1, u2); // u2 must be a clone
      assert.equal(u2.value, 1);     // u2 must have a value
      assert.equal(u2.units[0].unit.name, 'm');
      assert.equal(u2.units[1].unit.name, 's');
      assert.equal(u2.units[0].prefix.name, 'c');
      assert.equal(u2.fixPrefix, true);
    });

    it ('should convert a binary prefixes (1)', function () {
      var u1 = new Unit(1, 'Kib');
      assert.equal(u1.value, 1024);
      assert.equal(u1.units[0].unit.name, 'b');
      assert.equal(u1.units[0].prefix.name, 'Ki');
      assert.equal(u1.fixPrefix, false);

      var u2 = u1.to(new Unit(null, 'b'));
      assert.notStrictEqual(u1, u2); // u2 must be a clone
      assert.equal(u2.value, 1024);     // u2 must have a value
      assert.equal(u2.units[0].unit.name, 'b');
      assert.equal(u2.units[0].prefix.name, '');
      assert.equal(u2.fixPrefix, true);

      var u1 = new Unit(1, 'Kib/s');
      assert.equal(u1.value, 1024);
      assert.equal(u1.units[0].unit.name, 'b');
      assert.equal(u1.units[1].unit.name, 's');
      assert.equal(u1.units[0].prefix.name, 'Ki');
      assert.equal(u1.fixPrefix, false);

      var u2 = u1.to(new Unit(null, 'b/s'));
      assert.notStrictEqual(u1, u2); // u2 must be a clone
      assert.equal(u2.value, 1024);     // u2 must have a value
      assert.equal(u2.units[0].unit.name, 'b');
      assert.equal(u2.units[1].unit.name, 's');
      assert.equal(u2.units[0].prefix.name, '');
      assert.equal(u2.fixPrefix, true);
    });

    it ('should convert a binary prefixes (2)', function () {
      var u1 = new Unit(1, 'kb');
      assert.equal(u1.value, 1000);
      assert.equal(u1.units[0].unit.name, 'b');
      assert.equal(u1.units[0].prefix.name, 'k');
      assert.equal(u1.fixPrefix, false);

      var u2 = u1.to(new Unit(null, 'b'));
      assert.notStrictEqual(u1, u2); // u2 must be a clone
      assert.equal(u2.value, 1000);     // u2 must have a value
      assert.equal(u2.units[0].unit.name, 'b');
      assert.equal(u2.units[0].prefix.name, '');
      assert.equal(u2.fixPrefix, true);
    });

    it ('should set isUnitListSimplified to true', function () {
      var u1 = new Unit(1, 'ft lbf');
      var u2 = u1.to('in lbf');
      assert.equal(u2.isUnitListSimplified, true);
      assert.equal(u2.toString(), "12 in lbf");
    });

    it ('should throw an error when converting to an incompatible unit', function () {
      var u1 = new Unit(5000, 'cm');
      assert.throws(function () {u1.to('kg')}, /Units do not match/);
      var u1 = new Unit(5000, 'N s');
      assert.throws(function () {u1.to('kg^5 / s')}, /Units do not match/);
    });

    it ('should throw an error when converting to a unit having a value', function () {
      var u1 = new Unit(5000, 'cm');
      assert.throws(function () {u1.to(new Unit(4, 'm'))}, /Cannot convert to a unit with a value/);
    });

    it ('should throw an error when converting to an unsupported type of argument', function () {
      var u1 = new Unit(5000, 'cm');
      assert.throws(function () {u1.to(new Date())}, /String or Unit expected as parameter/);
    });
  });

  describe('toString', function() {

    it('should convert to string properly', function() {
      assert.equal(new Unit(5000, 'cm').toString(), '50 m');
      assert.equal(new Unit(5, 'kg').toString(), '5 kg');
      assert.equal(new Unit(2/3, 'm').toString(), '0.6666666666666666 m');
      assert.equal(new Unit(5, 'N').toString(), '5 N');
      assert.equal(new Unit(5, 'kg^1.0e0 m^1.0e0 s^-2.0e0').toString(), '5 (kg m) / s^2');
      assert.equal(new Unit(5, 's^-2').toString(), '5 s^-2');
      assert.equal(new Unit(5, 'm / s ^ 2').toString(), '5 m / s^2');
      assert.equal(new Unit(null, 'kg m^2 / s^2 / mol').toString(), '(kg m^2) / (s^2 mol)');
      assert.equal(new Unit(10, 'hertz').toString(), '10 hertz');
    });

    it('should render with the best prefix', function() {
      assert.equal(new Unit(0.000001 ,'m').format(8), '1 um');
      assert.equal(new Unit(0.00001 ,'m').format(8), '10 um');
      assert.equal(new Unit(0.0001 ,'m').format(8), '100 um');
      assert.equal(new Unit(0.0005 ,'m').format(8), '500 um');
      assert.equal(new Unit(0.0006 ,'m').toString(), '0.6 mm');
      assert.equal(new Unit(0.001 ,'m').toString(), '1 mm');
      assert.equal(new Unit(0.01 ,'m').toString(), '10 mm');
      assert.equal(new Unit(100000 ,'m').toString(), '100 km');
      assert.equal(new Unit(300000 ,'m').toString(), '300 km');
      assert.equal(new Unit(500000 ,'m').toString(), '500 km');
      assert.equal(new Unit(600000 ,'m').toString(), '0.6 Mm');
      assert.equal(new Unit(1000000 ,'m').toString(), '1 Mm');
      assert.equal(new Unit(2000 ,'ohm').toString(), '2 kohm');
    });

    it('should keep the original prefix when in range', function() {
      assert.equal(new Unit(0.0999 ,'m').toString(), '99.9 mm');
      assert.equal(new Unit(0.1 ,'m').toString(), '0.1 m');
      assert.equal(new Unit(0.5 ,'m').toString(), '0.5 m');
      assert.equal(new Unit(0.6 ,'m').toString(), '0.6 m');
      assert.equal(new Unit(1 ,'m').toString(), '1 m');
      assert.equal(new Unit(10 ,'m').toString(), '10 m');
      assert.equal(new Unit(100 ,'m').toString(), '100 m');
      assert.equal(new Unit(300 ,'m').toString(), '300 m');
      assert.equal(new Unit(500 ,'m').toString(), '500 m');
      assert.equal(new Unit(600 ,'m').toString(), '600 m');
      assert.equal(new Unit(1000 ,'m').toString(), '1000 m');
      assert.equal(new Unit(1001 ,'m').toString(), '1.001 km');
    });

    it('should render best prefix for a single unit raised to integral power', function() {
      assert.equal(new Unit(3.2e7, 'm^2').toString(), "32 km^2");
      assert.equal(new Unit(3.2e-7, 'm^2').toString(), "0.32 mm^2");
      assert.equal(new Unit(15000, 'm^-1').toString(), "15 mm^-1");
      assert.equal(new Unit(3e-9, 'm^-2').toString(), "3000 Mm^-2");
      assert.equal(new Unit(3e-9, 'm^-1.5').toString(), "3e-9 m^-1.5");
      assert.equal(new Unit(2, 'kg^0').toString(), "2");
    });

    it('should not render best prefix if "fixPrefix" is set', function() {
      var u = new Unit(5e-3, 'm');
      u.fixPrefix = true;
      assert.equal(u.toString(), "0.005 m");
      u.fixPrefix = false;
      assert.equal(u.toString(), "5 mm");
    });

    it('should convert a unit with Fraction to string properly', function() {
      assert.equal(new Unit(math.fraction(9/10), 'mm').toString(), '9/10 mm');
    });

    it('should convert a Complex unit to string properly', function() {
      assert.equal(new Unit(math.complex(-1,-2), 'J / (mol K)').toString(), '(-1 - 2i) J / (mol K)');
    });
  });

  describe('simplifyUnitListLazy', function() {
    it('should not simplify units created with new Unit()', function() {
      var unit1 = new Unit(10, "kg m/s^2");
      assert.equal(unit1.units[0].unit.name, "g");
      assert.equal(unit1.units[1].unit.name, "m");
      assert.equal(unit1.units[2].unit.name, "s");
      assert.equal(unit1.toString(), "10 (kg m) / s^2");
    });

    it('should only simplify units with values', function() {
      var unit1 = new Unit(null, "kg m mol / s^2 / mol");
      unit1.isUnitListSimplified = false;
      unit1.simplifyUnitListLazy();
      assert.equal(unit1.toString(), "(kg m mol) / (s^2 mol)");
      unit1 = math.multiply(unit1, 1);
      assert.equal(unit1.toString(), "1 N");
    });

    it('should simplify units resulting from multiply/divide/power functions only when formatting for output', function() {
      var unit1 = new Unit(2, "kg");
      var unit2 = new Unit(5, "m/s^2");
      var unit3 = math.multiply(unit1, unit2);
      assert.equal(unit3.units[0].unit.name, "g");
      assert.equal(unit3.units[1].unit.name, "m");
      assert.equal(unit3.units[2].unit.name, "s");
      assert.equal(unit3.toString(), "10 N");    // Triggers simplification
      assert.equal(unit3.units[0].unit.name, "N");

    });

    it('should simplify units when they cancel out with {predictable: true}', function() {
      var origConfig = math.config();
      math.config({predictable: true});
      var unit1 = new Unit (2, "Hz");
      var unit2 = new Unit(2, "s");
      var unit3 = math.multiply(unit1, unit2);
      assert.equal(unit3.toString(), "4");
      assert.equal(unit3.units.length, 0);

      var nounit = math.eval('40m * 40N / (40J)');
      assert.equal(nounit.toString(), "40");
      assert.equal(nounit.units.length, 0);

      var a = math.unit('3 s^-1');
      var b = math.unit('4 s');
      assert.equal(math.multiply(a, b).type, 'Unit');

      var c = math.unit('8.314 J / mol / K');
      assert.equal(math.pow(c, 0).type, 'Unit');

      var d = math.unit('60 minute');
      var e = math.unit('1 s');
      assert.equal(math.divide(d, e).type, 'Unit');

      math.config(origConfig);
    })

    it('should convert units to appropriate _numeric_ values when they cancel out with {predictable: false}', function() {
      var origConfig = math.config();
      math.config({predictable: false});

      assert.equal(typeof(math.eval('40 m * 40 N / (40 J)')), 'number');

      var bigunit = math.unit(math.bignumber(1), 'km');
      var smallunit = math.unit(math.bignumber(3000000), 'mm');
      var verybignumber = math.divide(bigunit, smallunit);
      assert.equal(verybignumber.type, 'BigNumber');
      assert.equal(verybignumber.toString(), '0.3333333333333333333333333333333333333333333333333333333333333333');

      bigunit = math.unit(math.fraction(1), 'km');
      smallunit = math.unit(math.fraction(3000000), 'mm');
      verybignumber = math.divide(bigunit, smallunit);
      assert.equal(verybignumber.type, 'Fraction');
      assert.equal(verybignumber.toFraction(), '1/3');

      var a = math.unit('3 s^-1');
      var b = math.unit('4 s');
      assert.equal(typeof(math.multiply(a, b)), 'number');

      var c = math.unit('8.314 J / mol / K');
      assert.equal(typeof(math.pow(c, 0)), 'number');

      var d = math.unit('60 minute');
      var e = math.unit('1 s');
      assert.equal(typeof(math.divide(d, e)), 'number');

      math.config(origConfig);
    });

    it('should simplify units according to chosen unit system', function() {
      var unit1 = new Unit(10, "N");
      Unit.setUnitSystem('us');
      unit1.isUnitListSimplified = false;
      assert.equal(unit1.toString(), "2.248089430997105 lbf");
      assert.equal(unit1.units[0].unit.name, "lbf");

      Unit.setUnitSystem('cgs');
      unit1.isUnitListSimplified = false;
      assert.equal(unit1.format(2), "1 Mdyn");
      assert.equal(unit1.units[0].unit.name, "dyn");
    });

    it('should correctly simplify units when unit system is "auto"', function() {
      Unit.setUnitSystem('auto');
      var unit1 = new Unit(5, "lbf min / s");
      unit1.isUnitListSimplified = false;
      assert.equal(unit1.toString(), "300 lbf");
    });

  
  });

  describe('valueOf', function() {

    it('should return string representation when calling valueOf', function() {
      assert.strictEqual(new Unit(5000, 'cm').valueOf(), '50 m');
      assert.strictEqual(new Unit(5, 'kg').valueOf(), '5 kg');
      assert.strictEqual(new Unit(2/3, 'm').valueOf(), '0.6666666666666666 m');
      assert.strictEqual(new Unit(5, 'N').valueOf(), '5 N');
      assert.strictEqual(new Unit(5, 'kg^1.0e0 m^1.0e0 s^-2.0e0').valueOf(), '5 (kg m) / s^2');
      assert.strictEqual(new Unit(5, 's^-2').valueOf(), '5 s^-2');
    });

  });

  describe('json', function () {

    it('toJSON', function () {
      assert.deepEqual(new Unit(5, 'cm').toJSON(),
          {'mathjs': 'Unit', value: 5, unit: 'cm', fixPrefix: false});
      assert.deepEqual(new Unit(5, 'cm').to('mm').toJSON(),
          {'mathjs': 'Unit', value: 50, unit: 'mm', fixPrefix: true});
      assert.deepEqual(new Unit(5, 'kN').to('kg m s ^ -2').toJSON(),
          {'mathjs': 'Unit', value: 5000, unit: '(kg m) / s^2', fixPrefix: true});
      assert.deepEqual(new Unit(math.fraction(0.375), 'cm').toJSON(),
          {
            mathjs: 'Unit',
            value: math.fraction(0.375), // Note that value is not serialized at this point, that will be done by JSON.stringify
            unit: 'cm',
            fixPrefix: false
          });
      approx.deepEqual(new Unit(math.complex(2, 4), 'g').toJSON(),
          {
            mathjs: 'Unit',
            value: math.complex(2, 4),
            unit: 'g',
            fixPrefix: false
          });

      var str = JSON.stringify(new Unit(math.fraction(0.375), 'cm'));
      assert.deepEqual(str, '{"mathjs":"Unit","value":{"mathjs":"Fraction","n":3,"d":8},"unit":"cm","fixPrefix":false}');

      var cmpx = JSON.stringify(new Unit(math.complex(2, 4), 'g'));
      assert.equal(cmpx, '{"mathjs":"Unit","value":{"mathjs":"Complex","re":2,"im":4},"unit":"g","fixPrefix":false}');
    });

    it('fromJSON', function () {
      var u1 = new Unit(5, 'cm');
      var u2 = Unit.fromJSON({'mathjs': 'Unit', value: 5, unit: 'cm', fixPrefix: false});
      assert.ok(u2 instanceof Unit);
      assert.deepEqual(u2, u1);

      var u3 = new Unit(5, 'cm').to('mm');
      var u4 = Unit.fromJSON({'mathjs': 'Unit', value: 50, unit: 'mm', fixPrefix: true});
      assert.ok(u4 instanceof Unit);
      assert.deepEqual(u4, u3);

      var u5 = new Unit(5, 'kN').to('kg m/s^2');
      var u6 = Unit.fromJSON({'mathjs': 'Unit', value: 5000, unit: 'kg m s^-2', fixPrefix: true});
      assert.ok(u6 instanceof Unit);
      assert.deepEqual(u5, u6);

      var u7 = Unit.fromJSON({
        mathjs: 'Unit',
        value: math.fraction(0.375), // Note that value is already a Fraction at this point, that will be done by JSON.parse(str, reviver)
        unit: 'cm',
        fixPrefix: false
      });
      assert.deepEqual(u7, new Unit(math.fraction(0.375), 'cm'))

      var u8 = Unit.fromJSON({
        mathjs: 'Unit',
        value: math.complex(2, 4),
        unit: 'g',
        fixPrefix: false
      });
      assert.deepEqual(u8, new Unit(math.complex(2,4), 'g'));
    });

    it('toJSON -> fromJSON should recover an "equal" unit', function() {
      var unit1 = Unit.parse('1.23(m/(s/(kg mol)/(lbm/h)K))');
      var unit2 = Unit.fromJSON(unit1.toJSON());
      assert.equal(unit1.equals(unit2), true);
    });

  });

  describe('format', function () {

    it('should format units with given precision', function() {
      assert.equal(new Unit(2/3, 'm').format(3), '0.667 m');
      assert.equal(new Unit(2/3, 'm').format(4), '0.6667 m');
      assert.equal(new Unit(2/3, 'm').format(), '0.6666666666666666 m');
    });

    it('should format a unit without value', function() {
      assert.equal(new Unit(null, 'cm').format(), 'cm');
      assert.equal(new Unit(null, 'm').format(), 'm');
      assert.equal(new Unit(null, 'kg m/s').format(), '(kg m) / s');
    });

    it('should format a unit with fixed prefix and without value', function() {
      assert.equal(new Unit(null, 'km').to('cm').format(), '1e+5 cm');
      assert.equal(new Unit(null, 'inch').to('cm').format(), '2.54 cm');
      assert.equal(new Unit(null, 'N/m^2').to('lbf/inch^2').format(5), '1.4504e-4 lbf / inch^2');
    });

    it('should format a unit with a bignumber', function() {
      assert.equal(new Unit(math.bignumber(1).plus(1e-24), 'm').format(), '1.000000000000000000000001 m');
      assert.equal(new Unit(math.bignumber(1e24).plus(1), 'm').format(), '1.000000000000000000000001 Ym');
    });

    it('should format a unit with a fraction', function() {
      assert.equal(new Unit(math.fraction(4/5), 'm').format(), '4/5 m');
    });

    it('should format a Complex unit', function() {
      assert.equal(new Unit(math.complex(-2, 4.5), 'mm').format(14), '(-2 + 4.5i) mm');
    });

    it('should format units with VA and VAR correctly', function() {
      assert.equal(math.eval('4000 VAR + 3000 VA').format(), "(3 + 4i) kVA");
      assert.equal(math.eval('3000 VA + 4000 VAR').format(), "(3 + 4i) kVA");
      assert.equal(math.eval('4000 VAR').format(), "(4) kVAR");
      assert.equal(math.eval('4000i VA').format(), "(4) kVAR");
      assert.equal(math.eval('4000i VAR').format(), "(-4) kVA");
      assert.equal(math.eval('abs(4000 VAR + 3000 VA)').format(), "5 kW");
      assert.equal(math.eval('abs(3000 VA + 4000 VAR)').format(), "5 kW");
      assert.equal(math.eval('abs(4000 VAR)').format(), "4 kW");
      assert.equal(math.eval('abs(4000i VA)').format(), "4 kW");
      assert.equal(math.eval('abs(4000i VAR)').format(), "4 kW");
    });

    it('should ignore properties in Object.prototype when finding the best prefix', function() {
      Object.prototype.foo = 'bar';

      assert.equal(new Unit(5e5, 'cm').format(), '5 km');

      delete Object.prototype.foo;
    });

  });

  describe('parse', function() {

    it('should parse units correctly', function() {
      var unit1;

      unit1 = Unit.parse('5kg');
      assert.equal(unit1.value, 5);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse('5 kg');
      assert.equal(unit1.value, 5);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse(' 5 kg ');
      assert.equal(unit1.value, 5);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse('5e-3kg');
      assert.equal(unit1.value, 0.005);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse('5e+3kg');
      assert.equal(unit1.value, 5000);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse('5e3kg');
      assert.equal(unit1.value, 5000);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse('-5kg');
      assert.equal(unit1.value, -5);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse('+5kg');
      assert.equal(unit1.value, 5);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse('.5kg');
      assert.equal(unit1.value, .5);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse('-5mg');
      approx.equal(unit1.value, -0.000005);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[0].prefix.name, 'm');

      unit1 = Unit.parse('5.2mg');
      approx.equal(unit1.value, 0.0000052);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[0].prefix.name, 'm');

      unit1 = Unit.parse('300 kg/minute');
      approx.equal(unit1.value, 5);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[1].unit.name, 'minute');
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse('981 cm/s^2');
      approx.equal(unit1.value, 9.81);
      assert.equal(unit1.units[0].unit.name, 'm');
      assert.equal(unit1.units[1].unit.name, 's');
      assert.equal(unit1.units[1].power, -2);
      assert.equal(unit1.units[0].prefix.name, 'c');

      unit1 = Unit.parse('981 cm*s^-2');
      approx.equal(unit1.value, 9.81);
      assert.equal(unit1.units[0].unit.name, 'm');
      assert.equal(unit1.units[1].unit.name, 's');
      assert.equal(unit1.units[1].power, -2);
      assert.equal(unit1.units[0].prefix.name, 'c');

      unit1 = Unit.parse('8.314 kg m^2 / s^2 / K / mol');
      approx.equal(unit1.value, 8.314);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[1].unit.name, 'm');
      assert.equal(unit1.units[2].unit.name, 's');
      assert.equal(unit1.units[3].unit.name, 'K');
      assert.equal(unit1.units[4].unit.name, 'mol');
      assert.equal(unit1.units[0].power, 1);
      assert.equal(unit1.units[1].power, 2);
      assert.equal(unit1.units[2].power, -2);
      assert.equal(unit1.units[3].power, -1);
      assert.equal(unit1.units[4].power, -1);
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse('5exabytes');
      approx.equal(unit1.value, 4e19);
      assert.equal(unit1.units[0].unit.name, 'bytes');
    });

    it('should parse expressions with nested parentheses correctly', function() {
      unit1 = Unit.parse('8.314 kg (m^2 / (s^2 / (K^-1 / mol)))');
      approx.equal(unit1.value, 8.314);
      assert.equal(unit1.units[0].unit.name, 'g');
      assert.equal(unit1.units[1].unit.name, 'm');
      assert.equal(unit1.units[2].unit.name, 's');
      assert.equal(unit1.units[3].unit.name, 'K');
      assert.equal(unit1.units[4].unit.name, 'mol');
      assert.equal(unit1.units[0].power, 1);
      assert.equal(unit1.units[1].power, 2);
      assert.equal(unit1.units[2].power, -2);
      assert.equal(unit1.units[3].power, -1);
      assert.equal(unit1.units[4].power, -1);
      assert.equal(unit1.units[0].prefix.name, 'k');

      unit1 = Unit.parse('1 (m / ( s / ( kg mol ) / ( lbm / h ) K ) )');
      assert.equal(unit1.units[0].unit.name, 'm');
      assert.equal(unit1.units[1].unit.name, 's');
      assert.equal(unit1.units[2].unit.name, 'g');
      assert.equal(unit1.units[3].unit.name, 'mol');
      assert.equal(unit1.units[4].unit.name, 'lbm');
      assert.equal(unit1.units[5].unit.name, 'h');
      assert.equal(unit1.units[6].unit.name, 'K');
      assert.equal(unit1.units[0].power, 1);
      assert.equal(unit1.units[1].power, -1);
      assert.equal(unit1.units[2].power, 1);
      assert.equal(unit1.units[3].power, 1);
      assert.equal(unit1.units[4].power, 1);
      assert.equal(unit1.units[5].power, -1);
      assert.equal(unit1.units[6].power, -1);

      unit2 = Unit.parse('1(m/(s/(kg mol)/(lbm/h)K))');
      assert.deepEqual(unit1, unit2);
    });

    it('should parse units with correct precedence', function() {
      var unit1 = Unit.parse('1  m^3 / kg s^2'); // implicit multiplication

      approx.equal(unit1.value, 1);
      assert.equal(unit1.units[0].unit.name, 'm');
      assert.equal(unit1.units[1].unit.name, 'g');
      assert.equal(unit1.units[2].unit.name, 's');
      assert.equal(unit1.units[0].power, 3);
      assert.equal(unit1.units[1].power, -1);
      assert.equal(unit1.units[2].power, 2);
      assert.equal(unit1.units[0].prefix.name, '');
    });

    it('should throw an exception when parsing an invalid unit', function() {
      assert.throws(function () {Unit.parse('.meter')}, /Unexpected "\."/);
      assert.throws(function () {Unit.parse('5e')}, /Unit "e" not found/);
      assert.throws(function () {Unit.parse('5e.')}, /Unit "e" not found/);
      assert.throws(function () {Unit.parse('5e1.3')}, /Unexpected "\."/);
      assert.throws(function () {Unit.parse('5')}, /contains no units/);
      assert.throws(function () {Unit.parse('')}, /contains no units/);
      assert.throws(function () {Unit.parse('meter.')}, /Unexpected "\."/);
      assert.throws(function () {Unit.parse('meter/')}, /Trailing characters/);
      assert.throws(function () {Unit.parse('/meter')}, /Unexpected "\/"/);
      assert.throws(function () {Unit.parse('45 kg 34 m')}, /Unexpected "3"/);
    });

    it('should throw an exception when parsing an invalid type of argument', function() {
      assert.throws(function () {Unit.parse(123)}, /TypeError: Invalid argument in Unit.parse, string expected/);
    });

    it('should parse the value of the unit as Fraction or BigNumber when math.js is configured so', function() {
      var origConfig = math.config();

      math.config({number: 'Fraction'});
      var unit1 = Unit.parse('5kg');
      assert(math.type.isFraction(unit1.value));

      math.config({number: 'BigNumber'});
      var unit1 = Unit.parse('5kg');
      assert(math.type.isBigNumber(unit1.value));

      math.config(origConfig);
    });
  });

  describe('_isDerived', function() {
    it('should return the correct value', function () {
      assert.equal(Unit.parse('34 kg')._isDerived(), false);
      assert.equal(Unit.parse('34 kg/s')._isDerived(), true);
      assert.equal(Unit.parse('34 kg^2')._isDerived(), true);
      assert.equal(Unit.parse('34 N')._isDerived(), false);
      assert.equal(Unit.parse('34 kg m / s^2')._isDerived(), true);
      var unit1 = Unit.parse('34 kg m / s^2');
      assert.equal(unit1._isDerived(), true);
      unit1.isUnitListSimplified = false;
      unit1.simplifyUnitListLazy();
      assert.equal(unit1._isDerived(), false);
    });
  });
  
  describe('multiply, divide, and pow', function() {
    it('should flag the unit as requiring simplification', function() {
      var unit1 = new Unit(10, 'kg');
      var unit2 = new Unit(9.81, 'm/s^2');
      assert.equal(unit1.multiply(unit2).isUnitListSimplified, false);
      assert.equal(unit1.divide(unit2).isUnitListSimplified, false);
      assert.equal(unit1.pow(2).isUnitListSimplified, false);
    });

    it('should retain the units of their operands without simplifying', function() {
      var unit1 = new Unit(10, "N/s");
      var unit2 = new Unit(10, "h");
      var unitM = unit1.multiply(unit2);
      assert.equal(unitM.units[0].unit.name, 'N');
      assert.equal(unitM.units[1].unit.name, 's');
      assert.equal(unitM.units[2].unit.name, 'h');

      var unit3 = new Unit(14.7, "lbf");
      var unit4 = new Unit(1, "in in");
      var unitD = unit3.divide(unit4);
      assert.equal(unitD.units[0].unit.name, 'lbf');
      assert.equal(unitD.units[1].unit.name, 'in');
      assert.equal(unitD.units[2].unit.name, 'in');

      var unit5 = new Unit(1, "N h/s");
      var unitP = unit5.pow(-3.5);
      assert.equal(unitP.units[0].unit.name, 'N');
      assert.equal(unitP.units[1].unit.name, 'h');
      assert.equal(unitP.units[2].unit.name, 's');
    });

    it('should keep the same numeric type for the units value', function() {
      var unit1 = new Unit(math.bignumber(10), "N/s");
      var unit2 = new Unit(math.bignumber(10), "h");
      var unitM = unit1.multiply(unit2);
      assert(math.type.isBigNumber(unitM.value));

      var unit3 = new Unit(math.bignumber(14.7), "lbf");
      var unit4 = new Unit(math.bignumber(1), "in in");
      var unitD = unit3.divide(unit4);
      assert(math.type.isBigNumber(unitD.value));

      var unit5 = new Unit(math.bignumber(1), "N h/s");
      var unitP = unit5.pow(math.bignumber(-3.5));
      assert(math.type.isBigNumber(unitP.value));
    });
  });

  describe('plurals', function() {
    it('should support plurals', function () {

      var unit1 = new Unit(5, 'meters');
      assert.equal(unit1.value, 5);
      assert.equal(unit1.units[0].unit.name, 'meters');
      assert.equal(unit1.units[0].prefix.name, '');

      var unit2 = new Unit(5, 'kilometers');
      assert.equal(unit2.value, 5000);
      assert.equal(unit2.units[0].unit.name, 'meters');
      assert.equal(unit2.units[0].prefix.name, 'kilo');

      var unit3 = new Unit(5, 'inches');
      approx.equal(unit3.value, 0.127);
      assert.equal(unit3.units[0].unit.name, 'inches');
      assert.equal(unit3.units[0].prefix.name, '');

      var unit3 = new Unit(9.81, 'meters/second^2');
      approx.equal(unit3.value, 9.81);
      assert.equal(unit3.units[0].unit.name, 'meters');
      assert.equal(unit3.units[0].prefix.name, '');

    });
  });

  describe('aliases', function() {
    it('should support aliases', function () {

      var unit1 = new Unit(5, 'lt');
      assert.equal(unit1.value, 5e-3);
      assert.equal(unit1.units[0].unit.name, 'lt');
      assert.equal(unit1.units[0].prefix.name, '');

      var unit2 = new Unit(1, 'lb');
      assert.equal(unit2.value, 453.59237e-3);
      assert.equal(unit2.units[0].unit.name, 'lb');
      assert.equal(unit2.units[0].prefix.name, '');

      assert.equal(math.eval('2 feet * 8 s').toString(), '16 feet s');
      assert.equal(math.eval('2 s * 8 feet').toString(), '16 s feet');
    });
  });

  describe('UNITS', function() {
    it('should be of the correct value and dimension', function() {
    
      assert.equal(new Unit(1, 's A')   .equals(new Unit(1, 'C'))  , true);
      assert.equal(new Unit(1, 'W/A')   .equals(new Unit(1, 'V'))  , true);
      assert.equal(new Unit(1, 'V/A')   .equals(new Unit(1, 'ohm')), true);
      assert.equal(new Unit(1, 'C/V')   .equals(new Unit(1, 'F'))  , true);
      assert.equal(new Unit(1, 'J/A')   .equals(new Unit(1, 'Wb')) , true);
      assert.equal(new Unit(1, 'Wb/m^2').equals(new Unit(1, 'T'))  , true);
      assert.equal(new Unit(1, 'Wb/A')  .equals(new Unit(1, 'H'))  , true);
      assert.equal(new Unit(1, 'ohm^-1').equals(new Unit(1, 'S'))  , true);
      assert.equal(new Unit(1, 'eV')    .equals(new Unit(1.602176565e-19, 'J')), true);
    });
  });

  describe('createUnitSingle', function() {
    it('should create a custom unit from a string definition', function() {
      Unit.createUnitSingle('widget', '5 kg bytes');
      assert.equal(new Unit(1, 'widget').equals(new Unit(5, 'kg bytes')), true);
      Unit.createUnitSingle('woggle', '4 widget^2');
      assert.equal(new Unit(1, 'woggle').equals(new Unit(4, 'widget^2')), true);
      assert.equal(new Unit(2, 'woggle').equals(new Unit(200, 'kg^2 bytes^2')), true);
    });

    it('should create a custom unit from a Unit definition', function() {
      var Unit1 = new Unit(5, 'N/woggle');
      Unit.createUnitSingle('gadget', Unit1);
      assert.equal(new Unit(1, 'gadget').equals(new Unit(5, 'N/woggle')), true);
    });

    it('should create a custom unit from a configuration object', function() {
      Unit.createUnitSingle('wiggle', { definition: '4 rad^2/s', offset: 1, prefixes: 'long' });
      assert.equal(math.eval('8000 rad^2/s').toString(), '1 kilowiggle');
    });

    it('should return the new (value-less) unit', function() {
      var Unit2 = new Unit(1000, 'N h kg^-2 bytes^-2');
      var newUnit = Unit.createUnitSingle('whimsy', '8 gadget hours');
      assert.equal(Unit2.to(newUnit).toString(), '2500 whimsy');
    });

    it('should not override an existing unit', function() {
      assert.throws(function () { Unit.createUnitSingle('m', '1 kg'); }, /Cannot create unit .*: a unit with that name already exists/);
      assert.throws(function () { Unit.createUnitSingle('gadget', '1 kg'); }, /Cannot create unit .*: a unit with that name already exists/);
      assert.throws(function () { Unit.createUnitSingle('morogrove', { aliases: 's' }); }, /Cannot create alias .*: a unit with that name already exists/);
    });

    it('should throw an error for invalid parameters', function() {
      assert.throws(function() { Unit.createUnitSingle(); }, /createUnitSingle expects first parameter/);
      assert.throws(function() { Unit.createUnitSingle(42); }, /createUnitSingle expects first parameter/);
      assert.throws(function() { Unit.createUnitSingle('42'); }, /Error: Invalid unit name/);
    });

    it('should apply the correct prefixes', function() {
      Unit.createUnitSingle('millizilch', {definition: '1e-3 m', prefixes: 'long'});
      assert.equal(new Unit(1e-6, 'millizilch').toString(), '1 micromillizilch');
    });

    it('should override prefixed built-in units', function() {
      Unit.createUnitSingle('mm', { definition: '1e-4 m', prefixes: 'short'});   // User is being silly
      assert.equal(new Unit(1e-3, 'mm').toString(), '1 mmm'); // Use the user's new definition
      assert.equal(new Unit(1e-3, 'mm').to('m').format(4), '1e-7 m'); // Use the user's new definition
    });

    it('should create aliases', function() {
      Unit.createUnitSingle('knot', {definition: '0.51444444 m/s', aliases:['knots', 'kts', 'kt']});
      assert.equal(new Unit(1, 'knot').equals(new Unit(1, 'kts')), true);
      assert.equal(new Unit(1, 'kt').equals(new Unit(1, 'knots')), true);
    });

    it('should apply offset correctly', function() {
      Unit.createUnitSingle('whatsit', {definition: '3.14 kN', offset:2});
      assert.equal(new Unit(1, 'whatsit').to('kN').toString(), '9.42 kN');
    });

    it('should create new base units', function() {
      var fooBase_unit = Unit.createUnitSingle('fooBase');
      assert.equal(fooBase_unit.dimensions.toString(), Unit.BASE_UNITS['fooBase_STUFF'].dimensions.toString());
      var testUnit = new Unit(5, 'fooBase');
      assert.equal(testUnit.toString(), '5 fooBase');
    });

    it('should not override base units', function() {
      assert.throws(function() { Unit.createUnitSingle('fooBase', '', {override: true}); }, /Cannot create/);
    });

    it('should create and use a new base if no matching base exists', function() {
      Unit.createUnitSingle('jabberwocky', '1 mile^5/hour');
      assert.equal('jabberwocky_STUFF' in Unit.BASE_UNITS, true);
      assert.equal(math.eval('4 mile^5/minute').format(4), '240 jabberwocky');
    });
  });

  describe('createUnit', function() {
    it('should create multiple units', function() {
      Unit.createUnit({
        'foo1': '',
        'foo2': '2 foo1',
        'foo3': {
          definition: '2 foo2',
          prefixes: 'long'
        }
      });
      assert.equal(math.eval('2 foo3 to foo1').toString(), '8 foo1');
    });

    it('should override units when requested and if able', function() {
      assert.throws(function() {Unit.createUnit({foo1:''});}, /Cannot/);
      assert.throws(function() {Unit.createUnit({foo1:'', override:true});}, /Cannot/);
      Unit.createUnit({foo3:''}, {override: true});
    });

    it('should throw error when first parameter is not an object', function() {
      assert.throws(function() {Unit.createUnit('not an object');}, /createUnit expects first/);
    });
  });

  describe('splitUnit', function() {
    it('should split a unit into parts', function() {
      assert.equal((new Unit(1, 'm')).splitUnit(['ft', 'in']).toString(), "3 ft,3.3700787401574765 in");
      assert.equal((new Unit(-1, 'm')).splitUnit(['ft', 'in']).toString(), "-3 ft,-3.3700787401574765 in");
      assert.equal((new Unit(1, 'm/s')).splitUnit(['m/s']).toString(), "1 m / s");
      assert.equal((new Unit(1, 'm')).splitUnit(['ft', 'ft']).toString(), "3 ft,0.280839895013123 ft");
      assert.equal((new Unit(1.23, 'm/s')).splitUnit([]).toString(), "1.23 m / s");
      assert.equal((new Unit(1, 'm')).splitUnit(['in', 'ft']).toString(), "39 in,0.030839895013123605 ft");
      assert.equal((new Unit(1, 'm')).splitUnit([ new Unit(null, 'ft'), new Unit(null, 'in') ]).toString(), "3 ft,3.3700787401574765 in");
    });

    it('should be resistant to round-off error', function() {

      assert.equal((new Unit(-12, 'in')).splitUnit(['ft', 'in']).toString(), "-1 ft,0 in");
      assert.equal((new Unit(12, 'in')).splitUnit(['ft', 'in']).toString(), "1 ft,0 in");
      assert.equal((new Unit(24, 'in')).splitUnit(['ft', 'in']).toString(), "2 ft,0 in");
      assert.equal((new Unit(36, 'in')).splitUnit(['ft', 'in']).toString(), "3 ft,0 in");
      assert.equal((new Unit(48, 'in')).splitUnit(['ft', 'in']).toString(), "4 ft,0 in");
      assert.equal((new Unit(60, 'in')).splitUnit(['ft', 'in']).toString(), "5 ft,0 in");
      assert.equal((new Unit(36000, 'in')).splitUnit(['ft', 'in']).toString(), "3000 ft,0 in");

    });
  });

  describe('toSI', function() {
    it('should return a clone of the unit', function() {
      var u1 = Unit.parse('3 ft');
      var u2 = u1.toSI();
      assert.equal(u1 === u2, false);
    });

    it('should return the unit in SI units', function() {
      assert.equal(Unit.parse('3 ft').toSI().format(10), "0.9144 m");
    });

    it('should return SI units for valueless units', function() {
      assert.equal(Unit.parse('ft/minute').toSI().toString(), "m / s");
    });

    it('should return SI units for custom units defined from other units', function() {
      Unit.createUnit({foo:'3 kW'}, {override: true});
      assert.equal(Unit.parse('42 foo').toSI().toString(), "1.26e+5 (kg m^2) / s^3");
    });

    it('should throw if custom unit not defined from existing units', function() {
      Unit.createUnit({baz:''}, {override:true});
      assert.throws(function() { Unit.parse('10 baz').toSI(); }, /Cannot express custom unit/);
    });

  });

});
