import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import elementType from 'prop-types-extra/lib/elementType';

import SafeAnchor from './SafeAnchor';
import createChainedFunction from './utils/createChainedFunction';

// TODO: This should be `<Pagination.Item>`.

// TODO: This should use `componentClass` like other components.

var propTypes = {
  componentClass: elementType,
  className: PropTypes.string,
  eventKey: PropTypes.any,
  onSelect: PropTypes.func,
  disabled: PropTypes.bool,
  active: PropTypes.bool,
  onClick: PropTypes.func
};

var defaultProps = {
  componentClass: SafeAnchor,
  active: false,
  disabled: false
};

var PaginationButton = function (_React$Component) {
  _inherits(PaginationButton, _React$Component);

  function PaginationButton(props, context) {
    _classCallCheck(this, PaginationButton);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.handleClick = _this.handleClick.bind(_this);
    return _this;
  }

  PaginationButton.prototype.handleClick = function handleClick(event) {
    var _props = this.props,
        disabled = _props.disabled,
        onSelect = _props.onSelect,
        eventKey = _props.eventKey;


    if (disabled) {
      return;
    }

    if (onSelect) {
      onSelect(eventKey, event);
    }
  };

  PaginationButton.prototype.render = function render() {
    var _props2 = this.props,
        Component = _props2.componentClass,
        active = _props2.active,
        disabled = _props2.disabled,
        onClick = _props2.onClick,
        className = _props2.className,
        style = _props2.style,
        props = _objectWithoutProperties(_props2, ['componentClass', 'active', 'disabled', 'onClick', 'className', 'style']);

    if (Component === SafeAnchor) {
      // Assume that custom components want `eventKey`.
      delete props.eventKey;
    }

    delete props.onSelect;

    return React.createElement(
      'li',
      {
        className: classNames(className, { active: active, disabled: disabled }),
        style: style
      },
      React.createElement(Component, _extends({}, props, {
        disabled: disabled,
        onClick: createChainedFunction(onClick, this.handleClick)
      }))
    );
  };

  return PaginationButton;
}(React.Component);

PaginationButton.propTypes = propTypes;
PaginationButton.defaultProps = defaultProps;

export default PaginationButton;