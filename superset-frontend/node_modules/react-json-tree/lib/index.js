'use strict';

exports.__esModule = true;

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _JSONNode = require('./JSONNode');

var _JSONNode2 = _interopRequireDefault(_JSONNode);

var _createStylingFromTheme = require('./createStylingFromTheme');

var _createStylingFromTheme2 = _interopRequireDefault(_createStylingFromTheme);

var _reactBase16Styling = require('react-base16-styling');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var identity = function identity(value) {
  return value;
}; // ES6 + inline style port of JSONViewer https://bitbucket.org/davevedder/react-json-viewer/
// all credits and original code to the author
// Dave Vedder <veddermatic@gmail.com> http://www.eskimospy.com/
// port by Daniele Zannotti http://www.github.com/dzannotti <dzannotti@me.com>

var expandRootNode = function expandRootNode(keyName, data, level) {
  return level === 0;
};
var defaultItemString = function defaultItemString(type, data, itemType, itemString) {
  return _react2['default'].createElement(
    'span',
    null,
    itemType,
    ' ',
    itemString
  );
};
var defaultLabelRenderer = function defaultLabelRenderer(_ref) {
  var label = _ref[0];
  return _react2['default'].createElement(
    'span',
    null,
    label,
    ':'
  );
};
var noCustomNode = function noCustomNode() {
  return false;
};

function checkLegacyTheming(theme, props) {
  var deprecatedStylingMethodsMap = {
    getArrowStyle: 'arrow',
    getListStyle: 'nestedNodeChildren',
    getItemStringStyle: 'nestedNodeItemString',
    getLabelStyle: 'label',
    getValueStyle: 'valueText'
  };

  var deprecatedStylingMethods = (0, _keys2['default'])(deprecatedStylingMethodsMap).filter(function (name) {
    return props[name];
  });

  if (deprecatedStylingMethods.length > 0) {
    if (typeof theme === 'string') {
      theme = {
        extend: theme
      };
    } else {
      theme = (0, _extends3['default'])({}, theme);
    }

    deprecatedStylingMethods.forEach(function (name) {
      // eslint-disable-next-line no-console
      console.error('Styling method "' + name + '" is deprecated, use "theme" property instead');

      theme[deprecatedStylingMethodsMap[name]] = function (_ref2) {
        for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }

        var style = _ref2.style;
        return {
          style: (0, _extends3['default'])({}, style, props[name].apply(props, args))
        };
      };
    });
  }

  return theme;
}

function getStateFromProps(props) {
  var theme = checkLegacyTheming(props.theme, props);
  if (props.invertTheme) {
    if (typeof theme === 'string') {
      theme = theme + ':inverted';
    } else if (theme && theme.extend) {
      if (typeof theme === 'string') {
        theme = (0, _extends3['default'])({}, theme, { extend: theme.extend + ':inverted' });
      } else {
        theme = (0, _extends3['default'])({}, theme, { extend: (0, _reactBase16Styling.invertTheme)(theme.extend) });
      }
    } else if (theme) {
      theme = (0, _reactBase16Styling.invertTheme)(theme);
    }
  }
  return {
    styling: (0, _createStylingFromTheme2['default'])(theme)
  };
}

var JSONTree = function (_React$Component) {
  (0, _inherits3['default'])(JSONTree, _React$Component);

  function JSONTree(props) {
    (0, _classCallCheck3['default'])(this, JSONTree);

    var _this = (0, _possibleConstructorReturn3['default'])(this, _React$Component.call(this, props));

    _this.state = getStateFromProps(props);
    return _this;
  }

  JSONTree.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
    var _this2 = this;

    if (['theme', 'invertTheme'].find(function (k) {
      return nextProps[k] !== _this2.props[k];
    })) {
      this.setState(getStateFromProps(nextProps));
    }
  };

  JSONTree.prototype.shouldComponentUpdate = function shouldComponentUpdate(nextProps) {
    var _this3 = this;

    return !!(0, _keys2['default'])(nextProps).find(function (k) {
      return k === 'keyPath' ? nextProps[k].join('/') !== _this3.props[k].join('/') : nextProps[k] !== _this3.props[k];
    });
  };

  JSONTree.prototype.render = function render() {
    var _props = this.props,
        value = _props.data,
        keyPath = _props.keyPath,
        postprocessValue = _props.postprocessValue,
        hideRoot = _props.hideRoot,
        theme = _props.theme,
        _ = _props.invertTheme,
        rest = (0, _objectWithoutProperties3['default'])(_props, ['data', 'keyPath', 'postprocessValue', 'hideRoot', 'theme', 'invertTheme']);
    var styling = this.state.styling;


    return _react2['default'].createElement(
      'ul',
      styling('tree'),
      _react2['default'].createElement(_JSONNode2['default'], (0, _extends3['default'])({}, (0, _extends3['default'])({ postprocessValue: postprocessValue, hideRoot: hideRoot, styling: styling }, rest), {
        keyPath: hideRoot ? [] : keyPath,
        value: postprocessValue(value)
      }))
    );
  };

  return JSONTree;
}(_react2['default'].Component);

JSONTree.propTypes = {
  data: _propTypes2['default'].oneOfType([_propTypes2['default'].array, _propTypes2['default'].object]).isRequired,
  hideRoot: _propTypes2['default'].bool,
  theme: _propTypes2['default'].oneOfType([_propTypes2['default'].object, _propTypes2['default'].string]),
  invertTheme: _propTypes2['default'].bool,
  keyPath: _propTypes2['default'].arrayOf(_propTypes2['default'].oneOfType([_propTypes2['default'].string, _propTypes2['default'].number])),
  postprocessValue: _propTypes2['default'].func,
  sortObjectKeys: _propTypes2['default'].oneOfType([_propTypes2['default'].func, _propTypes2['default'].bool])
};
JSONTree.defaultProps = {
  shouldExpandNode: expandRootNode,
  hideRoot: false,
  keyPath: ['root'],
  getItemString: defaultItemString,
  labelRenderer: defaultLabelRenderer,
  valueRenderer: identity,
  postprocessValue: identity,
  isCustomNode: noCustomNode,
  collectionLimit: 50,
  invertTheme: true
};
exports['default'] = JSONTree;