import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import _assertThisInitialized from "@babel/runtime-corejs2/helpers/esm/assertThisInitialized";
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

var PagerItem =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(PagerItem, _React$Component);

  function PagerItem(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleSelect = _this.handleSelect.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    return _this;
  }

  var _proto = PagerItem.prototype;

  _proto.handleSelect = function handleSelect(e) {
    var _this$props = this.props,
        disabled = _this$props.disabled,
        onSelect = _this$props.onSelect,
        eventKey = _this$props.eventKey;

    if (disabled) {
      e.preventDefault();
      return;
    }

    if (onSelect) {
      onSelect(eventKey, e);
    }
  };

  _proto.render = function render() {
    var _this$props2 = this.props,
        disabled = _this$props2.disabled,
        previous = _this$props2.previous,
        next = _this$props2.next,
        onClick = _this$props2.onClick,
        className = _this$props2.className,
        style = _this$props2.style,
        props = _objectWithoutPropertiesLoose(_this$props2, ["disabled", "previous", "next", "onClick", "className", "style"]);

    delete props.onSelect;
    delete props.eventKey;
    return React.createElement("li", {
      className: classNames(className, {
        disabled: disabled,
        previous: previous,
        next: next
      }),
      style: style
    }, React.createElement(SafeAnchor, _extends({}, props, {
      disabled: disabled,
      onClick: createChainedFunction(onClick, this.handleSelect)
    })));
  };

  return PagerItem;
}(React.Component);

PagerItem.propTypes = propTypes;
PagerItem.defaultProps = defaultProps;
export default PagerItem;