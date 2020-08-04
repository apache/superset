import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import cn from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import elementType from 'react-prop-types/lib/elementType';
import { prefix, splitBsProps, bsClass } from './utils/bootstrapUtils';
import PanelToggle from './PanelToggle';
var propTypes = {
  componentClass: elementType,

  /**
   * A convenience prop that renders the Panel.Title as a panel collapse toggle component
   * for the common use-case.
   */
  toggle: PropTypes.bool
};
var contextTypes = {
  $bs_panel: PropTypes.shape({
    bsClass: PropTypes.string
  })
};
var defaultProps = {
  componentClass: 'div'
};

var PanelTitle =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(PanelTitle, _React$Component);

  function PanelTitle() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = PanelTitle.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        children = _this$props.children,
        className = _this$props.className,
        toggle = _this$props.toggle,
        Component = _this$props.componentClass,
        props = _objectWithoutPropertiesLoose(_this$props, ["children", "className", "toggle", "componentClass"]);

    var _ref = this.context.$bs_panel || {},
        _bsClass = _ref.bsClass;

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    bsProps.bsClass = _bsClass || bsProps.bsClass;

    if (toggle) {
      children = React.createElement(PanelToggle, null, children);
    }

    return React.createElement(Component, _extends({}, elementProps, {
      className: cn(className, prefix(bsProps, 'title'))
    }), children);
  };

  return PanelTitle;
}(React.Component);

PanelTitle.propTypes = propTypes;
PanelTitle.defaultProps = defaultProps;
PanelTitle.contextTypes = contextTypes;
export default bsClass('panel', PanelTitle);