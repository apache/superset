'use strict';

exports.__esModule = true;

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _createChainedFunction = require('./utils/createChainedFunction');

var _createChainedFunction2 = _interopRequireDefault(_createChainedFunction);

var _ValidComponentChildren = require('./utils/ValidComponentChildren');

var _ValidComponentChildren2 = _interopRequireDefault(_ValidComponentChildren);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  accordion: _propTypes2.default.bool,
  activeKey: _propTypes2.default.any,
  defaultActiveKey: _propTypes2.default.any,
  onSelect: _propTypes2.default.func,
  role: _propTypes2.default.string
};

var defaultProps = {
  accordion: false
};

// TODO: Use uncontrollable.

var PanelGroup = function (_React$Component) {
  (0, _inherits3.default)(PanelGroup, _React$Component);

  function PanelGroup(props, context) {
    (0, _classCallCheck3.default)(this, PanelGroup);

    var _this = (0, _possibleConstructorReturn3.default)(this, _React$Component.call(this, props, context));

    _this.handleSelect = _this.handleSelect.bind(_this);

    _this.state = {
      activeKey: props.defaultActiveKey
    };
    return _this;
  }

  PanelGroup.prototype.handleSelect = function handleSelect(key, e) {
    e.preventDefault();

    if (this.props.onSelect) {
      this.props.onSelect(key, e);
    }

    if (this.state.activeKey === key) {
      key = null;
    }

    this.setState({ activeKey: key });
  };

  PanelGroup.prototype.render = function render() {
    var _this2 = this;

    var _props = this.props,
        accordion = _props.accordion,
        propsActiveKey = _props.activeKey,
        className = _props.className,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['accordion', 'activeKey', 'className', 'children']);

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['defaultActiveKey', 'onSelect']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    var activeKey = void 0;
    if (accordion) {
      activeKey = propsActiveKey != null ? propsActiveKey : this.state.activeKey;
      elementProps.role = elementProps.role || 'tablist';
    }

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    return _react2.default.createElement(
      'div',
      (0, _extends3.default)({}, elementProps, {
        className: (0, _classnames2.default)(className, classes)
      }),
      _ValidComponentChildren2.default.map(children, function (child) {
        var childProps = {
          bsStyle: child.props.bsStyle || bsProps.bsStyle
        };

        if (accordion) {
          (0, _assign2.default)(childProps, {
            headerRole: 'tab',
            panelRole: 'tabpanel',
            collapsible: true,
            expanded: child.props.eventKey === activeKey,
            onSelect: (0, _createChainedFunction2.default)(_this2.handleSelect, child.props.onSelect)
          });
        }

        return (0, _react.cloneElement)(child, childProps);
      })
    );
  };

  return PanelGroup;
}(_react2.default.Component);

PanelGroup.propTypes = propTypes;
PanelGroup.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('panel-group', PanelGroup);
module.exports = exports['default'];