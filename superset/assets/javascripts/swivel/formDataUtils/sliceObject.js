/* eslint camelcase: 0 */
import { d3format } from '../../modules/utils';
import { getExploreUrl } from '../../explore/exploreUtils';

export function getMockedSliceObject(
  containerId, formData, metrics = [], numCharts = 1,
  addFilter = () => {},
  removeFilter = () => {},
) {
  const selector = `#${containerId}`;
  const getHeight = () => Math.max(320, ($('#swivel-side-bar').height() -
        $('#swivel-drop-targets').height()) / numCharts);
  const getWidth = () => $(selector).width();
  const id_map = metrics.reduce((lookup, m) => ({ ...lookup, [m.id]: m }), {});

  return {
    viewSqlQuery: '',
    containerId: `${containerId}`,
    datasource: { verbose_map: metrics.reduce((lookup, m) => ({ ...lookup, [m.id]: m.name }), {}) },
    selector,
    formData,
    container: {
      html: (data) => {
        // this should be a callback to clear the contents of the slice container
        $(selector).html(data);
      },
      css: (property, value) => {
        $(selector).css(property, value);
      },
      height: getHeight,
      show: () => { },
      get: n => ($(selector).get(n)),
      find: classname => ($(selector).find(classname)),
    },
    width: getWidth,
    height: getHeight,
    render_template: () => {},
    setFilter: () => {},
    getFilters: () => {},
    addFilter: (col, val) => addFilter({ ...id_map[col], filter: val }),
    removeFilter: col => removeFilter(id_map[col]),
    done: () => {},
    clearError: () => {},
    error() {},
    d3format: (col, number) => d3format((id_map[col] || {}).format, number),
    data: {
      csv_endpoint: getExploreUrl(formData, 'csv'),
      json_endpoint: getExploreUrl(formData, 'json'),
      standalone_endpoint: getExploreUrl(formData, 'standalone'),
    },
  };
}
