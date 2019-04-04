'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactRouter = require('react-router');

var _useScroll = require('react-router-scroll/lib/useScroll');

var _useScroll2 = _interopRequireDefault(_useScroll);

var _apiRunnerBrowser = require('api-runner-browser');

var _apiRunnerBrowser2 = _interopRequireDefault(_apiRunnerBrowser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var rootRoute = require('./child-routes');

var currentLocation = void 0;

_reactRouter.browserHistory.listen(function (location) {
  currentLocation = location;
});

function shouldUpdateScroll(prevRouterProps, _ref) {
  var pathname = _ref.location.pathname;

  if (prevRouterProps) {
    var oldPathname = prevRouterProps.location.pathname;

    if (oldPathname === pathname) {
      return false;
    }
  }
  return true;
}

var Root = function Root() {
  return _react2.default.createElement(_reactRouter.Router, {
    history: _reactRouter.browserHistory,
    routes: rootRoute,
    render: (0, _reactRouter.applyRouterMiddleware)((0, _useScroll2.default)(shouldUpdateScroll)),
    onUpdate: function onUpdate() {
      (0, _apiRunnerBrowser2.default)('onRouteUpdate', currentLocation);
    }
  });
};

exports.default = Root;
module.exports = exports['default'];