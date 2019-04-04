'use strict';

var _isUnitlessProperty = require('../isUnitlessProperty');

var _isUnitlessProperty2 = _interopRequireDefault(_isUnitlessProperty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('Checking for unitless CSS properties', function () {
  it('should return true for unitless properties', function () {
    expect((0, _isUnitlessProperty2.default)('fontWeight')).toEqual(true);
    expect((0, _isUnitlessProperty2.default)('flex')).toEqual(true);
    expect((0, _isUnitlessProperty2.default)('gridColumn')).toEqual(true);
  });

  it('should return true for hypenated unitless properties', function () {
    expect((0, _isUnitlessProperty2.default)('font-weight')).toEqual(true);
    expect((0, _isUnitlessProperty2.default)('grid-column')).toEqual(true);
  });

  it('should return true for prefixed unitless properties', function () {
    expect((0, _isUnitlessProperty2.default)('WebkitFlex')).toEqual(true);
    expect((0, _isUnitlessProperty2.default)('msFlex')).toEqual(true);
    expect((0, _isUnitlessProperty2.default)('WebkitColumnCount')).toEqual(true);
    expect((0, _isUnitlessProperty2.default)('msColumnCount')).toEqual(true);
  });

  it('should return true for hypenated prefixed unitless properties', function () {
    expect((0, _isUnitlessProperty2.default)('-webkit-flex')).toEqual(true);
    expect((0, _isUnitlessProperty2.default)('-ms-flex')).toEqual(true);
    expect((0, _isUnitlessProperty2.default)('-webkit-column-count')).toEqual(true);
    expect((0, _isUnitlessProperty2.default)('-ms-column-count')).toEqual(true);
  });

  it('should equal false for other properties', function () {
    expect((0, _isUnitlessProperty2.default)('fontSize')).toEqual(false);
    expect((0, _isUnitlessProperty2.default)('font-size')).toEqual(false);
    expect((0, _isUnitlessProperty2.default)('-webkit-border-radius')).toEqual(false);
    expect((0, _isUnitlessProperty2.default)('-ms-border-radius')).toEqual(false);
    expect((0, _isUnitlessProperty2.default)('WebkitBorderRadius')).toEqual(false);
    expect((0, _isUnitlessProperty2.default)('msBorderRadius')).toEqual(false);
  });
});