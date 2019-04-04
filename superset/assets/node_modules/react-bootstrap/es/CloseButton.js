import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import PropTypes from 'prop-types';
import React from 'react';

var propTypes = {
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func
};

var defaultProps = {
  label: 'Close'
};

var CloseButton = function (_React$Component) {
  _inherits(CloseButton, _React$Component);

  function CloseButton() {
    _classCallCheck(this, CloseButton);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  CloseButton.prototype.render = function render() {
    var _props = this.props,
        label = _props.label,
        onClick = _props.onClick;

    return React.createElement(
      'button',
      {
        type: 'button',
        className: 'close',
        onClick: onClick
      },
      React.createElement(
        'span',
        { 'aria-hidden': 'true' },
        '\xD7'
      ),
      React.createElement(
        'span',
        { className: 'sr-only' },
        label
      )
    );
  };

  return CloseButton;
}(React.Component);

CloseButton.propTypes = propTypes;
CloseButton.defaultProps = defaultProps;

export default CloseButton;