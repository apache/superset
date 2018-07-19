import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import {
  addDangerToast,
  addInfoToast,
  addSuccessToast,
  addWarningToast,
} from '../actions';

// To work properly the redux state must have a `messageToasts` subtree
export default function withToasts(BaseComponent) {
  return connect(
    null,
    dispatch =>
      bindActionCreators(
        {
          addInfoToast,
          addSuccessToast,
          addWarningToast,
          addDangerToast,
        },
        dispatch,
      ),
  )(BaseComponent);
}
