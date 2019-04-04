import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React, { cloneElement } from 'react';
import PropTypes from 'prop-types';

import PagerItem from './PagerItem';
import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';
import ValidComponentChildren from './utils/ValidComponentChildren';

var propTypes = {
  onSelect: PropTypes.func
};

var Pager = function (_React$Component) {
  _inherits(Pager, _React$Component);

  function Pager() {
    _classCallCheck(this, Pager);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Pager.prototype.render = function render() {
    var _props = this.props,
        onSelect = _props.onSelect,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['onSelect', 'className', 'children']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    return React.createElement(
      'ul',
      _extends({}, elementProps, {
        className: classNames(className, classes)
      }),
      ValidComponentChildren.map(children, function (child) {
        return cloneElement(child, {
          onSelect: createChainedFunction(child.props.onSelect, onSelect)
        });
      })
    );
  };

  return Pager;
}(React.Component);

Pager.propTypes = propTypes;

Pager.Item = PagerItem;

export default bsClass('pager', Pager);