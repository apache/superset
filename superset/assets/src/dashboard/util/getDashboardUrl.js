/* eslint camelcase: 0 */

export default function getDashboardUrl(pathname, filters = {}) {
  return `${pathname}?preselect_filters=${JSON.stringify(filters)}`;
}
