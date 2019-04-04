'use strict';

exports.__esModule = true;

var _createEagerFactory = require('./createEagerFactory');

var _createEagerFactory2 = _interopRequireDefault(_createEagerFactory);

var _wrapDisplayName = require('./wrapDisplayName');

var _wrapDisplayName2 = _interopRequireDefault(_wrapDisplayName);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var renderComponent = function renderComponent(Component) {
  return function (_) {
    var factory = (0, _createEagerFactory2.default)(Component);
    var RenderComponent = function RenderComponent(props) {
      return factory(props);
    };
    if (process.env.NODE_ENV !== 'production') {
      RenderComponent.displayName = (0, _wrapDisplayName2.default)(Component, 'renderComponent');
    }
    return RenderComponent;
  };
};

exports.default = renderComponent;