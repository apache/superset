/* eslint camelcase: 0 */
import URI from 'urijs';

export function getChartKey(explore) {
  const slice = explore.slice;
  return slice ? ('slice_' + slice.slice_id) : 'slice';
}

export function getAnnotationJsonUrl(slice_id, form_data, isNative) {
  if (slice_id === null || slice_id === undefined) {
    return null;
  }
  const uri = URI(window.location.search);
  const endpoint = isNative ? 'annotation_json' : 'slice_json';
  return uri.pathname(`/superset/${endpoint}/${slice_id}`)
    .search({
      form_data: JSON.stringify(form_data,
        (key, value) => value === null ? undefined : value),
    }).toString();
}

export function getExploreUrl(form_data, endpointType = 'base', force = false,
  curUrl = null, requestParams = {}) {
  if (!form_data.datasource) {
    return null;
  }

  // The search params from the window.location are carried through,
  // but can be specified with curUrl (used for unit tests to spoof
  // the window.location).
  let uri = URI(window.location.search);
  if (curUrl) {
    uri = URI(URI(curUrl).search());
  }

  // Building the directory part of the URI
  let directory = '/superset/explore/';
  if (['json', 'csv', 'query'].indexOf(endpointType) >= 0) {
    directory = '/superset/explore_json/';
  }
  const [datasource_id, datasource_type] = form_data.datasource.split('__');
  directory += `${datasource_type}/${datasource_id}/`;

  // Building the querystring (search) part of the URI
  const search = uri.search(true);
  search.form_data = JSON.stringify(form_data);
  if (force) {
    search.force = 'true';
  }
  if (endpointType === 'csv') {
    search.csv = 'true';
  }
  if (endpointType === 'standalone') {
    search.standalone = 'true';
  }
  if (endpointType === 'query') {
    search.query = 'true';
  }
  const paramNames = Object.keys(requestParams);
  if (paramNames.length) {
    paramNames.forEach((name) => {
      if (requestParams.hasOwnProperty(name)) {
        search[name] = requestParams[name];
      }
    });
  }
  uri = uri.search(search).directory(directory);
  return uri.toString();
}
