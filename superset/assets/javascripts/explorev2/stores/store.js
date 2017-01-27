/* eslint camelcase: 0 */
import { sectionsToRender } from './visTypes';
import fields from './fields';

export function applyDefaultFormData(
    form_data, vizType = 'table', datasourceType = 'table') {
  const data = {
    slice_name: null,
    slice_id: null,
    datasource_name: null,
    filters: [],
  };
  const sections = sectionsToRender(vizType, datasourceType);
  sections.forEach((section) => {
    section.fieldSetRows.forEach((fieldSetRow) => {
      fieldSetRow.forEach((k) => {
        data[k] = fields[k].default;
      });
    });
  });
  return Object.assign(data, form_data);
}

// Control Panel fields that re-render chart without need for 'Query button'
export function initialState(vizType = 'table', datasourceType = 'table') {
  return {
    dashboards: [],
    isDatasourceMetaLoading: false,
    datasources: null,
    datasource_type: null,
    filterColumnOpts: [],
    fields,
    isStarred: false,
  };
}

export const autoQueryFields = [
  'datasource',
  'viz_type',
];
