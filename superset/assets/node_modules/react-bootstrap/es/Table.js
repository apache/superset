import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  striped: PropTypes.bool,
  bordered: PropTypes.bool,
  condensed: PropTypes.bool,
  hover: PropTypes.bool,
  responsive: PropTypes.bool
};

var defaultProps = {
  bordered: false,
  condensed: false,
  hover: false,
  responsive: false,
  striped: false
};

var Table = function (_React$Component) {
  _inherits(Table, _React$Component);

  function Table() {
    _classCallCheck(this, Table);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Table.prototype.render = function render() {
    var _extends2;

    var _props = this.props,
        striped = _props.striped,
        bordered = _props.bordered,
        condensed = _props.condensed,
        hover = _props.hover,
        responsive = _props.responsive,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['striped', 'bordered', 'condensed', 'hover', 'responsive', 'className']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, 'striped')] = striped, _extends2[prefix(bsProps, 'bordered')] = bordered, _extends2[prefix(bsProps, 'condensed')] = condensed, _extends2[prefix(bsProps, 'hover')] = hover, _extends2));

    var table = React.createElement('table', _extends({}, elementProps, {
      className: classNames(className, classes)
    }));

    if (responsive) {
      return React.createElement(
        'div',
        { className: prefix(bsProps, 'responsive') },
        table
      );
    }

    return table;
  };

  return Table;
}(React.Component);

Table.propTypes = propTypes;
Table.defaultProps = defaultProps;

export default bsClass('table', Table);