// nv-is-defined-test.js

Tinytest.add('nv object is defined', function(test) {
  test.isNotUndefined(nv, 'nv is undefined at global scope for Meteor');
});

