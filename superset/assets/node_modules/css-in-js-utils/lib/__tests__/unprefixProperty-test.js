'use strict';

var _unprefixProperty = require('../unprefixProperty');

var _unprefixProperty2 = _interopRequireDefault(_unprefixProperty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('Unprefixing properties', function () {
  it('should unprefix the property', function () {
    expect((0, _unprefixProperty2.default)('msFlex')).toEqual('flex');
    expect((0, _unprefixProperty2.default)('WebkitFlex')).toEqual('flex');
  });

  it('should keep an unprefixed property', function () {
    expect((0, _unprefixProperty2.default)('flex')).toEqual('flex');
    expect((0, _unprefixProperty2.default)('padding')).toEqual('padding');
  });
});