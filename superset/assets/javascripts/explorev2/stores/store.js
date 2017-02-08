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

export function getFieldNames(vizType, datasourceType) {
  const fieldNames = [];
  sectionsToRender(vizType, datasourceType).forEach(
    section => section.fieldSetRows.forEach(
      fsr => fsr.forEach(
        f => fieldNames.push(f))));
  return fieldNames;
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
  const formData = Object.assign({}, form_data);
  const fieldNames = getFieldNames(formData.viz_type, state.datasource.type);

  const viz = visTypes[formData.viz_type];
  const fieldOverrides = viz.fieldOverrides || {};
  const fieldsState = {};
  fieldNames.forEach((k) => {
    const field = Object.assign({}, fields[k], fieldOverrides[k]);
    if (field.mapStateToProps) {
      Object.assign(field, field.mapStateToProps(state));
      delete field.mapStateToProps;
    }

    // If the value is not valid anymore based on choices, clear it
    if (field.choices && k !== 'datasource' && formData[k]) {
      const choiceValues = field.choices.map(c => c[0]);
      if (field.multi && formData[k].length > 0 && choiceValues.indexOf(formData[k][0]) < 0) {
        delete formData[k];
      } else if (!field.multi && choiceValues.indexOf(formData[k]) < 0) {
        // delete form_data[k];
        // TODO what's not working here?
      }
    }

    if (typeof field.default === 'function') {
      field.default = field.default(field);
    }
    field.value = formData[k] !== undefined ? formData[k] : field.default;
    fieldsState[k] = field;
  });
  return fieldsState;
}

export function applyDefaultFormData(form_data) {
  const datasourceType = form_data.datasource.split('__')[1];
  const fieldNames = getFieldNames(form_data.viz_type, datasourceType);
  const formData = {};
  fieldNames.forEach(k => {
    if (!form_data[k]) {
      if (typeof fields[k].default === 'function') {
        formData[k] = fields[k].default(fields[k]);
      } else {
        formData[k] = fields[k].default;
      }
    } else {
      formData[k] = form_data[k];
    }
  });
  return formData;
}

export const autoQueryFields = [
  'datasource',
  'viz_type',
];
