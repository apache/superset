import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import React from 'react';
import DropdownToggle from './DropdownToggle';

var SplitToggle =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(SplitToggle, _React$Component);

  function SplitToggle() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = SplitToggle.prototype;

  _proto.render = function render() {
    return React.createElement(DropdownToggle, _extends({}, this.props, {
      useAnchor: false,
      noCaret: false
    }));
  };

  return SplitToggle;
}(React.Component);

SplitToggle.defaultProps = DropdownToggle.defaultProps;
export default SplitToggle;