'use strict';

import "core-js/modules/es.symbol";
import "core-js/modules/es.symbol.description";
import "core-js/modules/es.symbol.iterator";
import "core-js/modules/es.array.filter";
import "core-js/modules/es.array.for-each";
import "core-js/modules/es.array.iterator";
import "core-js/modules/es.array.join";
import "core-js/modules/es.array.reduce";
import "core-js/modules/es.function.name";
import "core-js/modules/es.object.assign";
import "core-js/modules/es.object.get-own-property-descriptor";
import "core-js/modules/es.object.get-own-property-descriptors";
import "core-js/modules/es.object.get-prototype-of";
import "core-js/modules/es.object.keys";
import "core-js/modules/es.object.to-string";
import "core-js/modules/es.reflect.construct";
import "core-js/modules/es.regexp.exec";
import "core-js/modules/es.regexp.to-string";
import "core-js/modules/es.string.iterator";
import "core-js/modules/es.string.replace";
import "core-js/modules/web.dom-collections.for-each";
import "core-js/modules/web.dom-collections.iterator";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

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

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Cache } from './cache';
import { withConfig, ConfigProvider } from './context';
import { getRandomColor, parseSize, setGroupedTimeout } from './utils';
import InternalState from './internal-state';
export { getRandomColor } from './utils';
export { ConfigProvider } from './context';
export { Cache } from './cache';

function matchSource(Source, props, cb) {
  var cache = props.cache;
  var instance = new Source(props);
  if (!instance.isCompatible(props)) return cb();
  instance.get(function (state) {
    var failedBefore = state && state.src && cache.hasSourceFailedBefore(state.src);

    if (!failedBefore && state) {
      cb(state);
    } else {
      cb();
    }
  });
}

export default function createAvatarComponent(_ref) {
  var _ref$sources = _ref.sources,
      sources = _ref$sources === void 0 ? [] : _ref$sources;
  // Collect propTypes for each individual source
  var sourcePropTypes = sources.reduce(function (r, s) {
    return Object.assign(r, s.propTypes);
  }, {});

  var Avatar = /*#__PURE__*/function (_PureComponent) {
    _inherits(Avatar, _PureComponent);

    var _super = _createSuper(Avatar);

    function Avatar(props) {
      var _this;

      _classCallCheck(this, Avatar);

      _this = _super.call(this, props);

      _defineProperty(_assertThisInitialized(_this), "_createFetcher", function (internal) {
        return function (errEvent) {
          var cache = _this.props.cache;
          if (!internal.isActive(_this.state)) return; // Mark img source as failed for future reference

          if (errEvent && errEvent.type === 'error') cache.sourceFailed(errEvent.target.src);
          var pointer = internal.sourcePointer;
          if (sources.length === pointer) return;
          var source = sources[pointer];
          internal.sourcePointer++;
          matchSource(source, _this.props, function (nextState) {
            if (!nextState) return setTimeout(internal.fetch, 0);
            if (!internal.isActive(_this.state)) return; // Reset other values to prevent them from sticking (#51)

            nextState = _objectSpread({
              src: null,
              value: null,
              color: null
            }, nextState);

            _this.setState(function (state) {
              // Internal state has been reset => we received new props
              return internal.isActive(state) ? nextState : {};
            });
          });
        };
      });

      _defineProperty(_assertThisInitialized(_this), "fetch", function () {
        var internal = new InternalState();
        internal.fetch = _this._createFetcher(internal);

        _this.setState({
          internal: internal
        }, internal.fetch);
      });

      _defineProperty(_assertThisInitialized(_this), "_scaleTextNode", function (node) {
        var retryTTL = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 16;
        var _this$props = _this.props,
            unstyled = _this$props.unstyled,
            textSizeRatio = _this$props.textSizeRatio,
            textMarginRatio = _this$props.textMarginRatio;
        if (!node || unstyled || _this.state.src || !_this.mounted) return;
        var spanNode = node.parentNode;
        var tableNode = spanNode.parentNode;

        var _spanNode$getBounding = spanNode.getBoundingClientRect(),
            containerWidth = _spanNode$getBounding.width,
            containerHeight = _spanNode$getBounding.height; // Whenever the avatar element is not visible due to some CSS
        // (such as display: none) on any parent component we will check
        // whether the component has become visible.
        //
        // The time between checks grows up to half a second in an attempt
        // to reduce flicker / performance issues.


        if (containerWidth == 0 && containerHeight == 0) {
          var ttl = Math.min(retryTTL * 1.5, 500);
          setGroupedTimeout(function () {
            return _this._scaleTextNode(node, ttl);
          }, ttl);
          return;
        } // If the tableNode (outer-container) does not have its fontSize set yet,
        // we'll set it according to "textSizeRatio"


        if (!tableNode.style.fontSize) {
          var baseFontSize = containerHeight / textSizeRatio;
          tableNode.style.fontSize = "".concat(baseFontSize, "px");
        } // Reset font-size such that scaling works correctly (#133)


        spanNode.style.fontSize = null; // Measure the actual width of the text after setting the container size

        var _node$getBoundingClie = node.getBoundingClientRect(),
            textWidth = _node$getBoundingClie.width;

        if (textWidth < 0) return; // Calculate the maximum width for the text based on "textMarginRatio"

        var maxTextWidth = containerWidth * (1 - 2 * textMarginRatio); // If the text is too wide, scale it down by (maxWidth / actualWidth)

        if (textWidth > maxTextWidth) spanNode.style.fontSize = "calc(1em * ".concat(maxTextWidth / textWidth, ")");
      });

      _this.state = {
        internal: null,
        src: null,
        value: null,
        color: props.color
      };
      return _this;
    }

    _createClass(Avatar, [{
      key: "componentDidMount",
      value: function componentDidMount() {
        this.mounted = true;
        this.fetch();
      }
    }, {
      key: "componentDidUpdate",
      value: function componentDidUpdate(prevProps) {
        var needsUpdate = false; // This seems redundant
        //
        // Props that need to be in `state` are
        // `value`, `src` and `color`

        for (var prop in sourcePropTypes) {
          needsUpdate = needsUpdate || prevProps[prop] !== this.props[prop];
        }

        if (needsUpdate) setTimeout(this.fetch, 0);
      }
    }, {
      key: "componentWillUnmount",
      value: function componentWillUnmount() {
        this.mounted = false;

        if (this.state.internal) {
          this.state.internal.active = false;
        }
      }
    }, {
      key: "_renderAsImage",
      value: function _renderAsImage() {
        var _this$props2 = this.props,
            className = _this$props2.className,
            round = _this$props2.round,
            unstyled = _this$props2.unstyled,
            alt = _this$props2.alt,
            title = _this$props2.title,
            name = _this$props2.name,
            value = _this$props2.value;
        var internal = this.state.internal;
        var size = parseSize(this.props.size);
        var imageStyle = unstyled ? null : {
          maxWidth: '100%',
          width: size.str,
          height: size.str,
          borderRadius: round === true ? '100%' : round
        };
        return /*#__PURE__*/React.createElement("img", {
          className: className + ' sb-avatar__image',
          width: size.str,
          height: size.str,
          style: imageStyle,
          src: this.state.src,
          alt: alt || name || value,
          title: title || name || value,
          onError: internal && internal.fetch
        });
      }
    }, {
      key: "_renderAsText",
      value: function _renderAsText() {
        var _this$props3 = this.props,
            className = _this$props3.className,
            round = _this$props3.round,
            unstyled = _this$props3.unstyled,
            title = _this$props3.title,
            name = _this$props3.name,
            value = _this$props3.value;
        var size = parseSize(this.props.size);
        var initialsStyle = unstyled ? null : {
          width: size.str,
          height: size.str,
          lineHeight: 'initial',
          textAlign: 'center',
          color: this.props.fgColor,
          background: this.state.color,
          borderRadius: round === true ? '100%' : round
        };
        var tableStyle = unstyled ? null : {
          display: 'table',
          tableLayout: 'fixed',
          width: '100%',
          height: '100%'
        };
        var spanStyle = unstyled ? null : {
          display: 'table-cell',
          verticalAlign: 'middle',
          fontSize: '100%',
          whiteSpace: 'nowrap'
        }; // Ensure the text node is updated and scaled when any of these
        // values changed by calling the `_scaleTextNode` method using
        // the correct `ref`.

        var key = [this.state.value, this.props.size].join('');
        return /*#__PURE__*/React.createElement("div", {
          className: className + ' sb-avatar__text',
          style: initialsStyle,
          title: title || name || value
        }, /*#__PURE__*/React.createElement("div", {
          style: tableStyle
        }, /*#__PURE__*/React.createElement("span", {
          style: spanStyle
        }, /*#__PURE__*/React.createElement("span", {
          ref: this._scaleTextNode,
          key: key
        }, this.state.value))));
      }
    }, {
      key: "render",
      value: function render() {
        var _this$props4 = this.props,
            className = _this$props4.className,
            unstyled = _this$props4.unstyled,
            round = _this$props4.round,
            style = _this$props4.style,
            onClick = _this$props4.onClick;
        var _this$state = this.state,
            src = _this$state.src,
            sourceName = _this$state.sourceName;
        var size = parseSize(this.props.size);
        var hostStyle = unstyled ? null : _objectSpread({
          display: 'inline-block',
          verticalAlign: 'middle',
          width: size.str,
          height: size.str,
          borderRadius: round === true ? '100%' : round,
          fontFamily: 'Helvetica, Arial, sans-serif'
        }, style);
        var classNames = [className, 'sb-avatar'];

        if (sourceName) {
          var source = sourceName.toLowerCase().replace(/[^a-z0-9-]+/g, '-') // only allow alphanumeric
          .replace(/^-+|-+$/g, ''); // trim `-`

          classNames.push('sb-avatar--' + source);
        }

        return /*#__PURE__*/React.createElement("div", {
          className: classNames.join(' '),
          onClick: onClick,
          style: hostStyle
        }, src ? this._renderAsImage() : this._renderAsText());
      }
    }]);

    return Avatar;
  }(PureComponent);

  _defineProperty(Avatar, "displayName", 'Avatar');

  _defineProperty(Avatar, "propTypes", _objectSpread(_objectSpread({}, sourcePropTypes), {}, {
    alt: PropTypes.string,
    title: PropTypes.string,
    className: PropTypes.string,
    fgColor: PropTypes.string,
    color: PropTypes.string,
    colors: PropTypes.arrayOf(PropTypes.string),
    round: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    style: PropTypes.object,
    size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    textSizeRatio: PropTypes.number,
    textMarginRatio: PropTypes.number,
    unstyled: PropTypes.bool,
    cache: PropTypes.object,
    onClick: PropTypes.func
  }));

  _defineProperty(Avatar, "defaultProps", {
    className: '',
    fgColor: '#FFF',
    round: false,
    size: 100,
    textSizeRatio: 3,
    textMarginRatio: .15,
    unstyled: false
  });

  _defineProperty(Avatar, "getRandomColor", getRandomColor);

  _defineProperty(Avatar, "Cache", Cache);

  _defineProperty(Avatar, "ConfigProvider", ConfigProvider);

  return Object.assign(withConfig(Avatar), {
    getRandomColor: getRandomColor,
    ConfigProvider: ConfigProvider,
    Cache: Cache
  });
}