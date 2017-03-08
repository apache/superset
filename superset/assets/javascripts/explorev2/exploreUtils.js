/* eslint camelcase: 0 */
export function getExploreUrl(form_data, endpoint = 'base', force = false) {
  if (!form_data.datasource) {
    return null;
  }
  const [datasource_id, datasource_type] = form_data.datasource.split('__');
  let params = `${datasource_type}/${datasource_id}/`;
  params += '?form_data=' + encodeURIComponent(JSON.stringify(form_data));
  if (force) {
    params += '&force=true';
  }
  switch (endpoint) {
    case 'base':
      return `/superset/explore/${params}`;
    case 'json':
      return `/superset/explore_json/${params}`;
    case 'csv':
      return `/superset/explore_json/${params}&csv=true`;
    case 'standalone':
      return `/superset/explore/${params}&standalone=true`;
    case 'query':
      return `/superset/explore_json/${params}&query=true`;
    default:
      return `/superset/explore/${params}`;
  }
}
