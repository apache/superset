import d3 from 'd3';
import nv from 'nvd3';

import { BREAKPOINTS, hideTooltips } from './nvd3_vis';
import { customizeToolTip, d3TimeFormatPreset } from '../javascripts/modules/utils';
import { getColorFromScheme } from '../javascripts/modules/colors';
import { getExploreLongUrl } from '../javascripts/explore/exploreUtils';

import '../node_modules/nvd3/build/nv.d3.min.css';
import './nvd3_vis.css';


export default function lineMulti(slice, payload) {
  slice.container.html('');
  slice.clearError();
  const height = slice.height();
  const width = slice.width();
  const fd = slice.formData;

  const chart = nv.models.multiChart();
  chart.interpolate('linear');

  const yAxisFormatter1 = d3.format(fd.y_axis_format);
  const yAxisFormatter2 = d3.format(fd.y_axis_2_format);
  chart.yAxis1.tickFormat(yAxisFormatter1);
  chart.yAxis2.tickFormat(yAxisFormatter2);

  const xAxisFormatter = d3TimeFormatPreset(fd.x_axis_format);
  chart.xAxis.tickFormat(xAxisFormatter);
  chart.xAxis.rotateLabels(45);

  chart.showLegend(width > BREAKPOINTS.small);
  chart.color(d => d.color || getColorFromScheme(d.key, fd.color_scheme));

  const drawGraph = function () {
    let svg = d3.select(slice.selector).select('svg');
    if (svg.empty()) {
      svg = d3.select(slice.selector).append('svg');
    }

    const data = [];
    const yAxisFormatters = [];
    const subslices = [
      ...payload.data.slices.axis1.map(subslice => [1, subslice]),
      ...payload.data.slices.axis2.map(subslice => [2, subslice]),
    ];
    let minx = Infinity;
    let maxx = -Infinity;
    subslices.forEach(([yAxis, subslice]) => {
      let filters = subslice.form_data.filters.concat(fd.filters);
      if (fd.extra_filters) {
        filters = filter.concat(fd.extra_filters);
      }
      const fdCopy = { ...subslice.form_data, filters };
      const url = getExploreLongUrl(fdCopy, 'json');
      d3.json(url, (response) => {
        response.data.forEach((datum) => {
          minx = Math.min(minx, ...datum.values.map(v => v.x));
          maxx = Math.max(maxx, ...datum.values.map(v => v.x));
          data.push({
            key: subslice.slice_name + ': ' + datum.key,
            values: datum.values,
            type: fdCopy.viz_type,
            yAxis,
          });

          yAxisFormatters.push(yAxis === 1 ? yAxisFormatter1 : yAxisFormatter2);
        });

        // add null values at the edges to fix multiChart bug
        data.forEach((datum) => {
          datum.values.push({ x: minx, y: null });
          datum.values.push({ x: maxx, y: null });
        });

        svg
        .datum(data)
        .transition().duration(500)
        .attr('height', height)
        .attr('width', width)
        .call(chart);

        customizeToolTip(chart, xAxisFormatter, yAxisFormatters);
        chart.update();
      });
    });

    chart.height(height);
    slice.container.css('height', height + 'px');

    return chart;
  };

  hideTooltips();

  nv.addGraph(drawGraph);
}
