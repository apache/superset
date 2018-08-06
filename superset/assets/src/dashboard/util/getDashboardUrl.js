/* eslint camelcase: 0 */

export default function getDashboardUrl(pathname, filters = {}) {
  const preselect_filters = encodeURIComponent(JSON.stringify(filters));
  return `${pathname}?preselect_filters=${preselect_filters}`;
}
