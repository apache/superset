/* eslint camelcase: 0 */
import URI from 'urijs';

export function getDashboardLongUrl(dashboard, filters) {
  if (!dashboard) {
    return null;
  }

  const uri = new URI('/');
  const dashboardId = dashboard.slug || dashboard.id;
  const directory = '/superset/dashboard/' + dashboardId + '/';

  const combinedFilters = { ...JSON.parse(dashboard.metadata.default_filters), ...filters };
  const search = uri.search(true);
  search.preselect_filters = JSON.stringify(combinedFilters);
  return uri.directory(directory).search(search).toString();
}
