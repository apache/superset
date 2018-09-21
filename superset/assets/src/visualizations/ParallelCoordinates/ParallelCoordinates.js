import d3 from 'd3';
import PropTypes from 'prop-types';
import { colorScalerFactory } from '../../modules/colors';
import parcoords from '../../../vendor/parallel_coordinates/d3.parcoords';
import divgrid from '../../../vendor/parallel_coordinates/divgrid';
import '../../../vendor/parallel_coordinates/d3.parcoords.css';
import './ParallelCoordinates.css';

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
  metrics.forEach((v) => { ttypes[v] = 'number'; });

  const colorScaler = colorMetric
    ? colorScalerFactory(linearColorScheme, data, d => d[colorMetric])
    : () => 'grey';
  const color = d => colorScaler(d[colorMetric]);
  const container = d3.select(element);
  container.selectAll('*').remove();
  const effHeight = showDatatable ? (height / 2) : height;

  const div = container.append('div')
    .style('height', effHeight + 'px')
    .classed('parcoords', true);

  const chart = parcoords()(div.node())
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
    const grid = divgrid();
    container.append('div')
      .style('height', effHeight + 'px')
      .datum(data)
      .call(grid)
      .classed('parcoords grid', true)
      .selectAll('.row')
      .on({
        mouseover(d) {
          chart.highlight([d]);
        },
        mouseout: chart.unhighlight,
      });
      // update data table on brush event
    chart.on('brush', function (d) {
      d3.select('.grid')
        .datum(d)
        .call(grid)
        .selectAll('.row')
        .on({
          mouseover(dd) {
            chart.highlight([dd]);
          },
          mouseout: chart.unhighlight,
        });
    });
  }
}

ParallelCoordinates.displayName = 'ParallelCoordinates';
ParallelCoordinates.propTypes = propTypes;

export default ParallelCoordinates;
