import _extends from 'babel-runtime/helpers/extends';
import _Object$assign from 'babel-runtime/core-js/object/assign';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React, { cloneElement } from 'react';
import PropTypes from 'prop-types';

import { bsClass, getClassSet, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';
import ValidComponentChildren from './utils/ValidComponentChildren';

var propTypes = {
  accordion: PropTypes.bool,
  activeKey: PropTypes.any,
  defaultActiveKey: PropTypes.any,
  onSelect: PropTypes.func,
  role: PropTypes.string
};

var defaultProps = {
  accordion: false
};

// TODO: Use uncontrollable.

var PanelGroup = function (_React$Component) {
  _inherits(PanelGroup, _React$Component);

  function PanelGroup(props, context) {
    _classCallCheck(this, PanelGroup);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.handleSelect = _this.handleSelect.bind(_this);

    _this.state = {
      activeKey: props.defaultActiveKey
    };
    return _this;
  }

  PanelGroup.prototype.handleSelect = function handleSelect(key, e) {
    e.preventDefault();

    if (this.props.onSelect) {
      this.props.onSelect(key, e);
    }

    if (this.state.activeKey === key) {
      key = null;
    }

    this.setState({ activeKey: key });
  };

  PanelGroup.prototype.render = function render() {
    var _this2 = this;

    var _props = this.props,
        accordion = _props.accordion,
        propsActiveKey = _props.activeKey,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['accordion', 'activeKey', 'className', 'children']);

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['defaultActiveKey', 'onSelect']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    var activeKey = void 0;
    if (accordion) {
      activeKey = propsActiveKey != null ? propsActiveKey : this.state.activeKey;
      elementProps.role = elementProps.role || 'tablist';
    }

    var classes = getClassSet(bsProps);

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        className: classNames(className, classes)
      }),
      ValidComponentChildren.map(children, function (child) {
        var childProps = {
          bsStyle: child.props.bsStyle || bsProps.bsStyle
        };

        if (accordion) {
          _Object$assign(childProps, {
            headerRole: 'tab',
            panelRole: 'tabpanel',
            collapsible: true,
            expanded: child.props.eventKey === activeKey,
            onSelect: createChainedFunction(_this2.handleSelect, child.props.onSelect)
          });
        }

        return cloneElement(child, childProps);
      })
    );
  };

  return PanelGroup;
}(React.Component);

PanelGroup.propTypes = propTypes;
PanelGroup.defaultProps = defaultProps;

export default bsClass('panel-group', PanelGroup);