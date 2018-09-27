import { Alert } from 'react-bootstrap';
import cx from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import { toastShape } from '../propShapes';

import {
  INFO_TOAST,
  SUCCESS_TOAST,
  WARNING_TOAST,
  DANGER_TOAST,
} from '../constants';

const propTypes = {
  toast: toastShape.isRequired,
  onCloseToast: PropTypes.func.isRequired,
};

const defaultProps = {};

class Toast extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      visible: false,
    };

    this.showToast = this.showToast.bind(this);
    this.handleClosePress = this.handleClosePress.bind(this);
  }

  componentDidMount() {
    const { toast } = this.props;

    setTimeout(this.showToast);

    if (toast.duration > 0) {
      this.hideTimer = setTimeout(this.handleClosePress, toast.duration);
    }
  }

  componentWillUnmount() {
    clearTimeout(this.hideTimer);
  }

  showToast() {
    this.setState({ visible: true });
  }

  handleClosePress() {
    clearTimeout(this.hideTimer);

    this.setState({ visible: false }, () => {
      // Wait for the transition
      setTimeout(() => {
        this.props.onCloseToast(this.props.toast.id);
      }, 150);
    });
  }

  render() {
    const { visible } = this.state;
    const {
      toast: { toastType, text },
    } = this.props;

    return (
      <Alert
        onDismiss={this.handleClosePress}
        bsClass={cx(
          'alert',
          'toast',
          visible && 'toast--visible',
          toastType === INFO_TOAST && 'toast--info',
          toastType === SUCCESS_TOAST && 'toast--success',
          toastType === WARNING_TOAST && 'toast--warning',
          toastType === DANGER_TOAST && 'toast--danger',
        )}
      >
        {text}
      </Alert>
    );
  }
}

Toast.propTypes = propTypes;
Toast.defaultProps = defaultProps;

export default Toast;
