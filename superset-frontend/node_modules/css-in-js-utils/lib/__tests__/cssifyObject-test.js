'use strict';

var _cssifyObject = require('../cssifyObject');

var _cssifyObject2 = _interopRequireDefault(_cssifyObject);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('Cssifying objects', function () {
  it('should generate a valid CSS string', function () {
    expect((0, _cssifyObject2.default)({ color: 'red' })).toEqual('color:red');
  });

  it('should convert properties to dash case', function () {
    expect((0, _cssifyObject2.default)({ fontSize: '12px' })).toEqual('font-size:12px');
  });

  it('should separate declarations with semicolons', function () {
    expect((0, _cssifyObject2.default)({
      fontSize: '12px',
      color: 'red'
    })).toEqual('font-size:12px;color:red');
  });

  it('should convert vendor prefixes', function () {
    expect((0, _cssifyObject2.default)({
      WebkitJustifyContent: 'center',
      msFlexAlign: 'center'
    })).toEqual('-webkit-justify-content:center;-ms-flex-align:center');
  });
});