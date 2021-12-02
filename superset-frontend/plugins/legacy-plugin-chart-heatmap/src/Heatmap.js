/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint-disable func-names, react/sort-prop-types */
import d3 from 'd3';
import PropTypes from 'prop-types';
import 'd3-svg-legend';
import d3tip from 'd3-tip';
import {
  getNumberFormatter,
  NumberFormats,
  getSequentialSchemeRegistry,
} from '@superset-ui/core';

import './vendor/d3tip.css';
import './Heatmap.css';

const propTypes = {
  data: PropTypes.shape({
    records: PropTypes.arrayOf(
      PropTypes.shape({
        x: PropTypes.string,
        y: PropTypes.string,
        v: PropTypes.number,
        perc: PropTypes.number,
        rank: PropTypes.number,
      }),
    ),
    extents: PropTypes.arrayOf(PropTypes.number),
  }),
  width: PropTypes.number,
  height: PropTypes.number,
  bottomMargin: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  colorScheme: PropTypes.string,
  columnX: PropTypes.string,
  columnY: PropTypes.string,
  leftMargin: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  metric: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
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

const DEFAULT_PROPERTIES = {
  minChartWidth: 150,
  minChartHeight: 150,
  marginLeft: 35,
  marginBottom: 35,
  marginTop: 10,
  marginRight: 10,
};

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

  let showY = true;
  let showX = true;
  const pixelsPerCharX = 4.5; // approx, depends on font size
  const pixelsPerCharY = 6; // approx, depends on font size

  const valueFormatter = getNumberFormatter(numberFormat);

  // Dynamically adjusts  based on max x / y category lengths
  function adjustMargins() {
    let longestX = 1;
    let longestY = 1;

    records.forEach(datum => {
      longestX = Math.max(
        longestX,
        (datum.x && datum.x.toString().length) || 1,
      );
      longestY = Math.max(
        longestY,
        (datum.y && datum.y.toString().length) || 1,
      );
    });

    if (leftMargin === 'auto') {
      margin.left = Math.ceil(Math.max(margin.left, pixelsPerCharY * longestY));
    } else {
      margin.left = leftMargin;
    }

    if (showLegend) {
      margin.right += 40;
    }

    margin.bottom =
      bottomMargin === 'auto'
        ? Math.ceil(Math.max(margin.bottom, pixelsPerCharX * longestX))
        : bottomMargin;
  }

  // Check if x axis "x" position is outside of the container and rotate labels 90deg
  function checkLabelPosition(container) {
    const xAxisNode = container.select('.x.axis').node();

    if (!xAxisNode) {
      return;
    }

    if (
      xAxisNode.getBoundingClientRect().x + 4 <
      container.node().getBoundingClientRect().x
    ) {
      container
        .selectAll('.x.axis')
        .selectAll('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -6)
        .attr('y', 0)
        .attr('dy', '0.3em');
    }
  }

  function ordScale(k, rangeBands, sortMethod) {
    let domain = {};
    const actualKeys = {}; // hack to preserve type of keys when number
    records.forEach(d => {
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
      domain = Object.keys(domain).sort((a, b) =>
        domain[a] > domain[b] ? -1 : 1,
      );
    } else if (sortMethod === 'value_asc') {
      domain = Object.keys(domain).sort((a, b) =>
        domain[b] > domain[a] ? -1 : 1,
      );
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

  let hmWidth = width - (margin.left + margin.right);
  let hmHeight = height - (margin.bottom + margin.top);
  const hideYLabel = () => {
    margin.left =
      leftMargin === 'auto' ? DEFAULT_PROPERTIES.marginLeft : leftMargin;
    hmWidth = width - (margin.left + margin.right);
    showY = false;
  };

  const hideXLabel = () => {
    margin.bottom =
      bottomMargin === 'auto' ? DEFAULT_PROPERTIES.marginBottom : bottomMargin;
    hmHeight = height - (margin.bottom + margin.top);
    showX = false;
  };

  // Hide Y Labels
  if (hmWidth < DEFAULT_PROPERTIES.minChartWidth) {
    hideYLabel();
  }

  // Hide X Labels
  if (
    hmHeight < DEFAULT_PROPERTIES.minChartHeight ||
    hmWidth < DEFAULT_PROPERTIES.minChartWidth
  ) {
    hideXLabel();
  }

  if (showY && hmHeight < DEFAULT_PROPERTIES.minChartHeight) {
    hideYLabel();
  }

  const fp = getNumberFormatter(NumberFormats.PERCENT);

  const xScale = ordScale('x', null, sortXAxis);
  const yScale = ordScale('y', null, sortYAxis);
  const xRbScale = ordScale('x', [0, hmWidth], sortXAxis);
  const yRbScale = ordScale('y', [hmHeight, 0], sortYAxis);
  const X = 0;
  const Y = 1;
  const heatmapDim = [xRbScale.domain().length, yRbScale.domain().length];

  const minBound = yAxisBounds[0] || 0;
  const maxBound = yAxisBounds[1] || 1;
  const colorScale = getSequentialSchemeRegistry()
    .get(colorScheme)
    .createLinearScale([minBound, maxBound]);

  const scale = [
    d3.scale.linear().domain([0, heatmapDim[X]]).range([0, hmWidth]),
    d3.scale.linear().domain([0, heatmapDim[Y]]).range([0, hmHeight]),
  ];

  const container = d3.select(element);
  container.classed('superset-legacy-chart-heatmap', true);

  const canvas = container
    .append('canvas')
    .attr('width', heatmapDim[X])
    .attr('height', heatmapDim[Y])
    .style('width', `${hmWidth}px`)
    .style('height', `${hmHeight}px`)
    .style('image-rendering', canvasImageRendering)
    .style('left', `${margin.left}px`)
    .style('top', `${margin.top}px`)
    .style('position', 'absolute');

  const svg = container
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'heatmap-container')
    .style('position', 'relative');

  if (showValues) {
    const cells = svg
      .selectAll('rect')
      .data(records)
      .enter()
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    cells
      .append('text')
      .attr('transform', d => `translate(${xRbScale(d.x)}, ${yRbScale(d.y)})`)
      .attr('y', yRbScale.rangeBand() / 2)
      .attr('x', xRbScale.rangeBand() / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .text(d => valueFormatter(d.v))
      .attr(
        'font-size',
        `${Math.min(yRbScale.rangeBand(), xRbScale.rangeBand()) / 3}px`,
      )
      .attr('fill', d => (d.v >= extents[1] / 2 ? 'white' : 'black'));
  }

  if (showLegend) {
    const colorLegend = d3.legend
      .color()
      .labelFormat(valueFormatter)
      .scale(colorScale)
      .shapePadding(0)
      .cells(10)
      .shapeWidth(10)
      .shapeHeight(10)
      .labelOffset(3);

    svg
      .append('g')
      .attr('transform', `translate(${width - 40}, ${margin.top})`)
      .call(colorLegend);
  }

  const tip = d3tip()
    .attr('class', 'd3-tip')
    .offset(function () {
      const k = d3.mouse(this);
      const x = k[0] - hmWidth / 2;

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
        s += `<div><b>${columnX}: </b>${obj.x}<div>`;
        s += `<div><b>${columnY}: </b>${obj.y}<div>`;
        s += `<div><b>${metricLabel}: </b>${valueFormatter(obj.v)}<div>`;
        if (showPercentage) {
          s += `<div><b>%: </b>${fp(normalized ? obj.rank : obj.perc)}<div>`;
        }
        tip.style('display', null);
      } else {
        // this is a hack to hide the tooltip because we have map it to a single <rect>
        // d3-tip toggles opacity and calling hide here is undone by the lib after this call
        tip.style('display', 'none');
      }

      return s;
    });

  const rect = svg
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`)
    .append('rect')
    .classed('background-rect', true)
    .on('mousemove', tip.show)
    .on('mouseout', tip.hide)
    .attr('width', hmWidth)
    .attr('height', hmHeight);

  rect.call(tip);

  if (showX) {
    const xAxis = d3.svg
      .axis()
      .scale(xRbScale)
      .outerTickSize(0)
      .tickValues(xRbScale.domain().filter((d, i) => !(i % xScaleInterval)))
      .orient('bottom');

    svg
      .append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(${margin.left},${margin.top + hmHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('x', -4)
      .attr('y', 10)
      .attr('dy', '0.3em')
      .style('text-anchor', 'end')
      .attr('transform', 'rotate(-45)');
  }

  if (showY) {
    const yAxis = d3.svg
      .axis()
      .scale(yRbScale)
      .outerTickSize(0)
      .tickValues(yRbScale.domain().filter((d, i) => !(i % yScaleInterval)))
      .orient('left');

    svg
      .append('g')
      .attr('class', 'y axis')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .call(yAxis);
  }

  checkLabelPosition(container);
  const context = canvas.node().getContext('2d');
  context.imageSmoothingEnabled = false;

  // Compute the pixel colors; scaled by CSS.
  function createImageObj() {
    const imageObj = new Image();
    const image = context.createImageData(heatmapDim[0], heatmapDim[1]);
    const pixs = {};
    records.forEach(d => {
      const c = d3.rgb(colorScale(normalized ? d.rank : d.perc));
      const x = xScale(d.x);
      const y = yScale(d.y);
      pixs[x + y * xScale.domain().length] = c;
      if (matrix[x] === undefined) {
        matrix[x] = {};
      }
      if (matrix[x][y] === undefined) {
        matrix[x][y] = d;
      }
    });

    let p = 0;
    for (let i = 0; i < heatmapDim[0] * heatmapDim[1]; i += 1) {
      let c = pixs[i];
      let alpha = 255;
      if (c === undefined) {
        c = d3.rgb('#F00');
        alpha = 0;
      }
      image.data[p + 0] = c.r;
      image.data[p + 1] = c.g;
      image.data[p + 2] = c.b;
      image.data[p + 3] = alpha;
      p += 4;
    }
    context.putImageData(image, 0, 0);
    imageObj.src = canvas.node().toDataURL();
  }
  createImageObj();
}

Heatmap.displayName = 'Heatmap';
Heatmap.propTypes = propTypes;

export default Heatmap;
