import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as allSlicesActions from '../actions/allSlices';
import SliceAdder from './SliceAdder';

function mapStateToProps({ allSlices, dashboard }) {
  return {
    userId: dashboard.userId,
    selectedSliceIds: dashboard.dashboard.sliceIds,
    slices: allSlices.slices,
    isLoading: allSlices.isLoading,
    errorMsg: allSlices.errorMsg,
    lastUpdated: allSlices.lastUpdated,
    editMode: dashboard.editMode,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(allSlicesActions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SliceAdder);
