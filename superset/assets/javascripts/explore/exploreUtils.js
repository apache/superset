/* eslint camelcase: 0 */
import URI from 'urijs';

export function getExploreUrl(form_data, endpointType = 'base', force = false, curUrl = null) {
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
  uri = uri.search(search).directory(directory);
  return uri.toString();
}
