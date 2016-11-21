import { defaultFormData } from '../stores/store';
import * as actions from '../actions/exploreActions';
import { addToArr, removeFromArr, alterInArr } from '../../../utils/reducerUtils';

export const exploreReducer = function (state, action) {
  const actionHandlers = {
    [actions.TOGGLE_FAVE_STAR]() {
      return Object.assign({}, state, { isStarred: action.isStarred });
    },

    [actions.FETCH_STARTED]() {
      return Object.assign({}, state, { isDatasourceMetaLoading: true });
    },

    [actions.FETCH_SUCCEEDED]() {
      return Object.assign({}, state, { isDatasourceMetaLoading: false });
    },

    [actions.FETCH_FAILED]() {
      // todo(alanna) handle failure/error state
      return Object.assign({}, state,
        {
          isDatasourceMetaLoading: false,
          controlPanelAlert: action.error,
        });
    },
    [actions.REMOVE_CONTROL_PANEL_ALERT]() {
      return Object.assign({}, state, { controlPanelAlert: null });
    },

    [actions.FETCH_DASHBOARDS_SUCCEEDED]() {
      return Object.assign({}, state, { dashboards: action.choices });
    },

    [actions.FETCH_DASHBOARDS_FAILED]() {
      return Object.assign({}, state,
        { saveModalAlert: `fetching dashboards failed for ${action.userId}` });
    },

    [actions.SET_FIELD_OPTIONS]() {
      const newState = Object.assign({}, state);
      const optionsByFieldName = action.options;
      const fieldNames = Object.keys(optionsByFieldName);

      fieldNames.forEach((fieldName) => {
        newState.fields[fieldName].choices = optionsByFieldName[fieldName];
      });

      return Object.assign({}, state, newState);
    },

    [actions.SET_FILTER_COLUMN_OPTS]() {
      return Object.assign({}, state, { filterColumnOpts: action.filterColumnOpts });
    },
    [actions.ADD_FILTER]() {
      return addToArr(state, 'filters', action.filter);
    },
    [actions.REMOVE_FILTER]() {
      return removeFromArr(state, 'filters', action.filter);
    },
    [actions.CHANGE_FILTER_FIELD]() {
      return alterInArr(state, 'filters', action.filter, { field: action.field });
    },
    [actions.CHANGE_FILTER_OP]() {
      return alterInArr(state, 'filters', action.filter, { op: action.op });
    },
    [actions.CHANGE_FILTER_VALUE]() {
      return alterInArr(state, 'filters', action.filter, { value: action.value });
    },
    [actions.SET_FIELD_VALUE]() {
      const newFormData = action.key === 'datasource' ?
        defaultFormData(state.viz.form_data.viz_type, action.datasource_type) :
        Object.assign({}, state.viz.form_data);
      if (action.key === 'datasource') {
        newFormData.datasource_name = action.label;
        newFormData.slice_id = state.viz.form_data.slice_id;
        newFormData.slice_name = state.viz.form_data.slice_name;
        newFormData.viz_type = state.viz.form_data.viz_type;
      }
      if (action.key === 'viz_type') {
        newFormData.previous_viz_type = state.viz.form_data.viz_type;
      }
      newFormData[action.key] = action.value ? action.value : (!state.viz.form_data[action.key]);
      return Object.assign(
        {},
        state,
        { viz: Object.assign({}, state.viz, { form_data: newFormData }) }
      );
    },
    [actions.UPDATE_CHART]() {
      const vizUpdates = {
        column_formats: action.viz.column_formats,
        json_endpoint: action.viz.json_endpoint,
        csv_endpoint: action.viz.csv_endpoint,
        standalone_endpoint: action.viz.standalone_endpoint,
        query: action.viz.query,
        data: action.viz.data,
      };
      return Object.assign(
        {},
        state,
        {
          viz: Object.assign({}, state.viz, vizUpdates),
          isChartLoading: false,
        });
    },
    [actions.CHART_UPDATE_STARTED]() {
      return Object.assign({}, state, { isChartLoading: true });
    },
    [actions.CHART_UPDATE_FAILED]() {
      return Object.assign({}, state, { isChartLoading: false, chartAlert: action.error });
    },
    [actions.REMOVE_CHART_ALERT]() {
      return Object.assign({}, state, { chartAlert: null });
    },
    [actions.SAVE_SLICE_FAILED]() {
      return Object.assign({}, state, { saveModalAlert: 'Failed to save slice' });
    },
    [actions.REMOVE_SAVE_MODAL_ALERT]() {
      return Object.assign({}, state, { saveModalAlert: null });
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};
