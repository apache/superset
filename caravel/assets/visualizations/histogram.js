import { category21 } from '../javascripts/modules/colors';
import d3 from 'd3';

require('./histogram.css');

function histogram(slice) {
  const div = d3.select(slice.selector);

  const draw = function (data, numBins) {
    // Set Margins
    const margin = {
      top: 50,
      right: 10,
      bottom: 20,
      left: 50,
    };
    const navBarHeight = 36;
    const navBarBuffer = 10;
    const width = slice.width() - margin.left - margin.right;
    const height = slice.height() - margin.top - margin.bottom - navBarHeight - navBarBuffer;

    // Set Histogram objects
    const formatNumber = d3.format(',.0f');
    const formatTicks = d3.format(',.00f');
    const x = d3.scale.ordinal();
    const y = d3.scale.linear();
    const xAxis = d3.svg.axis()
    .scale(x)
    .orient('bottom')
    .ticks(numBins)
    .tickFormat(formatTicks);
    const yAxis = d3.svg.axis()
    .scale(y)
    .orient('left')
    .ticks(numBins);
    // Calculate bins for the data
    const bins = d3.layout.histogram().bins(numBins)(data);

    // Set the x-values
    x.domain(bins.map((d) => d.x))
    .rangeRoundBands([0, width], 0.1);
    // Set the y-values
    y.domain([0, d3.max(bins, (d) => d.y)])
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
    bar.attr('width', x.rangeBand())
    .attr('x', (d) => x(d.x))
    .attr('y', (d) => y(d.y))
    .attr('height', (d) => y.range()[0] - y(d.y))
    .style('fill', (d) => category21(d.length))
    .order();

    // Find maximum length to position the ticks on top of the bar correctly
    const maxLength = d3.max(bins, (d) => d.length);
    function textAboveBar(d) {
      return d.length / maxLength < 0.1;
    }

    // Add a bar text to each bar in the histogram
    svg.selectAll('.bartext')
    .data(bins)
    .enter()
    .append('text')
    .attr('dy', '.75em')
    .attr('y', function (d) {
      let padding = 0.0;
      if (textAboveBar(d)) {
        padding = 12.0;
      } else {
        padding = -8.0;
      }
      return y(d.y) - padding;
    })
    .attr('x', (d) => x(d.x) + (x.rangeBand() / 2))
    .attr('text-anchor', 'middle')
    .attr('font-weight', 'bold')
    .attr('font-size', '15px')
    .text((d) => formatNumber(d.y))
    .attr('fill', (d) => textAboveBar(d) ? 'black' : 'white')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

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
  };

  const render = function () {
    d3.json(slice.jsonEndpoint(), function (error, json) {
      if (error !== null) {
        slice.error(error.responseText, error);
        return;
      }

      const numBins = Number(json.form_data.link_length) || 10;

      div.selectAll('*').remove();
      draw(json.data, numBins);
      slice.done(json);
    });
  };

  return {
    render,
    resize: render,
  };
}

module.exports = histogram;
