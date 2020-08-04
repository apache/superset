var typed = require('../typed-function');

// define type conversions that we want to support order is important.
// There is also an utility function typed.addConversion(conversion) for this.
typed.conversions = [
  {
    from: 'boolean',
    to: 'number',
    convert: function (x) {
      return +x;
    }
  },
  {
    from: 'boolean',
    to: 'string',
    convert: function (x) {
      return x + '';
    }
  },
  {
    from: 'number',
    to: 'string',
    convert: function (x) {
      return x + '';
    }
  }
];

// create a typed function with multiple signatures
//
// where possible, the created function will automatically convert booleans to
// numbers or strings, and convert numbers to strings.
//
// note that the length property is only available on strings, and the toFixed
// function only on numbers, so this requires the right type of argument else
// the function will throw an exception.
var fn = typed({
  'string': function (name) {
    return 'Name: ' + name + ', length: ' + name.length;
  },
  'string, number': function (name, value) {
    return 'Name: ' + name + ', length: ' + name.length + ', value: ' + value.toFixed(3);
  }
});

// use the function the regular way
console.log(fn('foo'));        // outputs 'Name: foo, length: 3'
console.log(fn('foo', 2/3));   // outputs 'Name: foo, length: 3, value: 0.667'

// calling the function with non-supported but convertible types
// will work just fine:
console.log(fn(false));         // outputs 'Name: false, length: 5'
console.log(fn('foo', true));   // outputs 'Name: foo, length: 3, value: 1.000'
