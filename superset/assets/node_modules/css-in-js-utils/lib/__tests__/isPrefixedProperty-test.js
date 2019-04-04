'use strict';

var _isPrefixedProperty = require('../isPrefixedProperty');

var _isPrefixedProperty2 = _interopRequireDefault(_isPrefixedProperty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('Checking for prefixed properties', function () {
  it('should return true', function () {
    expect((0, _isPrefixedProperty2.default)('WebkitTransition')).toEqual(true);
    expect((0, _isPrefixedProperty2.default)('msTransitionDelay')).toEqual(true);
  });

  it('should return false', function () {
    expect((0, _isPrefixedProperty2.default)('transition')).toEqual(false);
    expect((0, _isPrefixedProperty2.default)('transitionDelay')).toEqual(false);
  });
});