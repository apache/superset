import d3 from 'd3';
import { getColorFromScheme } from '../javascripts/modules/colors';

require('./histogram.css');

function histogram(slice, payload) {
  const data = payload.data;
  const div = d3.select(slice.selector);
  const numBins = Number(slice.formData.link_length) || 10;
  const normalized = slice.formData.normalized;
  const xAxisLabel = slice.formData.x_axis_label;
  const yAxisLabel = slice.formData.y_axis_label;

  const draw = function () {
    // Set Margins
    const left = yAxisLabel ? 70 : 50;
    const margin = {
      top: 50,
      right: 10,
      bottom: 20,
      left,
    };
    const navBarHeight = 36;
    const navBarBuffer = 10;
    const width = slice.width() - margin.left - margin.right;
    const height = slice.height() - margin.top - margin.bottom - navBarHeight - navBarBuffer;

    // set number of ticks
    const maxTicks = 20;
    const numTicks = d3.min([maxTicks, numBins]);

    // Set Histogram objects
    const x = d3.scale.linear();
    const y = d3.scale.linear();
    const xAxis = d3.svg.axis()
    .scale(x)
    .orient('bottom')
    .ticks(numTicks, 's');
    const yAxis = d3.svg.axis()
    .scale(y)
    .orient('left')
    .ticks(numTicks, 's');
    // Calculate bins for the data
    let bins = d3.layout.histogram().bins(numBins)(data);
    if (normalized) {
      const total = data.length;
      bins = bins.map(d => ({ ...d, y: d.y / total }));
    }

    // Set the x-values
    const max = d3.max(data);
    const min = d3.min(data);
    x.domain([min, max])
    .range([0, width], 0.1);
    // Set the y-values
    y.domain([0, d3.max(bins, d => d.y)])
    .range([height, 0]);

    // Create the svg value with the bins
    const svg = div.selectAll('svg')
    .data([bins])
    .enter()
    .append('svg');

    // Make a rectangular background fill
    svg.append('rect')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('fill', '#f6f6f6');

    // Transform the svg to make space for the margins
    const gEnter = svg
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Add the bars and the x axis
    gEnter.append('g').attr('class', 'bars');
    gEnter.append('g').attr('class', 'x axis');

    // Add width and height to the svg
    svg.attr('width', slice.width())
    .attr('height', slice.height());

    // Create the bars in the svg
    const bar = svg.select('.bars').selectAll('.bar').data(bins);
    bar.enter().append('rect');
    bar.exit().remove();
    // Set the Height and Width for each bar
    bar.attr('width', (x(bins[0].dx) - x(0)) - 1)
    .attr('x', d => x(d.x))
    .attr('y', d => y(d.y))
    .attr('height', d => y.range()[0] - y(d.y))
    .style('fill', getColorFromScheme(1, slice.formData.color_scheme))
    .order();

    // Update the x-axis
    svg.append('g')
    .attr('class', 'axis')
    .attr('transform', 'translate(' + margin.left + ',' + (height + margin.top) + ')')
    .text('values')
    .call(xAxis);

    // Update the Y Axis and add minor lines
    svg.append('g')
    .attr('class', 'axis')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .text('count')
    .call(yAxis)
    .selectAll('g')
    .filter(function (d) { return d; })
    .classed('minor', true);

    // add axis labels if passed
    if (xAxisLabel) {
      svg.append('text')
        .attr('transform',
              'translate(' + ((width + margin.left) / 2) + ' ,' +
                             (height + margin.top + 50) + ')')
        .style('text-anchor', 'middle')
        .text(xAxisLabel);
    }
    if (yAxisLabel) {
      svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', '1em')
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text(yAxisLabel);
    }
  };

  div.selectAll('*').remove();
  draw();
}

module.exports = histogram;
