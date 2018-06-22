import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import {
  changeFilter as addFilter,
  toggleExpandSlice,
} from '../actions/dashboardState';
import { refreshChart } from '../../chart/chartAction';
import getFormDataWithExtraFilters from '../util/charts/getFormDataWithExtraFilters';
import { updateComponents } from '../actions/dashboardLayout';
import Chart from '../components/gridComponents/Chart';

const EMPTY_FILTERS = {};

function mapStateToProps(
  {
    charts: chartQueries,
    dashboardInfo,
    dashboardState,
    datasources,
    sliceEntities,
  },
  ownProps,
) {
  const { id } = ownProps;
  const chart = chartQueries[id] || {};
  const { filters } = dashboardState;

  return {
    chart,
    datasource: (chart && datasources[chart.form_data.datasource]) || {},
    slice: sliceEntities.slices[id],
    timeout: dashboardInfo.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    filters: filters[id] || EMPTY_FILTERS,
    // note: this method caches filters if possible to prevent render cascades
    formData: getFormDataWithExtraFilters({
      chart,
      dashboardMetadata: dashboardInfo.metadata,
      filters,
      sliceId: id,
    }),
    editMode: dashboardState.editMode,
    isExpanded: !!dashboardState.expandedSlices[id],
    supersetCanExplore: !!dashboardInfo.superset_can_explore,
    sliceCanEdit: !!dashboardInfo.slice_can_edit,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      updateComponents,
      toggleExpandSlice,
      addFilter,
      refreshChart,
    },
    dispatch,
  );
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Chart);
