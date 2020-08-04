import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import PropTypes from 'prop-types';
import React from 'react';
import { prefix, splitBsProps, bsClass } from './utils/bootstrapUtils';
import Collapse from './Collapse';
var propTypes = {
  /**
   * Callback fired before the component expands
   */
  onEnter: PropTypes.func,

  /**
   * Callback fired after the component starts to expand
   */
  onEntering: PropTypes.func,

  /**
   * Callback fired after the component has expanded
   */
  onEntered: PropTypes.func,

  /**
   * Callback fired before the component collapses
   */
  onExit: PropTypes.func,

  /**
   * Callback fired after the component starts to collapse
   */
  onExiting: PropTypes.func,

  /**
   * Callback fired after the component has collapsed
   */
  onExited: PropTypes.func
};
var contextTypes = {
  $bs_panel: PropTypes.shape({
    headingId: PropTypes.string,
    bodyId: PropTypes.string,
    bsClass: PropTypes.string,
    expanded: PropTypes.bool
  })
};

var PanelCollapse =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(PanelCollapse, _React$Component);

  function PanelCollapse() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = PanelCollapse.prototype;

  _proto.render = function render() {
    var children = this.props.children;

    var _ref = this.context.$bs_panel || {},
        headingId = _ref.headingId,
        bodyId = _ref.bodyId,
        _bsClass = _ref.bsClass,
        expanded = _ref.expanded;

    var _splitBsProps = splitBsProps(this.props),
        bsProps = _splitBsProps[0],
        props = _splitBsProps[1];

    bsProps.bsClass = _bsClass || bsProps.bsClass;

    if (headingId && bodyId) {
      props.id = bodyId;
      props.role = props.role || 'tabpanel';
      props['aria-labelledby'] = headingId;
    }

    return React.createElement(Collapse, _extends({
      in: expanded
    }, props), React.createElement("div", {
      className: prefix(bsProps, 'collapse')
    }, children));
  };

  return PanelCollapse;
}(React.Component);

PanelCollapse.propTypes = propTypes;
PanelCollapse.contextTypes = contextTypes;
export default bsClass('panel', PanelCollapse);