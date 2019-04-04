import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Button from './Button';
import SafeAnchor from './SafeAnchor';

import { bsClass as setBsClass } from './utils/bootstrapUtils';

var propTypes = {
  noCaret: PropTypes.bool,
  open: PropTypes.bool,
  title: PropTypes.string,
  useAnchor: PropTypes.bool
};

var defaultProps = {
  open: false,
  useAnchor: false,
  bsRole: 'toggle'
};

var DropdownToggle = function (_React$Component) {
  _inherits(DropdownToggle, _React$Component);

  function DropdownToggle() {
    _classCallCheck(this, DropdownToggle);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  DropdownToggle.prototype.render = function render() {
    var _props = this.props,
        noCaret = _props.noCaret,
        open = _props.open,
        useAnchor = _props.useAnchor,
        bsClass = _props.bsClass,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['noCaret', 'open', 'useAnchor', 'bsClass', 'className', 'children']);

    delete props.bsRole;

    var Component = useAnchor ? SafeAnchor : Button;
    var useCaret = !noCaret;

    // This intentionally forwards bsSize and bsStyle (if set) to the
    // underlying component, to allow it to render size and style variants.

    // FIXME: Should this really fall back to `title` as children?

    return React.createElement(
      Component,
      _extends({}, props, {
        role: 'button',
        className: classNames(className, bsClass),
        'aria-haspopup': true,
        'aria-expanded': open
      }),
      children || props.title,
      useCaret && ' ',
      useCaret && React.createElement('span', { className: 'caret' })
    );
  };

  return DropdownToggle;
}(React.Component);

DropdownToggle.propTypes = propTypes;
DropdownToggle.defaultProps = defaultProps;

export default setBsClass('dropdown-toggle', DropdownToggle);