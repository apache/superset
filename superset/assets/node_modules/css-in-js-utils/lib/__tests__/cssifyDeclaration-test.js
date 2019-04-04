'use strict';

var _cssifyDeclaration = require('../cssifyDeclaration');

var _cssifyDeclaration2 = _interopRequireDefault(_cssifyDeclaration);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('Cssifying declarations', function () {
  it('should return a valid css declaration', function () {
    expect((0, _cssifyDeclaration2.default)('width', '300px')).toEqual('width:300px');
    expect((0, _cssifyDeclaration2.default)('WebkitFlex', '1')).toEqual('-webkit-flex:1');
    expect((0, _cssifyDeclaration2.default)('msTransitionDuration', '3s')).toEqual('-ms-transition-duration:3s');
  });
});