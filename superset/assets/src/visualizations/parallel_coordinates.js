import d3 from 'd3';
import '../../vendor/parallel_coordinates/d3.parcoords.css';
import './parallel_coordinates.css';
import { colorScalerFactory } from '../modules/colors';

d3.parcoords = require('../../vendor/parallel_coordinates/d3.parcoords.js');
d3.divgrid = require('../../vendor/parallel_coordinates/divgrid.js');

const $ = require('jquery');

function parallelCoordVis(slice, payload) {
  $('#code').attr('rows', '15');
  const fd = slice.formData;
  const data = payload.data;

  const metrics = fd.metrics.map(m => m.label || m);

  let cols = metrics;
  if (fd.include_series) {
    cols = [fd.series].concat(metrics);
  }

  const ttypes = {};
  ttypes[fd.series] = 'string';
  metrics.forEach(function (v) {
    ttypes[v] = 'number';
  });

  const secondaryMetric = fd.secondary_metric ? fd.secondary_metric.label : fd.secondary_metric;
  const colorScaler = fd.secondary_metric ?
    colorScalerFactory(fd.linear_color_scheme, data, d => d[secondaryMetric]) :
    () => 'grey';
  const color = d => colorScaler(d[secondaryMetric]);
  const container = d3.select(slice.selector);
  container.selectAll('*').remove();
  const effHeight = fd.show_datatable ? (slice.height() / 2) : slice.height();

  container.append('div')
      .attr('id', 'parcoords_' + slice.container_id)
      .style('height', effHeight + 'px')
      .classed('parcoords', true);

  const parcoords = d3.parcoords()('#parcoords_' + slice.container_id)
      .width(slice.width())
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

  if (fd.show_datatable) {
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

module.exports = parallelCoordVis;
