import d3 from 'd3';
import PropTypes from 'prop-types';
import 'd3-svg-legend';
import d3tip from 'd3-tip';

import { colorScalerFactory } from '../../modules/colors';
import '../../../stylesheets/d3tip.css';
import './Heatmap.css';

const propTypes = {
  data: PropTypes.shape({
    records: PropTypes.arrayOf(PropTypes.shape({
      x: PropTypes.string,
      y: PropTypes.string,
      v: PropTypes.number,
      perc: PropTypes.number,
      rank: PropTypes.number,
    })),
    extents: PropTypes.arrayOf(PropTypes.number),
  }),
  width: PropTypes.number,
  height: PropTypes.number,
  bottomMargin: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  colorScheme: PropTypes.string,
  columnX: PropTypes.string,
  columnY: PropTypes.string,
  leftMargin: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  metric: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object,
  ]),
  normalized: PropTypes.bool,
  numberFormat: PropTypes.string,
  showLegend: PropTypes.bool,
  showPercentage: PropTypes.bool,
  showValues: PropTypes.bool,
  sortXAxis: PropTypes.string,
  sortYAxis: PropTypes.string,
  xScaleInterval: PropTypes.number,
  yScaleInterval: PropTypes.number,
  yAxisBounds: PropTypes.arrayOf(PropTypes.number),
};

function cmp(a, b) {
  return a > b ? 1 : -1;
}

// Inspired from http://bl.ocks.org/mbostock/3074470
// https://jsfiddle.net/cyril123/h0reyumq/
function Heatmap(element, props) {
  const {
    data,
    width,
    height,
    bottomMargin,
    canvasImageRendering,
    colorScheme,
    columnX,
    columnY,
    leftMargin,
    metric,
    normalized,
    numberFormat,
    showLegend,
    showPercentage,
    showValues,
    sortXAxis,
    sortYAxis,
    xScaleInterval,
    yScaleInterval,
    yAxisBounds,
  } = props;

  const { records, extents } = data;

  const margin = {
    top: 10,
    right: 10,
    bottom: 35,
    left: 35,
  };
  const valueFormatter = d3.format(numberFormat);

  // Dynamically adjusts  based on max x / y category lengths
  function adjustMargins() {
    const pixelsPerCharX = 4.5; // approx, depends on font size
    const pixelsPerCharY = 6; // approx, depends on font size
    let longestX = 1;
    let longestY = 1;

    for (let i = 0; i < records.length; i++) {
      const datum = records[i];
      longestX = Math.max(longestX, datum.x.toString().length || 1);
      longestY = Math.max(longestY, datum.y.toString().length || 1);
    }

    if (leftMargin === 'auto') {
      margin.left = Math.ceil(Math.max(margin.left, pixelsPerCharY * longestY));
    } else {
      margin.left = leftMargin;
    }

    if (showLegend) {
      margin.right += 40;
    }

    margin.bottom = (bottomMargin === 'auto')
      ? Math.ceil(Math.max(margin.bottom, pixelsPerCharX * longestX))
      : bottomMargin;
  }

  function ordScale(k, rangeBands, sortMethod) {
    let domain = {};
    const actualKeys = {};  // hack to preserve type of keys when number
    records.forEach((d) => {
      domain[d[k]] = (domain[d[k]] || 0) + d.v;
      actualKeys[d[k]] = d[k];
    });
    // Not usgin object.keys() as it converts to strings
    const keys = Object.keys(actualKeys).map(s => actualKeys[s]);
    if (sortMethod === 'alpha_asc') {
      domain = keys.sort(cmp);
    } else if (sortMethod === 'alpha_desc') {
      domain = keys.sort(cmp).reverse();
    } else if (sortMethod === 'value_desc') {
      domain = Object.keys(domain).sort((a, b) => domain[a] > domain[b] ? -1 : 1);
    } else if (sortMethod === 'value_asc') {
      domain = Object.keys(domain).sort((a, b) => domain[b] > domain[a] ? -1 : 1);
    }

    if (k === 'y' && rangeBands) {
      domain.reverse();
    }

    if (rangeBands) {
      return d3.scale.ordinal().domain(domain).rangeBands(rangeBands);
    }
    return d3.scale.ordinal().domain(domain).range(d3.range(domain.length));
  }

  // eslint-disable-next-line no-param-reassign
  element.innerHTML = '';
  const matrix = {};

  adjustMargins();

  const hmWidth = width - (margin.left + margin.right);
  const hmHeight = height - (margin.bottom + margin.top);
  const fp = d3.format('.2%');

  const xScale = ordScale('x', null, sortXAxis);
  const yScale = ordScale('y', null, sortYAxis);
  const xRbScale = ordScale('x', [0, hmWidth], sortXAxis);
  const yRbScale = ordScale('y', [hmHeight, 0], sortYAxis);
  const X = 0;
  const Y = 1;
  const heatmapDim = [xRbScale.domain().length, yRbScale.domain().length];

  const minBound = yAxisBounds[0] || 0;
  const maxBound = yAxisBounds[1] || 1;
  const colorScaler = colorScalerFactory(colorScheme, null, null, [minBound, maxBound]);

  const scale = [
    d3.scale.linear()
      .domain([0, heatmapDim[X]])
      .range([0, hmWidth]),
    d3.scale.linear()
      .domain([0, heatmapDim[Y]])
      .range([0, hmHeight]),
  ];

  const container = d3.select(element);

  const canvas = container.append('canvas')
    .attr('width', heatmapDim[X])
    .attr('height', heatmapDim[Y])
    .style('width', hmWidth + 'px')
    .style('height', hmHeight + 'px')
    .style('image-rendering', canvasImageRendering)
    .style('left', margin.left + 'px')
    .style('top', margin.top + 'px')
    .style('position', 'absolute');

  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('position', 'relative');

  if (showValues) {
    const cells = svg.selectAll('rect')
      .data(records)
      .enter()
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    cells.append('text')
      .attr('transform', d => `translate(${xRbScale(d.x)}, ${yRbScale(d.y)})`)
      .attr('y', yRbScale.rangeBand() / 2)
      .attr('x', xRbScale.rangeBand() / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .text(d => valueFormatter(d.v))
      .attr('font-size', Math.min(yRbScale.rangeBand(), xRbScale.rangeBand()) / 3 + 'px')
      .attr('fill', d => d.v >= extents[1] / 2 ? 'white' : 'black');
  }

  if (showLegend) {
    const colorLegend = d3.legend.color()
      .labelFormat(valueFormatter)
      .scale(colorScaler)
      .shapePadding(0)
      .cells(10)
      .shapeWidth(10)
      .shapeHeight(10)
      .labelOffset(3);

    svg.append('g')
      .attr('transform', `translate(${width - 40}, ${margin.top})`)
      .call(colorLegend);
  }

  const tip = d3tip()
    .attr('class', 'd3-tip')
    .offset(function () {
      const k = d3.mouse(this);
      const x = k[0] - (hmWidth / 2);
      return [k[1] - 20, x];
    })
    .html(function () {
      let s = '';
      const k = d3.mouse(this);
      const m = Math.floor(scale[0].invert(k[0]));
      const n = Math.floor(scale[1].invert(k[1]));
      const metricLabel = typeof metric === 'object' ? metric.label : metric;
      if (m in matrix && n in matrix[m]) {
        const obj = matrix[m][n];
        s += '<div><b>' + columnX + ': </b>' + obj.x + '<div>';
        s += '<div><b>' + columnY + ': </b>' + obj.y + '<div>';
        s += '<div><b>' + metricLabel + ': </b>' + valueFormatter(obj.v) + '<div>';
        if (showPercentage) {
          s += '<div><b>%: </b>' + fp(normalized ? obj.rank : obj.perc) + '<div>';
        }
        tip.style('display', null);
      } else {
        // this is a hack to hide the tooltip because we have map it to a single <rect>
        // d3-tip toggles opacity and calling hide here is undone by the lib after this call
        tip.style('display', 'none');
      }
      return s;
    });

  const rect = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)
    .append('rect')
      .classed('background-rect', true)
      .on('mousemove', tip.show)
      .on('mouseout', tip.hide)
      .attr('width', hmWidth)
      .attr('height', hmHeight);

  rect.call(tip);

  const xAxis = d3.svg.axis()
    .scale(xRbScale)
    .outerTickSize(0)
    .tickValues(xRbScale.domain().filter(
      function (d, i) {
        return !(i % (xScaleInterval));
      }))
    .orient('bottom');

  const yAxis = d3.svg.axis()
    .scale(yRbScale)
    .outerTickSize(0)
    .tickValues(yRbScale.domain().filter(
      function (d, i) {
        return !(i % (yScaleInterval));
      }))
    .orient('left');

  svg.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(' + margin.left + ',' + (margin.top + hmHeight) + ')')
      .call(xAxis)
    .selectAll('text')
      .attr('x', -4)
      .attr('y', 10)
      .attr('dy', '0.3em')
      .style('text-anchor', 'end')
      .attr('transform', 'rotate(-45)');

  svg.append('g')
    .attr('class', 'y axis')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .call(yAxis);

  const context = canvas.node().getContext('2d');
  context.imageSmoothingEnabled = false;

  // Compute the pixel colors; scaled by CSS.
  function createImageObj() {
    const imageObj = new Image();
    const image = context.createImageData(heatmapDim[0], heatmapDim[1]);
    const pixs = {};
    records.forEach((d) => {
      const c = d3.rgb(colorScaler(normalized ? d.rank : d.perc));
      const x = xScale(d.x);
      const y = yScale(d.y);
      pixs[x + (y * xScale.domain().length)] = c;
      if (matrix[x] === undefined) {
        matrix[x] = {};
      }
      if (matrix[x][y] === undefined) {
        matrix[x][y] = d;
      }
    });

    let p = -1;
    for (let i = 0; i < heatmapDim[0] * heatmapDim[1]; i++) {
      let c = pixs[i];
      let alpha = 255;
      if (c === undefined) {
        c = d3.rgb('#F00');
        alpha = 0;
      }
      image.data[++p] = c.r;
      image.data[++p] = c.g;
      image.data[++p] = c.b;
      image.data[++p] = alpha;
    }
    context.putImageData(image, 0, 0);
    imageObj.src = canvas.node().toDataURL();
  }
  createImageObj();
}

Heatmap.displayName = 'Heatmap';
Heatmap.propTypes = propTypes;

export default Heatmap;
