/* eslint camelcase: 0 */
import TIME_FILTER_MAP from './filterOptions';

export default function getDashboardUrl(pathname, filters = {}) {
  // convert filters object into object of {column: [vals], etc.}
  const filterColumns = {};
  const timeFilters = Object.values(TIME_FILTER_MAP);

  Object.keys(filters).forEach(filterId => {
    const filter = filters[filterId];
    Object.keys(filter).forEach(column => {
      if (timeFilters.includes(column)) {
        // time filters still require a chart ID as e.g., timegrain can't be shared by multiple filters
        const currentFilters = filterColumns[filterId] || {};
        filterColumns[filterId] = {
          ...currentFilters,
          [column]: filter[column],
        };
      } else {
        // append column selections to existing filters
        const set = new Set([
          ...(filterColumns[column] || []),
          ...filter[column],
        ]);
        filterColumns[column] = Array.from(set);
      }
    });
  });

  const preselect_filters = encodeURIComponent(JSON.stringify(filterColumns));
  return `${pathname}?preselect_filters=${preselect_filters}`;
}
