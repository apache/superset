"use strict";

require("core-js/modules/es.symbol");

require("core-js/modules/es.symbol.description");

require("core-js/modules/es.symbol.iterator");

require("core-js/modules/es.array.for-each");

require("core-js/modules/es.array.iterator");

require("core-js/modules/es.object.assign");

require("core-js/modules/es.object.get-prototype-of");

require("core-js/modules/es.object.keys");

require("core-js/modules/es.object.to-string");

require("core-js/modules/es.reflect.construct");

require("core-js/modules/es.regexp.to-string");

require("core-js/modules/es.string.iterator");

require("core-js/modules/web.dom-collections.for-each");

require("core-js/modules/web.dom-collections.iterator");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.withConfig = exports.ConfigProvider = void 0;

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _cache = _interopRequireDefault(require("./cache"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function () { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var defaults = {
  cache: _cache.default,
  colors: _utils.defaultColors,
  initials: _utils.defaultInitials,
  avatarRedirectUrl: null
};
var contextKeys = Object.keys(defaults);
/**
 * withConfig and ConfigProvider provide a compatibility layer for different
 * versions of React equiped with different versions of the Context API.
 *
 * If the new Context API is available it will be used, otherwise we will
 * fall back to the legacy context api.
 */

var ConfigContext = _react.default.createContext && _react.default.createContext();

var isLegacyContext = !ConfigContext;
var ConfigConsumer = isLegacyContext ? null : ConfigContext.Consumer;
/**
 * This was introduced in React 16.3.0 we need this to
 * prevent errors in newer versions. But we will just forward the
 * component for any version lower than 16.3.0
 *
 * https://github.com/Sitebase/react-avatar/issues/201
 * https://github.com/facebook/react/blob/master/CHANGELOG.md#1630-march-29-2018
 */

var forwardRef = _react.default.forwardRef || function (C) {
  return C;
};

var ConfigProvider = /*#__PURE__*/function (_React$Component) {
  _inherits(ConfigProvider, _React$Component);

  var _super = _createSuper(ConfigProvider);

  function ConfigProvider() {
    _classCallCheck(this, ConfigProvider);

    return _super.apply(this, arguments);
  }

  _createClass(ConfigProvider, [{
    key: "_getContext",
    value: function _getContext() {
      var _this = this;

      var context = {};
      contextKeys.forEach(function (key) {
        if (typeof _this.props[key] !== 'undefined') context[key] = _this.props[key];
      });
      return context;
    }
  }, {
    key: "render",
    value: function render() {
      var children = this.props.children;
      if (isLegacyContext) return _react.default.Children.only(children);
      return /*#__PURE__*/_react.default.createElement(ConfigContext.Provider, {
        value: this._getContext()
      }, _react.default.Children.only(children));
    }
  }]);

  return ConfigProvider;
}(_react.default.Component);

exports.ConfigProvider = ConfigProvider;

_defineProperty(ConfigProvider, "displayName", 'ConfigProvider');

_defineProperty(ConfigProvider, "propTypes", {
  cache: _propTypes.default.object,
  colors: _propTypes.default.arrayOf(_propTypes.default.string),
  initials: _propTypes.default.func,
  avatarRedirectUrl: _propTypes.default.string,
  children: _propTypes.default.node
});

var withConfig = function withConfig(Component) {
  function withAvatarConfig(props, refOrContext) {
    // If legacy context is enabled, there is no support for forwardedRefs either
    if (isLegacyContext) {
      var ctx = refOrContext && refOrContext.reactAvatar;
      return /*#__PURE__*/_react.default.createElement(Component, _extends({}, defaults, ctx, props));
    }
    /* eslint-disable react/display-name */


    return /*#__PURE__*/_react.default.createElement(ConfigConsumer, null, function (config) {
      return /*#__PURE__*/_react.default.createElement(Component, _extends({
        ref: refOrContext
      }, defaults, config, props));
    });
    /* eslint-enable react/display-name */
  } // Legacy support, only set when legacy is detected


  withAvatarConfig.contextTypes = ConfigProvider.childContextTypes;
  return forwardRef(withAvatarConfig);
};

exports.withConfig = withConfig;

if (isLegacyContext) {
  ConfigProvider.childContextTypes = {
    reactAvatar: _propTypes.default.object
  };

  ConfigProvider.prototype.getChildContext = function () {
    return {
      reactAvatar: this._getContext()
    };
  };
}