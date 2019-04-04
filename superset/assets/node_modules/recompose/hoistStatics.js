'use strict';

exports.__esModule = true;

var _hoistNonReactStatics = require('hoist-non-react-statics');

var _hoistNonReactStatics2 = _interopRequireDefault(_hoistNonReactStatics);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var hoistStatics = function hoistStatics(higherOrderComponent) {
  return function (BaseComponent) {
    var NewComponent = higherOrderComponent(BaseComponent);
    (0, _hoistNonReactStatics2.default)(NewComponent, BaseComponent);
    return NewComponent;
  };
};

exports.default = hoistStatics;