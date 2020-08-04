import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
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

var Table =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Table, _React$Component);

  function Table() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Table.prototype;

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        striped = _this$props.striped,
        bordered = _this$props.bordered,
        condensed = _this$props.condensed,
        hover = _this$props.hover,
        responsive = _this$props.responsive,
        className = _this$props.className,
        props = _objectWithoutPropertiesLoose(_this$props, ["striped", "bordered", "condensed", "hover", "responsive", "className"]);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, 'striped')] = striped, _extends2[prefix(bsProps, 'bordered')] = bordered, _extends2[prefix(bsProps, 'condensed')] = condensed, _extends2[prefix(bsProps, 'hover')] = hover, _extends2));

    var table = React.createElement("table", _extends({}, elementProps, {
      className: classNames(className, classes)
    }));

    if (responsive) {
      return React.createElement("div", {
        className: prefix(bsProps, 'responsive')
      }, table);
    }

    return table;
  };

  return Table;
}(React.Component);

Table.propTypes = propTypes;
Table.defaultProps = defaultProps;
export default bsClass('table', Table);