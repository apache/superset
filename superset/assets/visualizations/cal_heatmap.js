// JS
import d3 from 'd3';

// CSS
require('./cal_heatmap.css');
require('../node_modules/cal-heatmap/cal-heatmap.css');

const CalHeatMap = require('cal-heatmap');

function calHeatmap(slice, payload) {
  const div = d3.select(slice.selector);
  const data = payload.data;

  div.selectAll('*').remove();
  const cal = new CalHeatMap();

  const timestamps = data.timestamps;
  const extents = d3.extent(Object.keys(timestamps), key => timestamps[key]);
  const step = (extents[1] - extents[0]) / 5;

  try {
    cal.init({
      start: data.start,
      data: timestamps,
      itemSelector: slice.selector,
      tooltip: true,
      domain: data.domain,
      subDomain: data.subdomain,
      range: data.range,
      browsing: true,
      legend: [extents[0], extents[0] + step, extents[0] + (step * 2), extents[0] + (step * 3)],
    });
  } catch (e) {
    slice.error(e);
  }
}

module.exports = calHeatmap;
