import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import ToastPresenter from '../components/ToastPresenter';

import { removeToast } from '../actions/messageToasts';

export default connect(
  ({ messageToasts: toasts }) => ({ toasts }),
  dispatch => bindActionCreators({ removeToast }, dispatch),
)(ToastPresenter);
