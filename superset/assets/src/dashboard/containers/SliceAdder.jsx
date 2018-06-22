import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import { fetchAllSlices } from '../actions/sliceEntities';
import SliceAdder from '../components/SliceAdder';

function mapStateToProps({ sliceEntities, dashboardInfo, dashboardState }) {
  return {
    userId: dashboardInfo.userId,
    selectedSliceIds: dashboardState.sliceIds,
    slices: sliceEntities.slices,
    isLoading: sliceEntities.isLoading,
    errorMessage: sliceEntities.errorMessage,
    lastUpdated: sliceEntities.lastUpdated,
    editMode: dashboardState.editMode,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      fetchAllSlices,
    },
    dispatch,
  );
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(SliceAdder);
