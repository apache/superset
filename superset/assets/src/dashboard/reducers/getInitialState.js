/* eslint-disable camelcase */
import shortid from 'shortid';

import { chart } from '../../chart/chartReducer';
import { initSliceEntities } from './sliceEntities';
import { getParam } from '../../modules/utils';
import { applyDefaultFormData } from '../../explore/store';
import { getColorFromScheme } from '../../modules/colors';
import layoutConverter from '../util/dashboardLayoutConverter';
import { DASHBOARD_VERSION_KEY, DASHBOARD_HEADER_ID } from '../util/constants';
import { DASHBOARD_HEADER_TYPE, CHART_TYPE } from '../util/componentTypes';

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
  const { position_json: positionJson } = dashboard;

  const layout =
    !positionJson || positionJson[DASHBOARD_VERSION_KEY] !== 'v2'
      ? layoutConverter(dashboard)
      : positionJson;

  // store the header as a layout component so we can undo/redo changes
  layout[DASHBOARD_HEADER_ID] = {
    id: DASHBOARD_HEADER_ID,
    type: DASHBOARD_HEADER_TYPE,
    meta: {
      text: dashboard.dashboard_title,
    },
  };

  const dashboardLayout = {
    past: [],
    present: layout,
    future: [],
  };

  // create a lookup to sync layout names with slice names
  const chartIdToLayoutId = {};
  Object.values(layout).forEach(layoutComponent => {
    if (layoutComponent.type === CHART_TYPE) {
      chartIdToLayoutId[layoutComponent.meta.chartId] = layoutComponent.id;
    }
  });

  const chartQueries = {};
  const slices = {};
  const sliceIds = new Set();
  dashboard.slices.forEach(slice => {
    const key = slice.slice_id;
    if (['separator', 'markup'].indexOf(slice.form_data.viz_type) === -1) {
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
    }

    // sync layout names with current slice names in case a slice was edited
    // in explore since the layout was updated. name updates go through layout for undo/redo
    // functionality and python updates slice names based on layout upon dashboard save
    const layoutId = chartIdToLayoutId[key];
    if (layoutId && layout[layoutId]) {
      layout[layoutId].meta.chartName = slice.slice_name;
    }
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
      superset_can_explore: dashboard.superset_can_explore,
      slice_can_edit: dashboard.slice_can_edit,
      common,
    },
    dashboardState: {
      sliceIds,
      refresh: false,
      filters,
      expandedSlices: dashboard.metadata.expanded_slices || {},
      css: dashboard.css || '',
      editMode: false,
      showBuilderPane: false,
      hasUnsavedChanges: false,
      maxUndoHistoryExceeded: false,
    },
    dashboardLayout,
    messageToasts: [],
    impressionId: shortid.generate(),
  };
}
