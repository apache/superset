import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import all from 'prop-types-extra/lib/all';

import SafeAnchor from './SafeAnchor';
import { bsClass, prefix, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';

var propTypes = {
  /**
   * Highlight the menu item as active.
   */
  active: PropTypes.bool,

  /**
   * Disable the menu item, making it unselectable.
   */
  disabled: PropTypes.bool,

  /**
   * Styles the menu item as a horizontal rule, providing visual separation between
   * groups of menu items.
   */
  divider: all(PropTypes.bool, function (_ref) {
    var divider = _ref.divider,
        children = _ref.children;
    return divider && children ? new Error('Children will not be rendered for dividers') : null;
  }),

  /**
   * Value passed to the `onSelect` handler, useful for identifying the selected menu item.
   */
  eventKey: PropTypes.any,

  /**
   * Styles the menu item as a header label, useful for describing a group of menu items.
   */
  header: PropTypes.bool,

  /**
   * HTML `href` attribute corresponding to `a.href`.
   */
  href: PropTypes.string,

  /**
   * Callback fired when the menu item is clicked.
   */
  onClick: PropTypes.func,

  /**
   * Callback fired when the menu item is selected.
   *
   * ```js
   * (eventKey: any, event: Object) => any
   * ```
   */
  onSelect: PropTypes.func
};

var defaultProps = {
  divider: false,
  disabled: false,
  header: false
};

var MenuItem = function (_React$Component) {
  _inherits(MenuItem, _React$Component);

  function MenuItem(props, context) {
    _classCallCheck(this, MenuItem);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.handleClick = _this.handleClick.bind(_this);
    return _this;
  }

  MenuItem.prototype.handleClick = function handleClick(event) {
    var _props = this.props,
        href = _props.href,
        disabled = _props.disabled,
        onSelect = _props.onSelect,
        eventKey = _props.eventKey;


    if (!href || disabled) {
      event.preventDefault();
    }

    if (disabled) {
      return;
    }

    if (onSelect) {
      onSelect(eventKey, event);
    }
  };

  MenuItem.prototype.render = function render() {
    var _props2 = this.props,
        active = _props2.active,
        disabled = _props2.disabled,
        divider = _props2.divider,
        header = _props2.header,
        onClick = _props2.onClick,
        className = _props2.className,
        style = _props2.style,
        props = _objectWithoutProperties(_props2, ['active', 'disabled', 'divider', 'header', 'onClick', 'className', 'style']);

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['eventKey', 'onSelect']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    if (divider) {
      // Forcibly blank out the children; separators shouldn't render any.
      elementProps.children = undefined;

      return React.createElement('li', _extends({}, elementProps, {
        role: 'separator',
        className: classNames(className, 'divider'),
        style: style
      }));
    }

    if (header) {
      return React.createElement('li', _extends({}, elementProps, {
        role: 'heading',
        className: classNames(className, prefix(bsProps, 'header')),
        style: style
      }));
    }

    return React.createElement(
      'li',
      {
        role: 'presentation',
        className: classNames(className, { active: active, disabled: disabled }),
        style: style
      },
      React.createElement(SafeAnchor, _extends({}, elementProps, {
        role: 'menuitem',
        tabIndex: '-1',
        onClick: createChainedFunction(onClick, this.handleClick)
      }))
    );
  };

  return MenuItem;
}(React.Component);

MenuItem.propTypes = propTypes;
MenuItem.defaultProps = defaultProps;

export default bsClass('dropdown', MenuItem);