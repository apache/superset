import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import warning from 'warning';

import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  /**
   * Uses `controlId` from `<FormGroup>` if not explicitly specified.
   */
  htmlFor: PropTypes.string,
  srOnly: PropTypes.bool
};

var defaultProps = {
  srOnly: false
};

var contextTypes = {
  $bs_formGroup: PropTypes.object
};

var ControlLabel = function (_React$Component) {
  _inherits(ControlLabel, _React$Component);

  function ControlLabel() {
    _classCallCheck(this, ControlLabel);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ControlLabel.prototype.render = function render() {
    var formGroup = this.context.$bs_formGroup;
    var controlId = formGroup && formGroup.controlId;

    var _props = this.props,
        _props$htmlFor = _props.htmlFor,
        htmlFor = _props$htmlFor === undefined ? controlId : _props$htmlFor,
        srOnly = _props.srOnly,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['htmlFor', 'srOnly', 'className']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    process.env.NODE_ENV !== 'production' ? warning(controlId == null || htmlFor === controlId, '`controlId` is ignored on `<ControlLabel>` when `htmlFor` is specified.') : void 0;

    var classes = _extends({}, getClassSet(bsProps), {
      'sr-only': srOnly
    });

    return React.createElement('label', _extends({}, elementProps, {
      htmlFor: htmlFor,
      className: classNames(className, classes)
    }));
  };

  return ControlLabel;
}(React.Component);

ControlLabel.propTypes = propTypes;
ControlLabel.defaultProps = defaultProps;
ControlLabel.contextTypes = contextTypes;

export default bsClass('control-label', ControlLabel);