/* eslint camelcase: 0 */
import { sectionsToRender } from './visTypes';
import fields from './fields';
import { getExploreUrl } from '../exploreUtils';

export function defaultFormData(vizType = 'table', datasourceType = 'table') {
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
        if (k === 'viz_type') {
          data[k] = vizType;
        } else {
          data[k] = fields[k].default;
        }
      });
    });
  });
  return data;
}

export function defaultViz(vizType, datasourceType = 'table') {
  const form_data = defaultFormData(vizType, datasourceType);
  return {
    cached_key: null,
    cached_timeout: null,
    cached_dttm: null,
    column_formats: null,
    csv_endpoint: getExploreUrl(form_data, datasourceType, 'csv'),
    is_cached: false,
    data: [],
    form_data,
    json_endpoint: getExploreUrl(form_data, datasourceType, 'json'),
    query: null,
    standalone_endpoint: getExploreUrl(form_data, datasourceType, 'standalone'),
  };
}

export function initialState(vizType = 'table', datasourceType = 'table') {
  return {
    dashboards: [],
    isDatasourceMetaLoading: false,
    datasources: null,
    datasource_type: null,
    filterColumnOpts: [],
    fields,
    viz: defaultViz(vizType, datasourceType),
    isStarred: false,
  };
}

// Control Panel fields that re-render chart without need for 'Query button'
export const autoQueryFields = [
  'datasource',
  'viz_type',
];
