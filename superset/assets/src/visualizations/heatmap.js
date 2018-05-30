import d3 from 'd3';
// eslint-disable-next-line no-unused-vars
import d3legend from 'd3-svg-legend';
import d3tip from 'd3-tip';

import { colorScalerFactory } from '../modules/colors';
import '../../stylesheets/d3tip.css';
import './heatmap.css';

function cmp(a, b) {
  return a > b ? 1 : -1;
}

// Inspired from http://bl.ocks.org/mbostock/3074470
// https://jsfiddle.net/cyril123/h0reyumq/
function heatmapVis(slice, payload) {
  const data = payload.data.records;
  const fd = slice.formData;

  const margin = {
    top: 10,
    right: 10,
    bottom: 35,
    left: 35,
  };
  const valueFormatter = d3.format(fd.y_axis_format);

  // Dynamically adjusts  based on max x / y category lengths
  function adjustMargins() {
    const pixelsPerCharX = 4.5; // approx, depends on font size
    const pixelsPerCharY = 6; // approx, depends on font size
    let longestX = 1;
    let longestY = 1;
    let datum;

    for (let i = 0; i < data.length; i++) {
      datum = data[i];
      longestX = Math.max(longestX, datum.x.toString().length || 1);
      longestY = Math.max(longestY, datum.y.toString().length || 1);
    }

    if (fd.left_margin === 'auto') {
      margin.left = Math.ceil(Math.max(margin.left, pixelsPerCharY * longestY));
      if (fd.show_legend) {
        margin.left += 40;
      }
    } else {
      margin.left = fd.left_margin;
    }
    if (fd.bottom_margin === 'auto') {
      margin.bottom = Math.ceil(Math.max(margin.bottom, pixelsPerCharX * longestX));
    } else {
      margin.bottom = fd.bottom_margin;
    }
  }

  function ordScale(k, rangeBands, sortMethod) {
    let domain = {};
    const actualKeys = {};  // hack to preserve type of keys when number
    data.forEach((d) => {
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

  slice.container.html('');
  const matrix = {};

  adjustMargins();

  const width = slice.width();
  const height = slice.height();
  const hmWidth = width - (margin.left + margin.right);
  const hmHeight = height - (margin.bottom + margin.top);
  const fp = d3.format('.2%');

  const xScale = ordScale('x', null, fd.sort_x_axis);
  const yScale = ordScale('y', null, fd.sort_y_axis);
  const xRbScale = ordScale('x', [0, hmWidth], fd.sort_x_axis);
  const yRbScale = ordScale('y', [hmHeight, 0], fd.sort_y_axis);
  const X = 0;
  const Y = 1;
  const heatmapDim = [xRbScale.domain().length, yRbScale.domain().length];

  const minBound = fd.y_axis_bounds[0] || 0;
  const maxBound = fd.y_axis_bounds[1] || 1;
  const colorScaler = colorScalerFactory(fd.linear_color_scheme, null, null, [minBound, maxBound]);

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
    .style('top', margin.top + 'px')
    .style('position', 'absolute');

  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('position', 'relative');

  if (fd.show_values) {
    const cells = svg.selectAll('rect')
      .data(data)
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
      .attr('fill', d => d.v >= payload.data.extents[1] / 2 ? 'white' : 'black');
  }

  if (fd.show_legend) {
    const colorLegend = d3.legend.color()
    .labelFormat(valueFormatter)
    .scale(colorScaler)
    .shapePadding(0)
    .cells(50)
    .shapeWidth(10)
    .shapeHeight(3)
    .labelOffset(2);

    svg.append('g')
    .attr('transform', 'translate(10, 5)')
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
      if (m in matrix && n in matrix[m]) {
        const obj = matrix[m][n];
        s += '<div><b>' + fd.all_columns_x + ': </b>' + obj.x + '<div>';
        s += '<div><b>' + fd.all_columns_y + ': </b>' + obj.y + '<div>';
        s += '<div><b>' + fd.metric + ': </b>' + valueFormatter(obj.v) + '<div>';
        if (fd.show_perc) {
          s += '<div><b>%: </b>' + fp(fd.normalized ? obj.rank : obj.perc) + '<div>';
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
    .attr('pointer-events', 'all')
    .on('mousemove', tip.show)
    .on('mouseout', tip.hide)
    .style('fill-opacity', 0)
    .attr('stroke', 'black')
    .attr('width', hmWidth)
    .attr('height', hmHeight);

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


  const context = canvas.node().getContext('2d');
  context.imageSmoothingEnabled = false;

  // Compute the pixel colors; scaled by CSS.
  function createImageObj() {
    const imageObj = new Image();
    const image = context.createImageData(heatmapDim[0], heatmapDim[1]);
    const pixs = {};
    data.forEach((d) => {
      const c = d3.rgb(colorScaler(fd.normalized ? d.rank : d.perc));
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
