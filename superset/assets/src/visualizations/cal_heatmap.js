import d3 from 'd3';

import { colorScalerFactory } from '../modules/colors';
import CalHeatMap from '../../vendor/cal-heatmap/cal-heatmap';
import '../../vendor/cal-heatmap/cal-heatmap.css';
import { d3TimeFormatPreset, d3FormatPreset } from '../modules/utils';
import './cal_heatmap.css';
import { UTC } from '../modules/dates';

const UTCTS = uts => UTC(new Date(uts)).getTime();

function calHeatmap(slice, payload) {
  const fd = slice.formData;
  const steps = fd.steps;
  const valueFormatter = d3FormatPreset(fd.y_axis_format);
  const timeFormatter = d3TimeFormatPreset(fd.x_axis_time_format);

  const container = d3.select(slice.selector).style('height', slice.height());
  container.selectAll('*').remove();
  const div = container.append('div');
  const data = payload.data;

  const subDomainTextFormat = fd.show_values ? (date, value) => valueFormatter(value) : null;
  const cellPadding = fd.cell_padding !== '' ? fd.cell_padding : 2;
  const cellRadius = fd.cell_radius || 0;
  const cellSize = fd.cell_size || 10;

  // Trick to convert all timestamps to UTC
  const metricsData = {};
  Object.keys(data.data).forEach((metric) => {
    metricsData[metric] = {};
    Object.keys(data.data[metric]).forEach((ts) => {
      metricsData[metric][UTCTS(ts * 1000) / 1000] = data.data[metric][ts];
    });
  });

  Object.keys(metricsData).forEach((metric) => {
    const calContainer = div.append('div');
    if (fd.show_metric_name) {
      calContainer.append('h4').text(slice.verboseMetricName(metric));
    }
    const timestamps = metricsData[metric];
    const extents = d3.extent(Object.keys(timestamps), key => timestamps[key]);
    const step = (extents[1] - extents[0]) / (steps - 1);
    const colorScale = colorScalerFactory(fd.linear_color_scheme, null, null, extents);

    const legend = d3.range(steps).map(i => extents[0] + (step * i));
    const legendColors = legend.map(colorScale);

    const cal = new CalHeatMap();

    cal.init({
      start: UTCTS(data.start),
      data: timestamps,
      itemSelector: calContainer[0][0],
      legendVerticalPosition: 'top',
      cellSize,
      cellPadding,
      cellRadius,
      legendCellSize: cellSize,
      legendCellPadding: 2,
      legendCellRadius: cellRadius,
      tooltip: true,
      domain: data.domain,
      subDomain: data.subdomain,
      range: data.range,
      browsing: true,
      legend,
      legendColors: {
        colorScale,
        min: legendColors[0],
        max: legendColors[legendColors.length - 1],
        empty: 'white',
      },
      displayLegend: fd.show_legend,
      itemName: '',
      valueFormatter,
      timeFormatter,
      subDomainTextFormat,
    });
  });
}
module.exports = calHeatmap;
