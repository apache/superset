import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { cloneElement } from 'react';
import { uncontrollable } from 'uncontrollable';
import { bsClass, getClassSet, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import ValidComponentChildren from './utils/ValidComponentChildren';
import { generatedId } from './utils/PropTypes';
var propTypes = {
  accordion: PropTypes.bool,

  /**
   * When `accordion` is enabled, `activeKey` controls the which child `Panel` is expanded. `activeKey` should
   * match a child Panel `eventKey` prop exactly.
   *
   * @controllable onSelect
   */
  activeKey: PropTypes.any,

  /**
   * A callback fired when a child Panel collapse state changes. It's called with the next expanded `activeKey`
   *
   * @controllable activeKey
   */
  onSelect: PropTypes.func,

  /**
   * An HTML role attribute
   */
  role: PropTypes.string,

  /**
   * A function that takes an eventKey and type and returns a
   * unique id for each Panel heading and Panel Collapse. The function _must_ be a pure function,
   * meaning it should always return the _same_ id for the same set of inputs. The default
   * value requires that an `id` to be set for the PanelGroup.
   *
   * The `type` argument will either be `"body"` or `"heading"`.
   *
   * @defaultValue (eventKey, type) => `${this.props.id}-${type}-${key}`
   */
  generateChildId: PropTypes.func,

  /**
   * HTML id attribute, required if no `generateChildId` prop
   * is specified.
   */
  id: generatedId('PanelGroup')
};
var defaultProps = {
  accordion: false
};
var childContextTypes = {
  $bs_panelGroup: PropTypes.shape({
    getId: PropTypes.func,
    headerRole: PropTypes.string,
    panelRole: PropTypes.string,
    activeKey: PropTypes.any,
    onToggle: PropTypes.func
  })
};

var PanelGroup =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(PanelGroup, _React$Component);

  function PanelGroup() {
    var _this;

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    _this = _React$Component.call.apply(_React$Component, [this].concat(args)) || this;

    _this.handleSelect = function (key, expanded, e) {
      if (expanded) {
        _this.props.onSelect(key, e);
      } else if (_this.props.activeKey === key) {
        _this.props.onSelect(null, e);
      }
    };

    return _this;
  }

  var _proto = PanelGroup.prototype;

  _proto.getChildContext = function getChildContext() {
    var _this$props = this.props,
        activeKey = _this$props.activeKey,
        accordion = _this$props.accordion,
        generateChildId = _this$props.generateChildId,
        id = _this$props.id;
    var getId = null;

    if (accordion) {
      getId = generateChildId || function (key, type) {
        return id ? id + "-" + type + "-" + key : null;
      };
    }

    return {
      $bs_panelGroup: _extends({
        getId: getId,
        headerRole: 'tab',
        panelRole: 'tabpanel'
      }, accordion && {
        activeKey: activeKey,
        onToggle: this.handleSelect
      })
    };
  };

  _proto.render = function render() {
    var _this$props2 = this.props,
        accordion = _this$props2.accordion,
        className = _this$props2.className,
        children = _this$props2.children,
        props = _objectWithoutPropertiesLoose(_this$props2, ["accordion", "className", "children"]);

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['onSelect', 'activeKey']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    if (accordion) {
      elementProps.role = elementProps.role || 'tablist';
    }

    var classes = getClassSet(bsProps);
    return React.createElement("div", _extends({}, elementProps, {
      className: classNames(className, classes)
    }), ValidComponentChildren.map(children, function (child) {
      return cloneElement(child, {
        bsStyle: child.props.bsStyle || bsProps.bsStyle
      });
    }));
  };

  return PanelGroup;
}(React.Component);

PanelGroup.propTypes = propTypes;
PanelGroup.defaultProps = defaultProps;
PanelGroup.childContextTypes = childContextTypes;
export default uncontrollable(bsClass('panel-group', PanelGroup), {
  activeKey: 'onSelect'
});