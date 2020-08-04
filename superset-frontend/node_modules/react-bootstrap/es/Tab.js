import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import React from 'react';
import PropTypes from 'prop-types';
import TabContainer from './TabContainer';
import TabContent from './TabContent';
import TabPane from './TabPane';

var propTypes = _extends({}, TabPane.propTypes, {
  disabled: PropTypes.bool,
  title: PropTypes.node,

  /**
   * tabClassName is used as className for the associated NavItem
   */
  tabClassName: PropTypes.string
});

var Tab =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Tab, _React$Component);

  function Tab() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Tab.prototype;

  _proto.render = function render() {
    var props = _extends({}, this.props); // These props are for the parent `<Tabs>` rather than the `<TabPane>`.


    delete props.title;
    delete props.disabled;
    delete props.tabClassName;
    return React.createElement(TabPane, props);
  };

  return Tab;
}(React.Component);

Tab.propTypes = propTypes;
Tab.Container = TabContainer;
Tab.Content = TabContent;
Tab.Pane = TabPane;
export default Tab;