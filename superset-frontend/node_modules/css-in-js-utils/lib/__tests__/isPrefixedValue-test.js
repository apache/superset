'use strict';

var _isPrefixedValue = require('../isPrefixedValue');

var _isPrefixedValue2 = _interopRequireDefault(_isPrefixedValue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('Checking for prefixed values', function () {
  it('should return true', function () {
    expect((0, _isPrefixedValue2.default)('-webkit-calc(100% - 20px)')).toEqual(true);
    expect((0, _isPrefixedValue2.default)('-ms-transition')).toEqual(true);
  });

  it('should return false', function () {
    expect((0, _isPrefixedValue2.default)('200px')).toEqual(false);
    expect((0, _isPrefixedValue2.default)('calc(100% - 20px)')).toEqual(false);
  });
});