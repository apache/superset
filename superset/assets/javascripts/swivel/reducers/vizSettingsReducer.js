import VizSettingsStore from '../stores/VizSettingsStore';
import * as global from '../actions/globalActions';
import * as actions from '../actions/vizSettingsActions';
import { importFormData } from '../formDataUtils/importVizSettings';
import { SET_DATASOURCE } from '../actions/querySettingsActions';

export const vizSettingsReducer = function (state = new VizSettingsStore(), action) {
  const actionHandlers = {
    [global.RESET]() {
      return new VizSettingsStore();
    },
    [global.IMPORT_FORM_DATA]() {
      const newState = new VizSettingsStore(state);
      return importFormData(newState, action.formData, action.refData);
    },
    [actions.TOGGLE_SHOW_LEGEND]() {
      return new VizSettingsStore(state, { showLegend: !state.showLegend });
    },
    [actions.TOGGLE_RICH_TOOLTIP]() {
      return new VizSettingsStore(state, { richTooltip: !state.richTooltip });
    },
    [actions.TOGGLE_SEPARATE_CHARTS]() {
      return new VizSettingsStore(state, { separateCharts: !state.separateCharts });
    },
    [SET_DATASOURCE]() {
      return new VizSettingsStore(state, { title: action.name });
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};

