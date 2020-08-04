import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import _assertThisInitialized from "@babel/runtime-corejs2/helpers/esm/assertThisInitialized";
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import elementType from 'react-prop-types/lib/elementType';
import SafeAnchor from './SafeAnchor';
import createChainedFunction from './utils/createChainedFunction';
var propTypes = {
  /**
   * only here to satisfy linting, just the html onClick handler.
   *
   * @private
   */
  onClick: PropTypes.func,

  /**
   * You can use a custom element for this component
   */
  componentClass: elementType
};
var defaultProps = {
  componentClass: SafeAnchor
};
var contextTypes = {
  $bs_panel: PropTypes.shape({
    bodyId: PropTypes.string,
    onToggle: PropTypes.func,
    expanded: PropTypes.bool
  })
};

var PanelToggle =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(PanelToggle, _React$Component);

  function PanelToggle() {
    var _this;

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    _this = _React$Component.call.apply(_React$Component, [this].concat(args)) || this;
    _this.handleToggle = _this.handleToggle.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    return _this;
  }

  var _proto = PanelToggle.prototype;

  _proto.handleToggle = function handleToggle(event) {
    var _ref = this.context.$bs_panel || {},
        onToggle = _ref.onToggle;

    if (onToggle) {
      onToggle(event);
    }
  };

  _proto.render = function render() {
    var _this$props = this.props,
        onClick = _this$props.onClick,
        className = _this$props.className,
        componentClass = _this$props.componentClass,
        props = _objectWithoutPropertiesLoose(_this$props, ["onClick", "className", "componentClass"]);

    var _ref2 = this.context.$bs_panel || {},
        expanded = _ref2.expanded,
        bodyId = _ref2.bodyId;

    var Component = componentClass;
    props.onClick = createChainedFunction(onClick, this.handleToggle);
    props['aria-expanded'] = expanded;
    props.className = classNames(className, !expanded && 'collapsed');

    if (bodyId) {
      props['aria-controls'] = bodyId;
    }

    return React.createElement(Component, props);
  };

  return PanelToggle;
}(React.Component);

PanelToggle.propTypes = propTypes;
PanelToggle.defaultProps = defaultProps;
PanelToggle.contextTypes = contextTypes;
export default PanelToggle;