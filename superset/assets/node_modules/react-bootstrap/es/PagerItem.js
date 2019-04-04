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
  disabled: PropTypes.bool,
  previous: PropTypes.bool,
  next: PropTypes.bool,
  onClick: PropTypes.func,
  onSelect: PropTypes.func,
  eventKey: PropTypes.any
};

var defaultProps = {
  disabled: false,
  previous: false,
  next: false
};

var PagerItem = function (_React$Component) {
  _inherits(PagerItem, _React$Component);

  function PagerItem(props, context) {
    _classCallCheck(this, PagerItem);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.handleSelect = _this.handleSelect.bind(_this);
    return _this;
  }

  PagerItem.prototype.handleSelect = function handleSelect(e) {
    var _props = this.props,
        disabled = _props.disabled,
        onSelect = _props.onSelect,
        eventKey = _props.eventKey;


    if (onSelect || disabled) {
      e.preventDefault();
    }

    if (disabled) {
      return;
    }

    if (onSelect) {
      onSelect(eventKey, e);
    }
  };

  PagerItem.prototype.render = function render() {
    var _props2 = this.props,
        disabled = _props2.disabled,
        previous = _props2.previous,
        next = _props2.next,
        onClick = _props2.onClick,
        className = _props2.className,
        style = _props2.style,
        props = _objectWithoutProperties(_props2, ['disabled', 'previous', 'next', 'onClick', 'className', 'style']);

    delete props.onSelect;
    delete props.eventKey;

    return React.createElement(
      'li',
      {
        className: classNames(className, { disabled: disabled, previous: previous, next: next }),
        style: style
      },
      React.createElement(SafeAnchor, _extends({}, props, {
        disabled: disabled,
        onClick: createChainedFunction(onClick, this.handleSelect)
      }))
    );
  };

  return PagerItem;
}(React.Component);

PagerItem.propTypes = propTypes;
PagerItem.defaultProps = defaultProps;

export default PagerItem;