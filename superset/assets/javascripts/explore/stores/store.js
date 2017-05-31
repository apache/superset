/* eslint camelcase: 0 */
import controls from './controls';
import visTypes, { sectionsToRender } from './visTypes';

export function getFormDataFromControls(controlsState) {
  const formData = {};
  Object.keys(controlsState).forEach((controlName) => {
    formData[controlName] = controlsState[controlName].value;
  });
  return formData;
}

export function getControlNames(vizType, datasourceType) {
  const controlNames = [];
  sectionsToRender(vizType, datasourceType).forEach(
    section => section.controlSetRows.forEach(
      fsr => fsr.forEach(
        f => controlNames.push(f))));
  return controlNames;
}

export function getControlsState(state, form_data) {
  /*
  * Gets a new controls object to put in the state. The controls object
  * is similar to the configuration control with only the controls
  * related to the current viz_type, materializes mapStateToProps functions,
  * adds value keys coming from form_data passed here. This can't be an action creator
  * just yet because it's used in both the explore and dashboard views.
  * */

  // Getting a list of active control names for the current viz
  const formData = Object.assign({}, form_data);
  const vizType = formData.viz_type || 'table';

  const controlNames = getControlNames(vizType, state.datasource.type);

  const viz = visTypes[vizType];
  const controlOverrides = viz.controlOverrides || {};
  const controlsState = {};
  controlNames.forEach((k) => {
    const control = Object.assign({}, controls[k], controlOverrides[k]);
    if (control.mapStateToProps) {
      Object.assign(control, control.mapStateToProps(state));
      delete control.mapStateToProps;
    }

    // If the value is not valid anymore based on choices, clear it
    if (control.type === 'SelectControl' && control.choices && k !== 'datasource' && formData[k]) {
      const choiceValues = control.choices.map(c => c[0]);
      if (control.multi && formData[k].length > 0 && choiceValues.indexOf(formData[k][0]) < 0) {
        delete formData[k];
      } else if (!control.multi && !control.freeForm && choiceValues.indexOf(formData[k]) < 0) {
        delete formData[k];
      }
    }
    // Removing invalid filters that point to a now inexisting column
    if (control.type === 'FilterControl' && control.choices) {
      if (!formData[k]) {
        formData[k] = [];
      }
      const choiceValues = control.choices.map(c => c[0]);
      formData[k] = formData[k].filter(flt => choiceValues.indexOf(flt.col) >= 0);
    }

    if (typeof control.default === 'function') {
      control.default = control.default(control);
    }
    control.validationErrors = [];
    control.value = formData[k] !== undefined ? formData[k] : control.default;
    controlsState[k] = control;
  });
  return controlsState;
}

export function applyDefaultFormData(form_data) {
  const datasourceType = form_data.datasource.split('__')[1];
  const vizType = form_data.viz_type || 'table';
  const viz = visTypes[vizType];
  const controlNames = getControlNames(vizType, datasourceType);
  const controlOverrides = viz.controlOverrides || {};
  const formData = {};
  controlNames.forEach((k) => {
    const control = Object.assign({}, controls[k]);
    if (controlOverrides[k]) {
      Object.assign(control, controlOverrides[k]);
    }
    if (form_data[k] === undefined) {
      if (typeof control.default === 'function') {
        formData[k] = control.default(controls[k]);
      } else {
        formData[k] = control.default;
      }
    } else {
      formData[k] = form_data[k];
    }
  });
  return formData;
}

export const autoQueryControls = [
  'datasource',
  'viz_type',
];

const defaultControls = Object.assign({}, controls);
Object.keys(controls).forEach((f) => {
  defaultControls[f].value = controls[f].default;
});

const defaultState = {
  controls: defaultControls,
  form_data: getFormDataFromControls(defaultControls),
};

export { defaultControls, defaultState };
