import d3 from 'd3';
import PropTypes from 'prop-types';
import { colorScalerFactory } from '../modules/colors';
import CalHeatMap from '../../vendor/cal-heatmap/cal-heatmap';
import { d3TimeFormatPreset, d3FormatPreset } from '../modules/utils';
import { UTC } from '../modules/dates';
import '../../vendor/cal-heatmap/cal-heatmap.css';
import './cal_heatmap.css';

const UTCTS = uts => UTC(new Date(uts)).getTime();

const propTypes = {
  data: PropTypes.shape({
    // Object hashed by metric name,
    // then hashed by timestamp (in seconds, not milliseconds) as float
    // the innermost value is count
    // e.g. { count_distinct_something: { 1535034236.0: 3 } }
    data: PropTypes.object,
    domain: PropTypes.string,
    range: PropTypes.number,
    // timestamp in milliseconds
    start: PropTypes.number,
    subdomain: PropTypes.string,
  }),
  height: PropTypes.number,
  cellPadding: PropTypes.number,
  cellRadius: PropTypes.number,
  cellSize: PropTypes.number,
  linearColorScheme: PropTypes.string,
  showLegend: PropTypes.bool,
  showMetricName: PropTypes.bool,
  showValues: PropTypes.bool,
  steps: PropTypes.number,
  timeFormat: PropTypes.string,
  valueFormat: PropTypes.string,
  verboseMap: PropTypes.object,
};

function Calendar(element, props) {
  PropTypes.checkPropTypes(propTypes, props, 'prop', 'Calendar');

  const {
    data,
    height,
    cellPadding = 3,
    cellRadius = 0,
    cellSize = 10,
    linearColorScheme,
    showLegend,
    showMetricName,
    showValues,
    steps,
    timeFormat,
    valueFormat,
    verboseMap,
  } = props;

  const valueFormatter = d3FormatPreset(valueFormat);
  const timeFormatter = d3TimeFormatPreset(timeFormat);

  const container = d3.select(element)
    .style('height', height);
  container.selectAll('*').remove();
  const div = container.append('div');

  const subDomainTextFormat = showValues ? (date, value) => valueFormatter(value) : null;

  // Trick to convert all timestamps to UTC
  // TODO: Verify if this conversion is really necessary
  // since all timestamps should always be in UTC.
  const metricsData = {};
  Object.keys(data.data).forEach((metric) => {
    metricsData[metric] = {};
    Object.keys(data.data[metric]).forEach((ts) => {
      metricsData[metric][UTCTS(ts * 1000) / 1000] = data.data[metric][ts];
    });
  });

  Object.keys(metricsData).forEach((metric) => {
    const calContainer = div.append('div');
    if (showMetricName) {
      calContainer.text(`Metric: ${verboseMap[metric] || metric}`);
    }
    const timestamps = metricsData[metric];
    const extents = d3.extent(Object.keys(timestamps), key => timestamps[key]);
    const step = (extents[1] - extents[0]) / (steps - 1);
    const colorScale = colorScalerFactory(linearColorScheme, null, null, extents);

    const legend = d3.range(steps)
      .map(i => extents[0] + (step * i));
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
      displayLegend: showLegend,
      itemName: '',
      valueFormatter,
      timeFormatter,
      subDomainTextFormat,
    });
  });
}

Calendar.propTypes = propTypes;

function adaptor(slice, payload) {
  const { selector, formData, datasource } = slice;
  const {
    cell_padding: cellPadding,
    cell_radius: cellRadius,
    cell_size: cellSize,
    linear_color_scheme: linearColorScheme,
    show_legend: showLegend,
    show_metric_name: showMetricName,
    show_values: showValues,
    steps,
    x_axis_time_format: timeFormat,
    y_axis_format: valueFormat,
  } = formData;
  const { verbose_map: verboseMap } = datasource;
  const element = document.querySelector(selector);

  return Calendar(element, {
    data: payload.data,
    height: slice.height(),
    cellPadding,
    cellRadius,
    cellSize,
    linearColorScheme,
    showLegend,
    showMetricName,
    showValues,
    steps,
    timeFormat,
    valueFormat,
    verboseMap,
  });
}

export default adaptor;
