import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import _extends from 'babel-runtime/helpers/extends';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import Dropdown from './Dropdown';
import splitComponentProps from './utils/splitComponentProps';
import ValidComponentChildren from './utils/ValidComponentChildren';

var propTypes = _extends({}, Dropdown.propTypes, {

  // Toggle props.
  title: PropTypes.node.isRequired,
  noCaret: PropTypes.bool,
  active: PropTypes.bool,

  // Override generated docs from <Dropdown>.
  /**
   * @private
   */
  children: PropTypes.node
});

var NavDropdown = function (_React$Component) {
  _inherits(NavDropdown, _React$Component);

  function NavDropdown() {
    _classCallCheck(this, NavDropdown);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  NavDropdown.prototype.isActive = function isActive(_ref, activeKey, activeHref) {
    var props = _ref.props;

    var _this2 = this;

    if (props.active || activeKey != null && props.eventKey === activeKey || activeHref && props.href === activeHref) {
      return true;
    }

    if (ValidComponentChildren.some(props.children, function (child) {
      return _this2.isActive(child, activeKey, activeHref);
    })) {
      return true;
    }

    return props.active;
  };

  NavDropdown.prototype.render = function render() {
    var _this3 = this;

    var _props = this.props,
        title = _props.title,
        activeKey = _props.activeKey,
        activeHref = _props.activeHref,
        className = _props.className,
        style = _props.style,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['title', 'activeKey', 'activeHref', 'className', 'style', 'children']);

    var active = this.isActive(this, activeKey, activeHref);
    delete props.active; // Accessed via this.isActive().
    delete props.eventKey; // Accessed via this.isActive().

    var _splitComponentProps = splitComponentProps(props, Dropdown.ControlledComponent),
        dropdownProps = _splitComponentProps[0],
        toggleProps = _splitComponentProps[1];

    // Unlike for the other dropdowns, styling needs to go to the `<Dropdown>`
    // rather than the `<Dropdown.Toggle>`.

    return React.createElement(
      Dropdown,
      _extends({}, dropdownProps, {
        componentClass: 'li',
        className: classNames(className, { active: active }),
        style: style
      }),
      React.createElement(
        Dropdown.Toggle,
        _extends({}, toggleProps, { useAnchor: true }),
        title
      ),
      React.createElement(
        Dropdown.Menu,
        null,
        ValidComponentChildren.map(children, function (child) {
          return React.cloneElement(child, {
            active: _this3.isActive(child, activeKey, activeHref)
          });
        })
      )
    );
  };

  return NavDropdown;
}(React.Component);

NavDropdown.propTypes = propTypes;

export default NavDropdown;