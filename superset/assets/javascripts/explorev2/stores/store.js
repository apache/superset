/* eslint camelcase: 0 */
import { sectionsToRender } from './visTypes';
import fields from './fields';

export function applyDefaultFormData(
    form_data, datasourceType = 'table') {
  const data = {
    slice_name: null,
    slice_id: null,
    datasource_name: null,
    filters: [],
  };
  const sections = sectionsToRender(form_data.viz_type, datasourceType);
  sections.forEach((section) => {
    section.fieldSetRows.forEach((fieldSetRow) => {
      fieldSetRow.forEach((k) => {
        const def = fields[k].default;
        if (typeof def === "function") {
          data[k] = def(fields[k]);
        } else {
          data[k] = def;
        }
      });
    });
  });
  return Object.assign(data, form_data);
}

export const autoQueryFields = [
  'datasource',
  'viz_type',
];
