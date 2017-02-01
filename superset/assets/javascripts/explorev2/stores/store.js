/* eslint camelcase: 0 */
import fields from './fields';
import visTypes, { sectionsToRender } from './visTypes';

export function getFormDataFromFields(fieldsState) {
  const formData = {};
  Object.keys(fieldsState).forEach(fieldName => {
    formData[fieldName] = fieldsState[fieldName].value;
  });
  return formData;
}

export function getFieldsState(state, form_data) {
  /*
  * Gets a new fields object to put in the state. The fields object
  * is similar to the configuration field with only the fields
  * related to the current viz_type, materializes mapStateToProps functions,
  * adds value keys coming from form_data passed here. This can't be an action creator
  * just yet because it's used in both the explore and dashboard views.
  * */

  // Getting a list of active field names for the current viz
  const fieldNames = [];
  sectionsToRender(form_data.viz_type, state.datasource.type).forEach(
    section => section.fieldSetRows.forEach(
      fsr => fsr.forEach(
        f => fieldNames.push(f))));

  const viz = visTypes[form_data.viz_type];
  const fieldOverrides = viz.fieldOverrides || {};
  const fieldsState = {};
  fieldNames.forEach((k) => {
    const field = Object.assign({}, fields[k], fieldOverrides[k]);
    if (field.mapStateToProps) {
      Object.assign(field, field.mapStateToProps(state));
      delete field.mapStateToProps;
    }
    if (typeof field.default === 'function') {
      field.default = field.default(field);
    }
    field.value = (form_data[k] !== undefined) ? form_data[k] : field.default;
    fieldsState[k] = field;
  });
  return fieldsState;
}
export const autoQueryFields = [
  'datasource',
  'viz_type',
];

export function applyDefaultFormData(form_data, state = {}) {
  const fieldsState = getFieldsState(state, form_data);
  const formData = {};
  Object.keys(fieldsState).forEach(k => {
    formData[k] = fieldsState[k].value;
  });
  return formData;
}
