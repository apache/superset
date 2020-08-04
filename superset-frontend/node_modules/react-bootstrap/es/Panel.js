import _Object$assign from "@babel/runtime-corejs2/core-js/object/assign";
import _Object$values from "@babel/runtime-corejs2/core-js/object/values";
import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { uncontrollable } from 'uncontrollable';
import warning from 'warning';
import { bsStyles, bsClass, getClassSet, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import { State, Style } from './utils/StyleConfig';
import Body from './PanelBody';
import Heading from './PanelHeading';
import Title from './PanelTitle';
import Footer from './PanelFooter';
import Toggle from './PanelToggle';
import Collapse from './PanelCollapse';
var has = Object.prototype.hasOwnProperty;

var defaultGetId = function defaultGetId(id, type) {
  return id ? id + "--" + type : null;
};

var propTypes = {
  /**
   * Controls the collapsed/expanded state ofthe Panel. Requires
   * a `Panel.Collapse` or `<Panel.Body collapsible>` child component
   * in order to actually animate out or in.
   *
   * @controllable onToggle
   */
  expanded: PropTypes.bool,

  /**
   * A callback fired when the collapse state changes.
   *
   * @controllable expanded
   */
  onToggle: PropTypes.func,
  eventKey: PropTypes.any,

  /**
   * An HTML `id` attribute uniquely identifying the Panel component.
   */
  id: PropTypes.string
};
var contextTypes = {
  $bs_panelGroup: PropTypes.shape({
    getId: PropTypes.func,
    activeKey: PropTypes.any,
    onToggle: PropTypes.func
  })
};
var childContextTypes = {
  $bs_panel: PropTypes.shape({
    headingId: PropTypes.string,
    bodyId: PropTypes.string,
    bsClass: PropTypes.string,
    onToggle: PropTypes.func,
    expanded: PropTypes.bool
  })
};

var Panel =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Panel, _React$Component);

  function Panel() {
    var _this;

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    _this = _React$Component.call.apply(_React$Component, [this].concat(args)) || this;

    _this.handleToggle = function (e) {
      var panelGroup = _this.context.$bs_panelGroup;
      var expanded = !_this.getExpanded();

      if (panelGroup && panelGroup.onToggle) {
        panelGroup.onToggle(_this.props.eventKey, expanded, e);
      } else {
        _this.props.onToggle(expanded, e);
      }
    };

    return _this;
  }

  var _proto = Panel.prototype;

  _proto.getChildContext = function getChildContext() {
    var _this$props = this.props,
        eventKey = _this$props.eventKey,
        id = _this$props.id;
    var idKey = eventKey == null ? id : eventKey;
    var ids;

    if (idKey !== null) {
      var panelGroup = this.context.$bs_panelGroup;
      var getId = panelGroup && panelGroup.getId || defaultGetId;
      ids = {
        headingId: getId(idKey, 'heading'),
        bodyId: getId(idKey, 'body')
      };
    }

    return {
      $bs_panel: _extends({}, ids, {
        bsClass: this.props.bsClass,
        expanded: this.getExpanded(),
        onToggle: this.handleToggle
      })
    };
  };

  _proto.getExpanded = function getExpanded() {
    var panelGroup = this.context.$bs_panelGroup;

    if (panelGroup && has.call(panelGroup, 'activeKey')) {
      process.env.NODE_ENV !== "production" ? warning(this.props.expanded == null, 'Specifying `<Panel>` `expanded` in the context of an accordion ' + '`<PanelGroup>` is not supported. Set `activeKey` on the ' + '`<PanelGroup>` instead.') : void 0;
      return panelGroup.activeKey === this.props.eventKey;
    }

    return !!this.props.expanded;
  };

  _proto.render = function render() {
    var _this$props2 = this.props,
        className = _this$props2.className,
        children = _this$props2.children;

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(this.props, ['onToggle', 'eventKey', 'expanded']),
        bsProps = _splitBsPropsAndOmit[0],
        props = _splitBsPropsAndOmit[1];

    return React.createElement("div", _extends({}, props, {
      className: classNames(className, getClassSet(bsProps))
    }), children);
  };

  return Panel;
}(React.Component);

Panel.propTypes = propTypes;
Panel.contextTypes = contextTypes;
Panel.childContextTypes = childContextTypes;
var UncontrolledPanel = uncontrollable(bsClass('panel', bsStyles(_Object$values(State).concat([Style.DEFAULT, Style.PRIMARY]), Style.DEFAULT, Panel)), {
  expanded: 'onToggle'
});

_Object$assign(UncontrolledPanel, {
  Heading: Heading,
  Title: Title,
  Body: Body,
  Footer: Footer,
  Toggle: Toggle,
  Collapse: Collapse
});

export default UncontrolledPanel;