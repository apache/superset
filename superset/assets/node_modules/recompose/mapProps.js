'use strict';

exports.__esModule = true;

var _setDisplayName = require('./setDisplayName');

var _setDisplayName2 = _interopRequireDefault(_setDisplayName);

var _wrapDisplayName = require('./wrapDisplayName');

var _wrapDisplayName2 = _interopRequireDefault(_wrapDisplayName);

var _createEagerFactory = require('./createEagerFactory');

var _createEagerFactory2 = _interopRequireDefault(_createEagerFactory);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var mapProps = function mapProps(propsMapper) {
  return function (BaseComponent) {
    var factory = (0, _createEagerFactory2.default)(BaseComponent);
    var MapProps = function MapProps(props) {
      return factory(propsMapper(props));
    };
    if (process.env.NODE_ENV !== 'production') {
      return (0, _setDisplayName2.default)((0, _wrapDisplayName2.default)(BaseComponent, 'mapProps'))(MapProps);
    }
    return MapProps;
  };
};

exports.default = mapProps;