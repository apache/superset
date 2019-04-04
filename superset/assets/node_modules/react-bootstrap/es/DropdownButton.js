import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import _extends from 'babel-runtime/helpers/extends';
import React from 'react';
import PropTypes from 'prop-types';

import Dropdown from './Dropdown';
import splitComponentProps from './utils/splitComponentProps';

var propTypes = _extends({}, Dropdown.propTypes, {

  // Toggle props.
  bsStyle: PropTypes.string,
  bsSize: PropTypes.string,
  title: PropTypes.node.isRequired,
  noCaret: PropTypes.bool,

  // Override generated docs from <Dropdown>.
  /**
   * @private
   */
  children: PropTypes.node
});

var DropdownButton = function (_React$Component) {
  _inherits(DropdownButton, _React$Component);

  function DropdownButton() {
    _classCallCheck(this, DropdownButton);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  DropdownButton.prototype.render = function render() {
    var _props = this.props,
        bsSize = _props.bsSize,
        bsStyle = _props.bsStyle,
        title = _props.title,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['bsSize', 'bsStyle', 'title', 'children']);

    var _splitComponentProps = splitComponentProps(props, Dropdown.ControlledComponent),
        dropdownProps = _splitComponentProps[0],
        toggleProps = _splitComponentProps[1];

    return React.createElement(
      Dropdown,
      _extends({}, dropdownProps, {
        bsSize: bsSize,
        bsStyle: bsStyle
      }),
      React.createElement(
        Dropdown.Toggle,
        _extends({}, toggleProps, {
          bsSize: bsSize,
          bsStyle: bsStyle
        }),
        title
      ),
      React.createElement(
        Dropdown.Menu,
        null,
        children
      )
    );
  };

  return DropdownButton;
}(React.Component);

DropdownButton.propTypes = propTypes;

export default DropdownButton;