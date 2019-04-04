var inspect = require('../');
var test = require('tape');

test('bigint', { skip: typeof BigInt === 'undefined' }, function (t) {
  t.test('primitives', function (st) {
    st.plan(3);

    st.equal(inspect(BigInt(-256)), '-256n');
    st.equal(inspect(BigInt(0)), '0n');
    st.equal(inspect(BigInt(256)), '256n');
  });

  t.test('objects', function (st) {
    st.plan(3);

    st.equal(inspect(Object(BigInt(-256))), 'Object(-256n)');
    st.equal(inspect(Object(BigInt(0))), 'Object(0n)');
    st.equal(inspect(Object(BigInt(256))), 'Object(256n)');
  });

  t.test('syntactic primitives', function (st) {
    st.plan(3);

    st.equal(inspect(Function('return -256n')()), '-256n');
    st.equal(inspect(Function('return 0n')()), '0n');
    st.equal(inspect(Function('return 256n')()), '256n');
  });

  t.end();
});
