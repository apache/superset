'use strict';

exports.__esModule = true;

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

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

var _elementType = require('prop-types-extra/lib/elementType');

var _elementType2 = _interopRequireDefault(_elementType);

var _ListGroupItem = require('./ListGroupItem');

var _ListGroupItem2 = _interopRequireDefault(_ListGroupItem);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _ValidComponentChildren = require('./utils/ValidComponentChildren');

var _ValidComponentChildren2 = _interopRequireDefault(_ValidComponentChildren);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  /**
   * You can use a custom element type for this component.
   *
   * If not specified, it will be treated as `'li'` if every child is a
   * non-actionable `<ListGroupItem>`, and `'div'` otherwise.
   */
  componentClass: _elementType2.default
};

function getDefaultComponent(children) {
  if (!children) {
    // FIXME: This is the old behavior. Is this right?
    return 'div';
  }

  if (_ValidComponentChildren2.default.some(children, function (child) {
    return child.type !== _ListGroupItem2.default || child.props.href || child.props.onClick;
  })) {
    return 'div';
  }

  return 'ul';
}

var ListGroup = function (_React$Component) {
  (0, _inherits3.default)(ListGroup, _React$Component);

  function ListGroup() {
    (0, _classCallCheck3.default)(this, ListGroup);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  ListGroup.prototype.render = function render() {
    var _props = this.props,
        children = _props.children,
        _props$componentClass = _props.componentClass,
        Component = _props$componentClass === undefined ? getDefaultComponent(children) : _props$componentClass,
        className = _props.className,
        props = (0, _objectWithoutProperties3.default)(_props, ['children', 'componentClass', 'className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    var useListItem = Component === 'ul' && _ValidComponentChildren2.default.every(children, function (child) {
      return child.type === _ListGroupItem2.default;
    });

    return _react2.default.createElement(
      Component,
      (0, _extends3.default)({}, elementProps, {
        className: (0, _classnames2.default)(className, classes)
      }),
      useListItem ? _ValidComponentChildren2.default.map(children, function (child) {
        return (0, _react.cloneElement)(child, { listItem: true });
      }) : children
    );
  };

  return ListGroup;
}(_react2.default.Component);

ListGroup.propTypes = propTypes;

exports.default = (0, _bootstrapUtils.bsClass)('list-group', ListGroup);
module.exports = exports['default'];