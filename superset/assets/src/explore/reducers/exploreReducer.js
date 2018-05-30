/* eslint camelcase: 0 */
import { getControlsState, getFormDataFromControls } from '../store';
import * as actions from '../actions/exploreActions';

export default function exploreReducer(state = {}, action) {
  const actionHandlers = {
    [actions.TOGGLE_FAVE_STAR]() {
      return {
        ...state,
        isStarred: action.isStarred,
      };
    },
    [actions.FETCH_DATASOURCE_STARTED]() {
      return {
        ...state,
        isDatasourceMetaLoading: true,
      };
    },
    [actions.FETCH_DATASOURCE_SUCCEEDED]() {
      return {
        ...state,
        isDatasourceMetaLoading: false,
      };
    },
    [actions.FETCH_DATASOURCE_FAILED]() {
      return {
        ...state,
        isDatasourceMetaLoading: false,
        controlPanelAlert: action.error,
      };
    },
    [actions.SET_DATASOURCE]() {

      return {
        ...state,
        datasource: action.datasource,
      };
    },
    [actions.FETCH_DATASOURCES_STARTED]() {

      return {
        ...state,
        isDatasourcesLoading: true,
      };
    },
    [actions.FETCH_DATASOURCES_SUCCEEDED]() {

      return {
        ...state,
        isDatasourcesLoading: false,
      };
    },
    [actions.FETCH_DATASOURCES_FAILED]() {

      return {
        ...state,
        isDatasourcesLoading: false,
        controlPanelAlert: action.error,
      };
    },
    [actions.SET_DATASOURCES]() {
      return {
        ...state,
        datasources: action.datasources,
      };
    },
    [actions.REMOVE_CONTROL_PANEL_ALERT]() {
      return {
        ...state,
        controlPanelAlert: null,
      };
    },
    [actions.SET_FIELD_VALUE]() {
      const controls = Object.assign({}, state.controls);
      const control = Object.assign({}, controls[action.controlName]);
      control.value = action.value;
      control.validationErrors = action.validationErrors;
      controls[action.controlName] = control;
      const changes = {
        controls,
      };
      if (control.renderTrigger) {
        changes.triggerRender = true;
      }
      return {
        ...state,
        ...changes,
      };
    },
    [actions.SET_EXPLORE_CONTROLS]() {
      return {
        ...state,
        controls: getControlsState(state, action.formData),
      };
    },
    [actions.UPDATE_CHART_TITLE]() {
      const updatedSlice = Object.assign({}, state.slice, { slice_name: action.slice_name });
      return {
        ...state,
        slice: updatedSlice,
      };
    },
    [actions.RESET_FIELDS]() {
      return {
        ...state,
        controls: getControlsState(state, getFormDataFromControls(state.controls)),
      };
    },
    [actions.CREATE_NEW_SLICE]() {
      return {
        ...state,
        slice: action.slice,
        controls: getControlsState(state, action.form_data),
        can_add: action.can_add,
        can_download: action.can_download,
        can_overwrite: action.can_overwrite,
      };
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
