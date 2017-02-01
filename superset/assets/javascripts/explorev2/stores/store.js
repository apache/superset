/* eslint camelcase: 0 */
import { sectionsToRender } from './visTypes';
import fields from './fields';
import visTypes, { fieldNames } from './visTypes';

export function getFieldsState(state, form_data, datasourceType = 'table') {
  const fieldNames = [];
  sectionsToRender(form_data.viz_type, datasourceType).forEach(section => section.fieldSetRows.forEach(fsr => fsr.forEach(f => fieldNames.push(f))));
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

export function applyDefaultFormData (form_data, state = {}) {
  const fields = getFieldsState(state, form_data);
  const formData = {};
  Object.keys(fields).forEach(k => formData[k] = fields[k].value);
  return formData;
}
