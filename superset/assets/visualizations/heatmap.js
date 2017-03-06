import d3 from 'd3';
import { colorScalerFactory } from '../javascripts/modules/colors';

const $ = require('jquery');
d3.tip = require('d3-tip');

require('./heatmap.css');

// Inspired from http://bl.ocks.org/mbostock/3074470
// https://jsfiddle.net/cyril123/h0reyumq/
function heatmapVis(slice, payload) {
  // Header for panel in explore v2
  const header = document.getElementById('slice-header');
  const headerHeight = header ? 30 + header.getBoundingClientRect().height : 0;
  const margin = {
    top: headerHeight,
    right: 10,
    bottom: 35,
    left: 35,
  };

  const data = payload.data;
  // Dynamically adjusts  based on max x / y category lengths
  function adjustMargins() {
    const pixelsPerCharX = 4.5; // approx, depends on font size
    const pixelsPerCharY = 6.8; // approx, depends on font size
    let longestX = 1;
    let longestY = 1;
    let datum;

    for (let i = 0; i < data.length; i++) {
      datum = data[i];
      longestX = Math.max(longestX, datum.x.length || 1);
      longestY = Math.max(longestY, datum.y.length || 1);
    }

    margin.left = Math.ceil(Math.max(margin.left, pixelsPerCharY * longestY));
    margin.bottom = Math.ceil(Math.max(margin.bottom, pixelsPerCharX * longestX));
  }

  function ordScale(k, rangeBands, reverse = false) {
    let domain = {};
    $.each(data, function (i, d) {
      domain[d[k]] = true;
    });
    domain = Object.keys(domain).sort(function (a, b) {
      return b - a;
    });
    if (reverse) {
      domain.reverse();
    }
    if (rangeBands === undefined) {
      return d3.scale.ordinal().domain(domain).range(d3.range(domain.length));
    }
    return d3.scale.ordinal().domain(domain).rangeBands(rangeBands);
  }

  slice.container.html('');
  const matrix = {};
  const fd = slice.formData;

  adjustMargins();

  const width = slice.width();
  const height = slice.height();
  const hmWidth = width - (margin.left + margin.right);
  const hmHeight = height - (margin.bottom + margin.top);
  const fp = d3.format('.3p');

  const xScale = ordScale('x');
  const yScale = ordScale('y', undefined, true);
  const xRbScale = ordScale('x', [0, hmWidth]);
  const yRbScale = ordScale('y', [hmHeight, 0]);
  const X = 0;
  const Y = 1;
  const heatmapDim = [xRbScale.domain().length, yRbScale.domain().length];

  const color = colorScalerFactory(fd.linear_color_scheme);

  const scale = [
    d3.scale.linear()
    .domain([0, heatmapDim[X]])
    .range([0, hmWidth]),
    d3.scale.linear()
    .domain([0, heatmapDim[Y]])
    .range([0, hmHeight]),
  ];

  const container = d3.select(slice.selector);

  const canvas = container.append('canvas')
    .attr('width', heatmapDim[X])
    .attr('height', heatmapDim[Y])
    .style('width', hmWidth + 'px')
    .style('height', hmHeight + 'px')
    .style('image-rendering', fd.canvas_image_rendering)
    .style('left', margin.left + 'px')
    .style('top', margin.top + headerHeight + 'px')
    .style('position', 'absolute');

  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('left', '0px')
    .style('top', headerHeight + 'px')
    .style('position', 'absolute');

  const rect = svg.append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .append('rect')
    .style('fill-opacity', 0)
    .attr('stroke', 'black')
    .attr('width', hmWidth)
    .attr('height', hmHeight);

  const tip = d3.tip()
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
      if (m in matrix && n in matrix[m]) {
        const obj = matrix[m][n];
        s += '<div><b>' + fd.all_columns_x + ': </b>' + obj.x + '<div>';
        s += '<div><b>' + fd.all_columns_y + ': </b>' + obj.y + '<div>';
        s += '<div><b>' + fd.metric + ': </b>' + obj.v + '<div>';
        s += '<div><b>%: </b>' + fp(obj.perc) + '<div>';
        tip.style('display', null);
      } else {
        // this is a hack to hide the tooltip because we have map it to a single <rect>
        // d3-tip toggles opacity and calling hide here is undone by the lib after this call
        tip.style('display', 'none');
      }
      return s;
    });

  rect.call(tip);

  const xAxis = d3.svg.axis()
    .scale(xRbScale)
    .tickValues(xRbScale.domain().filter(
      function (d, i) {
        return !(i % (parseInt(fd.xscale_interval, 10)));
      }))
    .orient('bottom');

  const yAxis = d3.svg.axis()
    .scale(yRbScale)
    .tickValues(yRbScale.domain().filter(
      function (d, i) {
        return !(i % (parseInt(fd.yscale_interval, 10)));
      }))
    .orient('left');

  svg.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(' + margin.left + ',' + (margin.top + hmHeight) + ')')
    .call(xAxis)
    .selectAll('text')
    .style('text-anchor', 'end')
    .attr('transform', 'rotate(-45)');

  svg.append('g')
    .attr('class', 'y axis')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .call(yAxis);

  rect.on('mousemove', tip.show);
  rect.on('mouseout', tip.hide);

  const context = canvas.node().getContext('2d');
  context.imageSmoothingEnabled = false;

  // Compute the pixel colors; scaled by CSS.
  function createImageObj() {
    const imageObj = new Image();
    const image = context.createImageData(heatmapDim[0], heatmapDim[1]);
    const pixs = {};
    $.each(data, function (i, d) {
      const c = d3.rgb(color(d.perc));
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

module.exports = heatmapVis;
