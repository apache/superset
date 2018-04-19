import { chart } from '../../chart/chartReducer';
import { getParam } from '../../modules/utils';
import { applyDefaultFormData } from '../../explore/stores/store';
import { getColorFromScheme } from '../../modules/colors';

export default function(bootstrapData) {
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
  const dashboardLayout = {
    past: [],
    present: dashboard.position_json,
    future: [],
  };
  delete dashboard.position_json;
  delete dashboard.css;

  // charts and allSlices
  const charts = {},
    sliceEntities = {},
    sliceIds = new Set();
  dashboard.slices.forEach((slice) => {
    const key = slice.slice_id;
    charts[key] = { ...chart,
      id: key,
      form_data: slice.form_data,
      formData: applyDefaultFormData(slice.form_data),
    };

    sliceEntities[key] = {
      slice_id: key,
      slice_url: slice.slice_url,
      slice_name: slice.slice_name,
      form_data: slice.form_data,
      edit_url: slice.edit_url,
      viz_type: slice.form_data.viz_type,
      datasource: slice.datasource,
      description: slice.description,
      description_markeddown: slice.description_markeddown,
    };

    sliceIds.add(key);
  });

  return {
    datasources,
    sliceEntities,
    charts,
    dashboardInfo: {  /* readOnly props */
      id: dashboard.id,
      slug: dashboard.slug,
      metadata: {
        filter_immune_slice_fields: dashboard.metadata.filter_immune_slice_fields,
        filter_immune_slices: dashboard.metadata.filter_immune_slices,
        timed_refresh_immune_slices: dashboard.metadata.timed_refresh_immune_slices,
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
  };
}
