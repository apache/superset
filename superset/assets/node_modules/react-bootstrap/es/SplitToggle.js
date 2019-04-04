import _extends from 'babel-runtime/helpers/extends';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import React from 'react';

import DropdownToggle from './DropdownToggle';

var SplitToggle = function (_React$Component) {
  _inherits(SplitToggle, _React$Component);

  function SplitToggle() {
    _classCallCheck(this, SplitToggle);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  SplitToggle.prototype.render = function render() {
    return React.createElement(DropdownToggle, _extends({}, this.props, {
      useAnchor: false,
      noCaret: false
    }));
  };

  return SplitToggle;
}(React.Component);

SplitToggle.defaultProps = DropdownToggle.defaultProps;

export default SplitToggle;