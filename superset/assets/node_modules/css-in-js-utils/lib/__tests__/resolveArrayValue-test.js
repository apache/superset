'use strict';

var _resolveArrayValue = require('../resolveArrayValue');

var _resolveArrayValue2 = _interopRequireDefault(_resolveArrayValue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('Resolving array values', function () {
  it('should return a concatenated css value', function () {
    expect((0, _resolveArrayValue2.default)('width', ['300px', '100px'])).toEqual('300px;width:100px');
  });

  it('should hyphenate property names', function () {
    expect((0, _resolveArrayValue2.default)('WebkitFlex', [1, 2, 3])).toEqual('1;-webkit-flex:2;-webkit-flex:3');
  });
});