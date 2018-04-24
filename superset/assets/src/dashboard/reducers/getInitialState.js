/* eslint-disable camelcase */
import shortid from 'shortid';

import { chart } from '../../chart/chartReducer';
import { initSliceEntities } from './sliceEntities';
import { getParam } from '../../modules/utils';
import { applyDefaultFormData } from '../../explore/stores/store';
import { getColorFromScheme } from '../../modules/colors';
import layoutConverter from '../util/dashboardLayoutConverter';
import { DASHBOARD_ROOT_ID } from '../util/constants';

export default function(bootstrapData) {
  const { user_id, datasources, common } = bootstrapData;
  delete common.locale;
  delete common.language_pack;

  const dashboard = { ...bootstrapData.dashboard_data };
  let filters = {};
  try {
    // allow request parameter overwrite dashboard metadata
    filters = JSON.parse(
      getParam('preselect_filters') || dashboard.metadata.default_filters,
    );
  } catch (e) {
    //
  }

  // Priming the color palette with user's label-color mapping provided in
  // the dashboard's JSON metadata
  if (dashboard.metadata && dashboard.metadata.label_colors) {
    const colorMap = dashboard.metadata.label_colors;
    Object.keys(colorMap).forEach(label => {
      getColorFromScheme(label, null, colorMap[label]);
    });
  }

  // dashboard layout
  const positionJson = dashboard.position_json;
  let layout;
  if (!positionJson || !positionJson[DASHBOARD_ROOT_ID]) {
    layout = layoutConverter(dashboard);
  } else {
    layout = positionJson;
  }

  const dashboardLayout = {
    past: [],
    present: layout,
    future: [],
  };
  delete dashboard.position_json;
  delete dashboard.css;

  const chartQueries = {};
  const slices = {};
  const sliceIds = new Set();
  dashboard.slices.forEach(slice => {
    const key = slice.slice_id;
    chartQueries[key] = {
      ...chart,
      id: key,
      form_data: slice.form_data,
      formData: applyDefaultFormData(slice.form_data),
    };

    slices[key] = {
      slice_id: key,
      slice_url: slice.slice_url,
      slice_name: slice.slice_name,
      form_data: slice.form_data,
      edit_url: slice.edit_url,
      viz_type: slice.form_data.viz_type,
      datasource: slice.form_data.datasource,
      description: slice.description,
      description_markeddown: slice.description_markeddown,
    };

    sliceIds.add(key);
  });

  return {
    datasources,
    sliceEntities: { ...initSliceEntities, slices, isLoading: false },
    charts: chartQueries,
    dashboardInfo: {
      // read-only data
      id: dashboard.id,
      slug: dashboard.slug,
      metadata: {
        filter_immune_slice_fields:
          dashboard.metadata.filter_immune_slice_fields,
        filter_immune_slices: dashboard.metadata.filter_immune_slices,
        timed_refresh_immune_slices:
          dashboard.metadata.timed_refresh_immune_slices,
      },
      userId: user_id,
      dash_edit_perm: dashboard.dash_edit_perm,
      dash_save_perm: dashboard.dash_save_perm,
      common,
    },
    dashboardState: {
      title: dashboard.dashboard_title,
      sliceIds,
      refresh: false,
      filters,
      expandedSlices: dashboard.metadata.expanded_slices || {},
      editMode: false,
      showBuilderPane: false,
      hasUnsavedChanges: false,
    },
    dashboardLayout,
    messageToasts: [],
    impressionId: shortid.generate(),
  };
}
