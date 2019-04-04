'use strict';

var _unprefixValue = require('../unprefixValue');

var _unprefixValue2 = _interopRequireDefault(_unprefixValue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('Unprefixing values', function () {
  it('should unprefix the value', function () {
    expect((0, _unprefixValue2.default)('-webkit-calc(100% - 20px)')).toEqual('calc(100% - 20px)');
    expect((0, _unprefixValue2.default)('-ms-transition')).toEqual('transition');
  });

  it('should keep an unprefixed value', function () {
    expect((0, _unprefixValue2.default)('300px')).toEqual('300px');
    expect((0, _unprefixValue2.default)(300)).toEqual(300);
    expect((0, _unprefixValue2.default)('calc(100% - 20px)')).toEqual('calc(100% - 20px)');
  });
});