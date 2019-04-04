'use strict';

var _normalizeProperty = require('../normalizeProperty');

var _normalizeProperty2 = _interopRequireDefault(_normalizeProperty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('Normalizing properties', function () {
  it('should camel case hypenated properties', function () {
    expect((0, _normalizeProperty2.default)('transition-delay')).toEqual('transitionDelay');
  });

  it('should unprefix properties', function () {
    expect((0, _normalizeProperty2.default)('WebkitTransitionDelay')).toEqual('transitionDelay');
  });

  it('should unprefix and camel case properties', function () {
    expect((0, _normalizeProperty2.default)('-webkit-transition-delay')).toEqual('transitionDelay');
  });
});