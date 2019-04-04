import _extends from 'babel-runtime/helpers/extends';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import React from 'react';

import PanelGroup from './PanelGroup';

var Accordion = function (_React$Component) {
  _inherits(Accordion, _React$Component);

  function Accordion() {
    _classCallCheck(this, Accordion);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Accordion.prototype.render = function render() {
    return React.createElement(
      PanelGroup,
      _extends({}, this.props, { accordion: true }),
      this.props.children
    );
  };

  return Accordion;
}(React.Component);

export default Accordion;