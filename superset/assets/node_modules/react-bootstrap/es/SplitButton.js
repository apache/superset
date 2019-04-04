import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import _extends from 'babel-runtime/helpers/extends';
import React from 'react';
import PropTypes from 'prop-types';

import Button from './Button';
import Dropdown from './Dropdown';
import SplitToggle from './SplitToggle';
import splitComponentProps from './utils/splitComponentProps';

var propTypes = _extends({}, Dropdown.propTypes, {

  // Toggle props.
  bsStyle: PropTypes.string,
  bsSize: PropTypes.string,
  href: PropTypes.string,
  onClick: PropTypes.func,
  /**
   * The content of the split button.
   */
  title: PropTypes.node.isRequired,
  /**
   * Accessible label for the toggle; the value of `title` if not specified.
   */
  toggleLabel: PropTypes.string,

  // Override generated docs from <Dropdown>.
  /**
   * @private
   */
  children: PropTypes.node
});

var SplitButton = function (_React$Component) {
  _inherits(SplitButton, _React$Component);

  function SplitButton() {
    _classCallCheck(this, SplitButton);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  SplitButton.prototype.render = function render() {
    var _props = this.props,
        bsSize = _props.bsSize,
        bsStyle = _props.bsStyle,
        title = _props.title,
        toggleLabel = _props.toggleLabel,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['bsSize', 'bsStyle', 'title', 'toggleLabel', 'children']);

    var _splitComponentProps = splitComponentProps(props, Dropdown.ControlledComponent),
        dropdownProps = _splitComponentProps[0],
        buttonProps = _splitComponentProps[1];

    return React.createElement(
      Dropdown,
      _extends({}, dropdownProps, {
        bsSize: bsSize,
        bsStyle: bsStyle
      }),
      React.createElement(
        Button,
        _extends({}, buttonProps, {
          disabled: props.disabled,
          bsSize: bsSize,
          bsStyle: bsStyle
        }),
        title
      ),
      React.createElement(SplitToggle, {
        'aria-label': toggleLabel || title,
        bsSize: bsSize,
        bsStyle: bsStyle
      }),
      React.createElement(
        Dropdown.Menu,
        null,
        children
      )
    );
  };

  return SplitButton;
}(React.Component);

SplitButton.propTypes = propTypes;

SplitButton.Toggle = SplitToggle;

export default SplitButton;