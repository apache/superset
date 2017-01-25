/* eslint camelcase: 0 */
import { defaultFormData } from '../stores/store';
import * as actions from '../actions/exploreActions';
import { now } from '../../modules/dates';

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
    [actions.SET_DATASOURCE]() {
      return Object.assign({}, state, { datasource: action.datasource });
    },
    [actions.SET_FIELD_VALUE]() {
      let newFormData = Object.assign({}, state.viz.form_data);
      if (action.fieldName === 'datasource') {
        newFormData = defaultFormData(state.viz.form_data.viz_type, action.datasource_type);
        newFormData.datasource_name = action.label;
        newFormData.slice_id = state.viz.form_data.slice_id;
        newFormData.slice_name = state.viz.form_data.slice_name;
        newFormData.viz_type = state.viz.form_data.viz_type;
      }
      newFormData[action.fieldName] = action.value;

      const fields = Object.assign({}, state.fields);
      const field = fields[action.fieldName];
      field.value = action.value;
      field.validationErrors = action.validationErrors;
      return Object.assign(
        {},
        state,
        {
          fields,
          viz: Object.assign({}, state.viz, { form_data: newFormData }),
        }
      );
    },
    [actions.CHART_UPDATE_SUCCEEDED]() {
      return Object.assign(
        {},
        state,
        {
          chartStatus: 'success',
          queryResponse: action.queryResponse,
        }
      );
    },
    [actions.CHART_UPDATE_STARTED]() {
      return Object.assign({}, state,
        {
          chartStatus: 'loading',
          chartUpdateEndTime: null,
          chartUpdateStartTime: now(),
        });
    },
    [actions.CHART_RENDERING_FAILED]() {
      return Object.assign({}, state, {
        chartStatus: 'failed',
        chartAlert: 'An error occurred while rendering the visualization: ' + action.error,
      });
    },
    [actions.CHART_UPDATE_FAILED]() {
      return Object.assign({}, state, {
        chartStatus: 'failed',
        chartAlert: action.queryResponse.error,
        chartUpdateEndTime: now(),
        queryResponse: action.queryResponse,
      });
    },
    [actions.UPDATE_CHART_STATUS]() {
      const newState = Object.assign({}, state, { chartStatus: action.status });
      if (action.status === 'success' || action.status === 'failed') {
        newState.chartUpdateEndTime = now();
      }
      return newState;
    },
    [actions.REMOVE_CHART_ALERT]() {
      if (state.chartAlert !== null) {
        return Object.assign({}, state, { chartAlert: null });
      }
      return state;
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
