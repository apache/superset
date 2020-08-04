var test = require('tape');
var util = require('util');
var stylePropType = require('../index');

var getError = (a, b, c) => {
  var error = undefined;
  try {
    stylePropType(a, b, c);
  }
  catch (e) {
    error = e;
  }
  if (!error) {
    throw new Error('in test, expected stylePropType(' + [a, b, c].map((x) => util.inspect(x)).join(', ') + ') to throw an error, but it did not');
  }
  return error.message;
};

test('react-style-proptype', (t) => {
  t.equal(stylePropType({myStyle: {}}, 'myStyle', 'Comp'), undefined);
  t.equal(stylePropType({myStyle: {background: 'red'}}, 'myStyle', 'Comp'), undefined);

  var error = getError({myStyle: {foo: 1}}, 'myStyle', 'Comp');
  t.ok(error.indexOf('myStyle') !== -1);
  t.ok(error.indexOf('Comp') !== -1);
  t.ok(error.indexOf('foo') !== -1);

  t.end();
})

test('supportingArrays', (t) => {
  stylePropType.supportingArrays({}, 'myStyle', 'A');
  stylePropType.supportingArrays({myStyle: [{}, {}]}, 'myStyle', 'B');
  stylePropType.supportingArrays({myStyle: {}}, 'myStyle', 'C');
  //t.throws(() => {
  //  stylePropType.supportingArrays({myStyle: 5}, 'myStyle', 'D');
  //});
  t.end();
});

