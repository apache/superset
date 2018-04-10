import { combineReducers } from 'redux';
import shortid from 'shortid';

import charts, { chart } from '../../chart/chartReducer';
import dashboardReducer from './dashboard';
import datasourcesReducer from './datasources';
import allSlices, { initAllSlices } from './allSlices';
import layoutReducer from '../v2/reducers/index';
import messageToasts from '../v2/reducers/messageToasts';
import { getParam } from '../../modules/utils';
import layoutConverter from '../util/dashboardLayoutConverter';
import { applyDefaultFormData } from '../../explore/stores/store';
import { getColorFromScheme } from '../../modules/colors';

export function getInitialState(bootstrapData) {
  const { user_id, datasources, common } = bootstrapData;
  delete common.locale;
  delete common.language_pack;

  const dashboard = { ...bootstrapData.dashboard_data };
  let filters = {};
  try {
    // allow request parameter overwrite dashboard metadata
    filters = JSON.parse(getParam('preselect_filters') || dashboard.metadata.default_filters);
  } catch (e) {
    //
  }

  // Priming the color palette with user's label-color mapping provided in
  // the dashboard's JSON metadata
  if (dashboard.metadata && dashboard.metadata.label_colors) {
    const colorMap = dashboard.metadata.label_colors;
    for (const label in colorMap) {
      getColorFromScheme(label, null, colorMap[label]);
    }
  }

  // dashboard layout
  const position_json = dashboard.position_json;
  let layout;
  if (!position_json || !position_json['DASHBOARD_ROOT_ID']) {
    layout = layoutConverter(dashboard);
  } else {
    layout = position_json;
  }

  const dashboardLayout = {
    past: [],
    present: layout,
    future: [],
  };
  delete dashboard.position_json;
  delete dashboard.css;

  // charts and slices
  const initCharts = {};
  const slices = {};
  dashboard.slices.forEach((slice) => {
    const chartKey = 'slice_' + slice.slice_id;
    initCharts[chartKey] = { ...chart,
      chartKey,
      slice_id: slice.slice_id,
      form_data: slice.form_data,
      formData: applyDefaultFormData(slice.form_data),
    };

    slices[chartKey] = {
      slice_id: slice.slice_id,
      slice_url: slice.slice_url,
      slice_name: slice.slice_name,
      edit_url: slice.edit_url,
      form_data: slice.form_data,
      viz_type: slice.form_data.viz_type,
      datasource_name: slice.datasource,
      description: slice.description,
      description_markeddown: slice.description_markeddown,
    };
  });
  dashboard.sliceIds = new Set(dashboard.slices.map(slice => (slice.slice_id)));
  delete dashboard.slices;

  return {
    datasources,
    allSlices: { ...initAllSlices, isLoading: false, slices },
    charts: initCharts,
    dashboard: {
      filters,
      dashboard,
      userId: user_id,
      common,
      editMode: false,
      showBuilderPane: false,
      hasUnsavedChanges: false,
    },
    dashboardLayout,
    messageToasts: [],
  };
}

const impressionId = function (state = '') {
  let id = state;
  if (!id) {
    id = shortid.generate();
  }
  return id;
};

export default combineReducers({
  charts,
  dashboard: dashboardReducer,
  datasources: datasourcesReducer,
  allSlices,
  dashboardLayout: layoutReducer,
  messageToasts,
  impressionId,
});
