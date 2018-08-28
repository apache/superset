import d3 from 'd3';
import PropTypes from 'prop-types';
import { colorScalerFactory } from '../modules/colors';
import '../../vendor/parallel_coordinates/d3.parcoords.css';
import './parallel_coordinates.css';

d3.parcoords = require('../../vendor/parallel_coordinates/d3.parcoords.js');
d3.divgrid = require('../../vendor/parallel_coordinates/divgrid.js');

const propTypes = {
  // Standard tabular data [{ fieldName1: value1, fieldName2: value2 }]
  data: PropTypes.arrayOf(PropTypes.object),
  width: PropTypes.number,
  height: PropTypes.number,
  colorMetric: PropTypes.string,
  includeSeries: PropTypes.bool,
  linearColorScheme: PropTypes.string,
  metrics: PropTypes.arrayOf(PropTypes.string),
  series: PropTypes.string,
  showDatatable: PropTypes.bool,
};

function ParallelCoordinates(element, props) {
  PropTypes.checkPropTypes(propTypes, props, 'prop', 'ParallelCoordinates');

  const {
    data,
    width,
    height,
    colorMetric,
    includeSeries,
    linearColorScheme,
    metrics,
    series,
    showDatatable,
  } = props;

  const cols = includeSeries ? [series].concat(metrics) : metrics;

  const ttypes = {};
  ttypes[series] = 'string';
  metrics.forEach(function (v) {
    ttypes[v] = 'number';
  });

  const colorScaler = colorMetric
    ? colorScalerFactory(linearColorScheme, data, d => d[colorMetric])
    : () => 'grey';
  const color = d => colorScaler(d[colorMetric]);
  const container = d3.select(element);
  container.selectAll('*').remove();
  const effHeight = showDatatable ? (height / 2) : height;

  const div = container.append('div')
    // .attr('id', 'parcoords_' + slice.container_id)
    .style('height', effHeight + 'px')
    .classed('parcoords', true);

  const parcoords = d3.parcoords()(div.node())
    .width(width)
    .color(color)
    .alpha(0.5)
    .composite('darken')
    .height(effHeight)
    .data(data)
    .dimensions(cols)
    .types(ttypes)
    .render()
    .createAxes()
    .shadows()
    .reorderable()
    .brushMode('1D-axes');

  if (showDatatable) {
      // create data table, row hover highlighting
    const grid = d3.divgrid();
    container.append('div')
      .style('height', effHeight + 'px')
      .datum(data)
      .call(grid)
      .classed('parcoords grid', true)
      .selectAll('.row')
      .on({
        mouseover(d) {
          parcoords.highlight([d]);
        },
        mouseout: parcoords.unhighlight,
      });
      // update data table on brush event
    parcoords.on('brush', function (d) {
      d3.select('.grid')
        .datum(d)
        .call(grid)
        .selectAll('.row')
        .on({
          mouseover(dd) {
            parcoords.highlight([dd]);
          },
          mouseout: parcoords.unhighlight,
        });
    });
  }
}

ParallelCoordinates.propTypes = propTypes;

function adaptor(slice, payload) {
  const { selector, formData } = slice;
  const {
    include_series: includeSeries,
    linear_color_scheme: linearColorScheme,
    metrics,
    secondary_metric: secondaryMetric,
    series,
    show_datatable: showDatatable,
  } = formData;
  const element = document.querySelector(selector);

  return ParallelCoordinates(element, {
    data: payload.data,
    width: slice.width(),
    height: slice.height(),
    includeSeries,
    linearColorScheme,
    metrics: metrics.map(m => m.label || m),
    colorMetric: secondaryMetric && secondaryMetric.label
      ? secondaryMetric.label
      : secondaryMetric,
    series,
    showDatatable,
  });
}

export default adaptor;
