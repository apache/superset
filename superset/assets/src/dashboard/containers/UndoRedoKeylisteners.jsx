import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import UndoRedoKeylisteners from '../components/UndoRedoKeylisteners';

import { undoLayoutAction, redoLayoutAction } from '../actions/dashboardLayout';

export default connect(null, dispatch =>
  bindActionCreators(
    {
      onUndo: undoLayoutAction,
      onRedo: redoLayoutAction,
    },
    dispatch,
  ),
)(UndoRedoKeylisteners);
