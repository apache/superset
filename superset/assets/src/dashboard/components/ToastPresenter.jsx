import PropTypes from 'prop-types';
import React from 'react';

import Toast from './Toast';
import { toastShape } from '../util/propShapes';

const propTypes = {
  toasts: PropTypes.arrayOf(toastShape),
  removeToast: PropTypes.func.isRequired,
};

const defaultProps = {
  toasts: [],
};

// eslint-disable-next-line react/prefer-stateless-function
class ToastPresenter extends React.Component {
  render() {
    const { toasts, removeToast } = this.props;

    return (
      toasts.length > 0 && (
        <div className="toast-presenter">
          {toasts.map(toast => (
            <Toast key={toast.id} toast={toast} onCloseToast={removeToast} />
          ))}
        </div>
      )
    );
  }
}

ToastPresenter.propTypes = propTypes;
ToastPresenter.defaultProps = defaultProps;

export default ToastPresenter;
