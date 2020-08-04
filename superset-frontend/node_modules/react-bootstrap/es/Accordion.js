import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import React from 'react';
import PanelGroup from './PanelGroup';

var Accordion =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Accordion, _React$Component);

  function Accordion() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Accordion.prototype;

  _proto.render = function render() {
    return React.createElement(PanelGroup, _extends({}, this.props, {
      accordion: true
    }), this.props.children);
  };

  return Accordion;
}(React.Component);

export default Accordion;