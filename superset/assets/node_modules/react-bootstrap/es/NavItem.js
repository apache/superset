import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import SafeAnchor from './SafeAnchor';
import createChainedFunction from './utils/createChainedFunction';

var propTypes = {
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  role: PropTypes.string,
  href: PropTypes.string,
  onClick: PropTypes.func,
  onSelect: PropTypes.func,
  eventKey: PropTypes.any
};

var defaultProps = {
  active: false,
  disabled: false
};

var NavItem = function (_React$Component) {
  _inherits(NavItem, _React$Component);

  function NavItem(props, context) {
    _classCallCheck(this, NavItem);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.handleClick = _this.handleClick.bind(_this);
    return _this;
  }

  NavItem.prototype.handleClick = function handleClick(e) {
    if (this.props.onSelect) {
      e.preventDefault();

      if (!this.props.disabled) {
        this.props.onSelect(this.props.eventKey, e);
      }
    }
  };

  NavItem.prototype.render = function render() {
    var _props = this.props,
        active = _props.active,
        disabled = _props.disabled,
        onClick = _props.onClick,
        className = _props.className,
        style = _props.style,
        props = _objectWithoutProperties(_props, ['active', 'disabled', 'onClick', 'className', 'style']);

    delete props.onSelect;
    delete props.eventKey;

    // These are injected down by `<Nav>` for building `<SubNav>`s.
    delete props.activeKey;
    delete props.activeHref;

    if (!props.role) {
      if (props.href === '#') {
        props.role = 'button';
      }
    } else if (props.role === 'tab') {
      props['aria-selected'] = active;
    }

    return React.createElement(
      'li',
      {
        role: 'presentation',
        className: classNames(className, { active: active, disabled: disabled }),
        style: style
      },
      React.createElement(SafeAnchor, _extends({}, props, {
        disabled: disabled,
        onClick: createChainedFunction(onClick, this.handleClick)
      }))
    );
  };

  return NavItem;
}(React.Component);

NavItem.propTypes = propTypes;
NavItem.defaultProps = defaultProps;

export default NavItem;