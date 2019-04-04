'use strict';

exports.__esModule = true;

var _values = require('babel-runtime/core-js/object/values');

var _values2 = _interopRequireDefault(_values);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

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

var _Collapse = require('./Collapse');

var _Collapse2 = _interopRequireDefault(_Collapse);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _StyleConfig = require('./utils/StyleConfig');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// TODO: Use uncontrollable.

var propTypes = {
  collapsible: _propTypes2.default.bool,
  onSelect: _propTypes2.default.func,
  header: _propTypes2.default.node,
  id: _propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.number]),
  footer: _propTypes2.default.node,
  defaultExpanded: _propTypes2.default.bool,
  expanded: _propTypes2.default.bool,
  eventKey: _propTypes2.default.any,
  headerRole: _propTypes2.default.string,
  panelRole: _propTypes2.default.string,

  // From Collapse.
  onEnter: _propTypes2.default.func,
  onEntering: _propTypes2.default.func,
  onEntered: _propTypes2.default.func,
  onExit: _propTypes2.default.func,
  onExiting: _propTypes2.default.func,
  onExited: _propTypes2.default.func
};

var defaultProps = {
  defaultExpanded: false
};

var Panel = function (_React$Component) {
  (0, _inherits3.default)(Panel, _React$Component);

  function Panel(props, context) {
    (0, _classCallCheck3.default)(this, Panel);

    var _this = (0, _possibleConstructorReturn3.default)(this, _React$Component.call(this, props, context));

    _this.handleClickTitle = _this.handleClickTitle.bind(_this);

    _this.state = {
      expanded: _this.props.defaultExpanded
    };
    return _this;
  }

  Panel.prototype.handleClickTitle = function handleClickTitle(e) {
    // FIXME: What the heck? This API is horrible. This needs to go away!
    e.persist();
    e.selected = true;

    if (this.props.onSelect) {
      this.props.onSelect(this.props.eventKey, e);
    } else {
      e.preventDefault();
    }

    if (e.selected) {
      this.setState({ expanded: !this.state.expanded });
    }
  };

  Panel.prototype.renderAnchor = function renderAnchor(header, id, role, expanded) {
    return _react2.default.createElement(
      'a',
      {
        role: role,
        href: id && '#' + id,
        onClick: this.handleClickTitle,
        'aria-controls': id,
        'aria-expanded': expanded,
        'aria-selected': expanded,
        className: expanded ? null : 'collapsed'
      },
      header
    );
  };

  Panel.prototype.renderBody = function renderBody(rawChildren, bsProps) {
    var children = [];
    var bodyChildren = [];

    var bodyClassName = (0, _bootstrapUtils.prefix)(bsProps, 'body');

    function maybeAddBody() {
      if (!bodyChildren.length) {
        return;
      }

      // Derive the key from the index here, since we need to make one up.
      children.push(_react2.default.createElement(
        'div',
        { key: children.length, className: bodyClassName },
        bodyChildren
      ));

      bodyChildren = [];
    }

    // Convert to array so we can re-use keys.
    _react2.default.Children.toArray(rawChildren).forEach(function (child) {
      if (_react2.default.isValidElement(child) && child.props.fill) {
        maybeAddBody();

        // Remove the child's unknown `fill` prop.
        children.push((0, _react.cloneElement)(child, { fill: undefined }));

        return;
      }

      bodyChildren.push(child);
    });

    maybeAddBody();

    return children;
  };

  Panel.prototype.renderCollapsibleBody = function renderCollapsibleBody(id, expanded, role, children, bsProps, animationHooks) {
    return _react2.default.createElement(
      _Collapse2.default,
      (0, _extends3.default)({ 'in': expanded }, animationHooks),
      _react2.default.createElement(
        'div',
        {
          id: id,
          role: role,
          className: (0, _bootstrapUtils.prefix)(bsProps, 'collapse'),
          'aria-hidden': !expanded
        },
        this.renderBody(children, bsProps)
      )
    );
  };

  Panel.prototype.renderHeader = function renderHeader(collapsible, header, id, role, expanded, bsProps) {
    var titleClassName = (0, _bootstrapUtils.prefix)(bsProps, 'title');

    if (!collapsible) {
      if (!_react2.default.isValidElement(header)) {
        return header;
      }

      return (0, _react.cloneElement)(header, {
        className: (0, _classnames2.default)(header.props.className, titleClassName)
      });
    }

    if (!_react2.default.isValidElement(header)) {
      return _react2.default.createElement(
        'h4',
        { role: 'presentation', className: titleClassName },
        this.renderAnchor(header, id, role, expanded)
      );
    }

    return (0, _react.cloneElement)(header, {
      className: (0, _classnames2.default)(header.props.className, titleClassName),
      children: this.renderAnchor(header.props.children, id, role, expanded)
    });
  };

  Panel.prototype.render = function render() {
    var _props = this.props,
        collapsible = _props.collapsible,
        header = _props.header,
        id = _props.id,
        footer = _props.footer,
        propsExpanded = _props.expanded,
        headerRole = _props.headerRole,
        panelRole = _props.panelRole,
        className = _props.className,
        children = _props.children,
        onEnter = _props.onEnter,
        onEntering = _props.onEntering,
        onEntered = _props.onEntered,
        onExit = _props.onExit,
        onExiting = _props.onExiting,
        onExited = _props.onExited,
        props = (0, _objectWithoutProperties3.default)(_props, ['collapsible', 'header', 'id', 'footer', 'expanded', 'headerRole', 'panelRole', 'className', 'children', 'onEnter', 'onEntering', 'onEntered', 'onExit', 'onExiting', 'onExited']);

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['defaultExpanded', 'eventKey', 'onSelect']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    var expanded = propsExpanded != null ? propsExpanded : this.state.expanded;

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    return _react2.default.createElement(
      'div',
      (0, _extends3.default)({}, elementProps, {
        className: (0, _classnames2.default)(className, classes),
        id: collapsible ? null : id
      }),
      header && _react2.default.createElement(
        'div',
        { className: (0, _bootstrapUtils.prefix)(bsProps, 'heading') },
        this.renderHeader(collapsible, header, id, headerRole, expanded, bsProps)
      ),
      collapsible ? this.renderCollapsibleBody(id, expanded, panelRole, children, bsProps, { onEnter: onEnter, onEntering: onEntering, onEntered: onEntered, onExit: onExit, onExiting: onExiting, onExited: onExited }) : this.renderBody(children, bsProps),
      footer && _react2.default.createElement(
        'div',
        { className: (0, _bootstrapUtils.prefix)(bsProps, 'footer') },
        footer
      )
    );
  };

  return Panel;
}(_react2.default.Component);

Panel.propTypes = propTypes;
Panel.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('panel', (0, _bootstrapUtils.bsStyles)([].concat((0, _values2.default)(_StyleConfig.State), [_StyleConfig.Style.DEFAULT, _StyleConfig.Style.PRIMARY]), _StyleConfig.Style.DEFAULT, Panel));
module.exports = exports['default'];