import d3 from 'd3';
import { getColorFromScheme } from '../javascripts/modules/colors';
import './catscat.css';

function computedProps(props) {
  const { fd, data, width, height } = props;

  const padding = {
    top: 20,
    left: 50,
    right: 20,
    bottom: 50,
  };

  const plotWidth = width - (padding.right + padding.left);
  const plotHeight = height - (padding.top + padding.bottom);

  const yMin = d3.min(data, d => d3.min(d.values, v => v.y));
  const yMax = d3.max(data, d => d3.max(d.values, v => v.y));
  const yScale = d3.scale.linear()
    .domain([yMin, yMax])
    .range([plotHeight, 0]);

  const xScale = d3.scale.ordinal()
    .domain(d3.range(data.length))
    .rangePoints([0, plotWidth]);

  const shapeValuesAll = data.map(d => d.values.map(v => v.shape));
  const shapeValues = d3.set([].concat(...shapeValuesAll)).values();
  const shapeScale = d3.scale.ordinal()
    .domain(shapeValues)
    .range(d3.svg.symbolTypes);

  const yFormat = d3.format(fd.y_axis_format);

  return {
    padding,
    plotWidth,
    plotHeight,
    yScale,
    xScale,
    shapeScale,
    yFormat,
  };
}


function scatCatViz(slice, json) {
  const div = d3.select(slice.selector);
  const fd = slice.formData;

  const width = slice.width();
  const height = slice.height();

  const data = json.data.data;
  const yLines = json.data.yLines;

  const { padding, plotHeight, plotWidth, yScale, xScale, shapeScale } = computedProps({ fd, data, width, height });

  const svg = div.append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g')
    .attr('transform', `translate(${padding.left}, ${padding.top})`);

  const yAxis = g.append('g')
    .attr('class', 'y axis');

  const xAxis = g.append('g')
    .attr('transform', `translate(${0},${plotHeight + (padding.top / 2)})`)
    .attr('class', 'x axis');

  yAxis
    .call(d3.svg.axis().scale(yScale).orient('left'));

  xAxis
    .call(d3.svg.axis().scale(xScale).orient('bottom'));


  const band = g.selectAll('.band')
    .data(data)
    .enter()
    .append('g')
    .classed('band', true)
    .attr('transform', (d, i) => `translate(${xScale(i)}, ${0})`);

  band.selectAll('.point')
    .data(d => d.values)
    .enter()
    .append('path')
    .classed('point', true)
    .attr('d', d3.svg.symbol().type(d => shapeScale(d.shape)))
    .attr('transform', d => `translate(${0}, ${yScale(d.y)})`);

  if (yLines) {
    g.selectAll('.line')
      .data(yLines)
      .enter()
      .append('line')
      .classed('line', true)
      .attr('stroke', 'red')
      .attr('stroke-width', 1.5)
      .attr('x1', 0)
      .attr('x2', plotWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
  }
}

module.exports = scatCatViz;
