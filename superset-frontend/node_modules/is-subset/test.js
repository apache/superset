import test from 'tape-catch';

import isSubset from './module';

test('Detects shallow subsets.', (is) => {
  is.ok(isSubset(
      {},
      {}
    ), 'with empty objects'
  );

  is.ok(isSubset(
      {a: 1},
      {}
    ), 'with an empty subset'
  );

  is.ok(isSubset(
      {a: 1, b: 2},
      {a: 1, b: 2}
    ), 'with deep-equal objects'
  );

  is.ok(isSubset(
      {a: 1, b: true, c: null, d: 'D', e: undefined, 'F-': 'anything'},
      {a: 1, b: true, c: null, d: 'D', e: undefined, 'F-': 'anything'}
    ), 'with deep-equal objects of different kinds of values'
  );

  is.ok(isSubset(
      {a: 1, b: 2},
      {a: 1}
    ), 'with simple subsets'
  );

  is.end();
});

test('Detects shallow non-subsets.', (is) => {
  is.notOk(isSubset(
      {},
      {a: 1}
    ), 'with an empty superset'
  );

  is.notOk(isSubset(
      {a: 1},
      {a: 2}
    ), 'with differences in values'
  );

  is.notOk(isSubset(
      {a: 1},
      {b: 1}
    ), 'with differences in keys'
  );

  is.notOk(isSubset(
      {a: 1},
      {a: 1, b: 2}
    ), 'with different sizes'
  );

  is.notOk(isSubset(
      {a: 0},
      {a: false}
    ), 'seeing the difference between falsey values'
  );

  is.notOk(isSubset(
      {a: null},
      {a: undefined}
    ), 'seeing the difference between null and undefined'
  );

  is.notOk(isSubset(
      {a: 1},
      {a: 1, b: undefined}
    ), 'seeing the difference between undefined reference and undefined value'
  );

  is.end();
});

test('Detects deep subsets.', (is) => {
  is.ok(isSubset(
      {a: {}},
      {a: {}}
    ), 'with nested empty objects'
  );

  is.ok(isSubset(
      {a: {}},
      {}
    ), 'with an empty subset'
  );

  is.ok(isSubset(
      {a: {b: 2}},
      {a: {}}
    ), 'with a nested empty subset'
  );

  is.ok(isSubset(
      {a: {b: 2}},
      {a: {b: 2}}
    ), 'with deep-equal objects'
  );

  is.ok(isSubset(
      {a: 1, b: true, c: null, d: 'D', e: undefined, 'F-': 'anything'},
      {a: 1, b: true, c: null, d: 'D', e: undefined, 'F-': 'anything'}
    ), 'with deep-equal objects of different kinds of values'
  );

  is.ok(isSubset(
      {a: 1, b: {c: 3, d: 4}, e: {f: {g: 7, h: {i: 9}}}},
      {a: 1, b: {d: 4}, e: {f: {g: 7}}}
    ), 'with multiple levels of nesting'
  );

  is.end();
});

test('Detects deep non-subsets.', (is) => {
  is.notOk(isSubset(
      {a: {}},
      {a: {b: 1}}
    ), 'with an empty object in the superset'
  );

  is.notOk(isSubset(
      {a: {b: 2}},
      {a: {b: 3}}
    ), 'with differences in values in a nested object'
  );

  is.notOk(isSubset(
      {z: {a: 1}},
      {z: {b: 1}}
    ), 'with differences in keys in a nested object'
  );

  is.notOk(isSubset(
      {z: {a: 1}},
      {z: {a: 1, b: 2}}
    ), 'with different sizes of a nested object'
  );

  is.end();
});

test('Works with array values.', (is) => {
  is.ok(isSubset(
      {a: []},
      {a: []}
    ), 'treating empty arrays as equal'
  );

  is.ok(isSubset(
      {a: [1]},
      {a: [1]}
    ), 'treating equal arrays as equal'
  );

  is.notOk(isSubset(
      {a: [1]},
      {a: [1, 2]}
    ), 'detecting differences in length'
  );

  is.notOk(isSubset(
      {a: [1]},
      {a: [2]}
    ), 'detecting differences in values'
  );

  is.ok(isSubset(
      {a: [1, 2, 3]},
      {a: [1, 2]}
    ), 'treating array subsets as subsets'
  );

  is.notOk(isSubset(
      {a: [1, 2, 3]},
      {a: [1, 3]}
    ), '– only if the order is identical'
  );

  is.end();
});

test('Returns false for non-object “objects”.', (is) => {
  is.notOk(isSubset(
      'a',
      {}
    ), 'for the superset'
  );

  is.notOk(isSubset(
      {},
      'a'
    ), 'for the subset'
  );

  is.end();
});
