import d3 from 'd3';
import { formatDate } from '../javascripts/modules/dates';
import { category21 } from '../javascripts/modules/colors';
const d3tip = require('d3-tip');
require('./events.css');

const MIN_RECT_WIDTH = 2;
const TRACKS_PER_BAND = 10;
const SESSION_BREAK = 60 * 5;

function eventsViz(slice) {
  function refresh() {
    d3.json(slice.jsonEndpoint(), function (error, payload) {
      if (error) {
        slice.error(error.responseText, error);
        return;
      }
      const data = payload.data;
      const categories = [];
      payload.data.forEach(d => {
        if (categories.indexOf(d.category) < 0) {
          categories.push(d.category);
        }
      });
      const width = slice.width();
      const height = slice.height();
      const div = d3.select(slice.selector);
      const ext = d3.extent(payload.data, r => r.ts);

      div.selectAll('*').remove();

      const svg = div.append('svg')
        .attr('width', width - 5)
        .attr('height', height - 5);

      const padding = 10;
      const axisHeight = 40;
      const axisWidth = 150;

      const yScale = d3.scale.ordinal()
        .domain(categories)
        .rangeBands([0, height - axisHeight]);

      const xScale = d3.time.scale()
        .domain(ext)
        .range([axisWidth, width - padding]);

      const xAxis = d3.svg.axis()
        .orient('bottom')
        .tickFormat(formatDate)
        .scale(xScale);

      const yAxis = d3.svg.axis()
        .orient('left')
        .scale(yScale);

      svg.append('g')
        .attr('transform', `translate(0, ${height - axisHeight})`)
        .attr('class', 'xaxis axis')
        .call(xAxis);

      svg.append('g')
        .attr('transform', `translate(${axisWidth}, 0)`)
        .attr('class', 'yaxis axis')
        .call(yAxis);

      const tip = d3tip()
        .attr('class', 'd3-tip')
        .offset([5, 5])
        .html(function (d) {
          return `<pre>${JSON.stringify(d, null, '  ')}</pre>`;
        });
      svg.call(tip);

      const categoryCounter = {};
      categories.forEach(cat => categoryCounter[cat] = 0);

      const rects = svg.selectAll('rect')
      .data(payload.data)
      .enter()
      .append('rect')
      .on('mouseover', function(d) {
        tip.show(d, this);
      })
      .on('mouseout', function(d) {
        tip.hide(d, this);
      })
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 0)
      .transition()
      .delay((d, i) => i*10)
      .attr('x', d => xScale(d.ts))
      .attr('y', (d, i) => {
        const v = (
          yScale(d.category) +
          (categoryCounter[d.category] % TRACKS_PER_BAND / (TRACKS_PER_BAND + 1)) *
          (height / categories.length)
        )
        categoryCounter[d.category] += 1;
        return v;
      })
      .attr('width',  (d, i) => {
        let v = MIN_RECT_WIDTH;
        if(i < data.length - 1){
          v = (data[i+1].ts - data[i].ts) / (ext[1] - ext[0]) * width;
        }
        return Math.max(Math.abs(v), MIN_RECT_WIDTH);
      })
      .attr('height',  height / (categories.length * TRACKS_PER_BAND))
      .style('opacity', 1)
      .style('stroke', 'black')
      .style('stroke-width', '1px')
      .style('fill', d => category21(d.category));

      slice.done(payload);
    });
  }
  return {
    render: refresh,
    resize: refresh,
  };
}

module.exports = eventsViz;
