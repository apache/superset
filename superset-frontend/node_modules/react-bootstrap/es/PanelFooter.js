import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import PropTypes from 'prop-types';
import React from 'react';
import cn from 'classnames';
import { prefix, bsClass, splitBsProps } from './utils/bootstrapUtils';
var contextTypes = {
  $bs_panel: PropTypes.shape({
    bsClass: PropTypes.string
  })
};

var PanelFooter =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(PanelFooter, _React$Component);

  function PanelFooter() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = PanelFooter.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        children = _this$props.children,
        className = _this$props.className;

    var _ref = this.context.$bs_panel || {},
        _bsClass = _ref.bsClass;

    var _splitBsProps = splitBsProps(this.props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    bsProps.bsClass = _bsClass || bsProps.bsClass;
    return React.createElement("div", _extends({}, elementProps, {
      className: cn(className, prefix(bsProps, 'footer'))
    }), children);
  };

  return PanelFooter;
}(React.Component);

PanelFooter.contextTypes = contextTypes;
export default bsClass('panel', PanelFooter);