/* eslint camelcase: 0 */
export function getParamObject(form_data, datasource_type, saveNewSlice) {
  const data = {
    datasource_id: form_data.datasource,
    datasource_type,
  };
  Object.keys(form_data).forEach((field) => {
    // filter out null fields
    if (form_data[field] !== null && field !== 'datasource'
      && !(saveNewSlice && field === 'slice_name')) {
      data[field] = form_data[field];
    }
  });
  return data;
}

export function getExploreUrl(form_data, dummy, endpoint = 'base') {
  const [datasource_id, datasource_type] = form_data.datasource.split('__');
  let params = `${datasource_type}/${datasource_id}/`;
  params += '?form_data=' + encodeURIComponent(JSON.stringify(form_data));
  switch (endpoint) {
    case 'base':
      return `/superset/explore/${params}`;
    case 'json':
      return `/superset/explore_json/${params}`;
    case 'csv':
      return `/superset/explore/${params}&csv=true`;
    case 'standalone':
      return `/superset/explore/${params}&standalone=true`;
    default:
      return `/superset/explore/${params}`;
  }
}
