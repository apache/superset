/* eslint camelcase: 0 */
import URI from 'urijs';

/**
 *
 * @param dashboard: object with id and slug properties
 * @param filters: current filter object applied to the dashboard
 * @returns long link for the dashboard with the given filters applied
 */
export default function getDashboardLongUrl(dashboard, filters) {
  if (!dashboard) {
    return null;
  }

  const uri = new URI('/');
  const dashboardId = dashboard.slug || dashboard.id;
  const directory = `/superset/dashboard/${dashboardId}/`;

  const search = uri.search(true);
  search.preselect_filters = JSON.stringify(filters);
  return uri
    .directory(directory)
    .search(search)
    .toString();
}
