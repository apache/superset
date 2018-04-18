import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import { addFilter, removeFilter, toggleExpandSlice } from '../../actions/dashboard';
import { refreshChart } from '../../../chart/chartAction';
import getFormDataWithExtraFilters from '../../v2/util/charts/getFormDataWithExtraFilters';
import { saveSliceName } from '../../actions/allSlices';
import Chart from '../components/gridComponents/Chart';

function mapStateToProps({ datasources, allSlices, charts, dashboard }, ownProps) {
  const { id } = ownProps;
  const chart = charts[id];
  const { filters } = dashboard;
  const isExpanded = !!(dashboard.dashboard.metadata.expanded_slices || {})[id];

  return {
    chart,
    datasource: datasources[chart.form_data.datasource],
    slice: allSlices.slices[id],
    timeout: dashboard.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    filters,
    // note: this method caches filters if possible to prevent render cascades
    formData: getFormDataWithExtraFilters({
      chart,
      dashboardMetadata: dashboard.dashboard.metadata,
      filters,
      sliceId: id,
    }),
    editMode: dashboard.editMode,
    isExpanded,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    saveSliceName,
    toggleExpandSlice,
    addFilter,
    refreshChart,
    removeFilter,
  }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(Chart);
