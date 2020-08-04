import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import PropTypes from 'prop-types';
import React from 'react';
import cn from 'classnames';
import { prefix, splitBsPropsAndOmit, bsClass } from './utils/bootstrapUtils';
import PanelCollapse from './PanelCollapse';
var propTypes = {
  /**
   * A convenience prop that renders a Collapse component around the Body for
   * situations when the parent Panel only contains a single Panel.Body child.
   *
   * renders:
   * ```jsx
   * <Panel.Collapse>
   *  <Panel.Body />
   * </Panel.Collapse>
   * ```
   */
  collapsible: PropTypes.bool.isRequired
};
var defaultProps = {
  collapsible: false
};
var contextTypes = {
  $bs_panel: PropTypes.shape({
    bsClass: PropTypes.string
  })
};

var PanelBody =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(PanelBody, _React$Component);

  function PanelBody() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = PanelBody.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        children = _this$props.children,
        className = _this$props.className,
        collapsible = _this$props.collapsible;

    var _ref = this.context.$bs_panel || {},
        _bsClass = _ref.bsClass;

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(this.props, ['collapsible']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    bsProps.bsClass = _bsClass || bsProps.bsClass;
    var body = React.createElement("div", _extends({}, elementProps, {
      className: cn(className, prefix(bsProps, 'body'))
    }), children);

    if (collapsible) {
      body = React.createElement(PanelCollapse, null, body);
    }

    return body;
  };

  return PanelBody;
}(React.Component);

PanelBody.propTypes = propTypes;
PanelBody.defaultProps = defaultProps;
PanelBody.contextTypes = contextTypes;
export default bsClass('panel', PanelBody);