import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import _extends from 'babel-runtime/helpers/extends';
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

var Tab = function (_React$Component) {
  _inherits(Tab, _React$Component);

  function Tab() {
    _classCallCheck(this, Tab);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Tab.prototype.render = function render() {
    var props = _extends({}, this.props);

    // These props are for the parent `<Tabs>` rather than the `<TabPane>`.
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