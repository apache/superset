'use strict';

var _camelCaseProperty = require('../camelCaseProperty');

var _camelCaseProperty2 = _interopRequireDefault(_camelCaseProperty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('Camel casing properties', function () {
  it('should camel case properties', function () {
    expect((0, _camelCaseProperty2.default)('transition-delay')).toEqual('transitionDelay');
    expect((0, _camelCaseProperty2.default)('-webkit-transition-delay')).toEqual('WebkitTransitionDelay');
    expect((0, _camelCaseProperty2.default)('-ms-transition')).toEqual('msTransition');
  });
});