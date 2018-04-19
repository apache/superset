import { Alert } from 'react-bootstrap';
import cx from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import { toastShape } from '../util/propShapes';
import { INFO_TOAST, SUCCESS_TOAST, WARNING_TOAST, DANGER_TOAST } from '../util/constants';

const propTypes = {
  toast: toastShape.isRequired,
  onCloseToast: PropTypes.func.isRequired,
  delay: PropTypes.number,
  duration: PropTypes.number, // if duration is >0, the toast will close on its own
};

const defaultProps = {
  delay: 0,
  duration: 0,
};

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
    const { delay, duration } = this.props;

    setTimeout(this.showToast, delay);

    if (duration > 0) {
      this.hideTimer = setTimeout(this.handleClosePress, delay + duration);
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
    const { toast: { toastType, text } } = this.props;

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
