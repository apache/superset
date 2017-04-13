/* eslint-disable prefer-rest-params, no-param-reassign */
// Copied and modified from
// https://github.com/kmandov/d3-horizon-chart
import d3 from 'd3';
import './horizon.css';

const horizonChart = function () {
  let colors = [
    '#313695',
    '#4575b4',
    '#74add1',
    '#abd9e9',
    '#fee090',
    '#fdae61',
    '#f46d43',
    '#d73027',
  ];
  let height = 30;
  const y = d3.scale.linear().range([0, height]);
  let bands = colors.length >> 1;  // number of bands in each direction (positive / negative)
  let width = 1000;
  let offsetX = 0;
  let spacing = 0;
  let mode = 'offset';
  let axis;
  let title;
  let extent; // the extent is derived from the data, unless explicitly set via .extent([min, max])
  let x;
  let canvas;

  function my(data) {
    const horizon = d3.select(this);
    const step = width / data.length;

    horizon.append('span')
    .attr('class', 'title')
    .text(title);

    horizon.append('span')
    .attr('class', 'value');

    canvas = horizon.append('canvas');

    canvas
    .attr('width', width)
    .attr('height', height);

    const context = canvas.node().getContext('2d');
    context.imageSmoothingEnabled = false;

    // update the y scale, based on the data extents
    const ext = extent || d3.extent(data, d => d.y);

    const max = Math.max(-ext[0], ext[1]);
    y.domain([0, max]);

    // x = d3.scaleTime().domain[];
    axis = d3.svg.axis(x).ticks(5);

    context.clearRect(0, 0, width, height);
    // context.translate(0.5, 0.5);

    // the data frame currently being shown:
    const startIndex = Math.floor(Math.max(0, -(offsetX / step)));
    const endIndex = Math.floor(Math.min(data.length, startIndex + (width / step)));

    // skip drawing if there's no data to be drawn
    if (startIndex > data.length) {
      return;
    }

    // we are drawing positive & negative bands separately to avoid mutating canvas state
    // http://www.html5rocks.com/en/tutorials/canvas/performance/
    let negative = false;
    // draw positive bands
    let value;
    let bExtents;
    for (let b = 0; b < bands; b += 1) {
      context.fillStyle = colors[bands + b];

      // Adjust the range based on the current band index.
      bExtents = (b + 1 - bands) * height;
      y.range([bands * height + bExtents, bExtents]);

      // only the current data frame is being drawn i.e. what's visible:
      for (let i = startIndex; i < endIndex; i++) {
        value = data[i].y;
        if (value <= 0) { negative = true; continue; }
        if (value === undefined) {
          continue;
        }
        context.fillRect(offsetX + i * step, y(value), step + 1, y(0) - y(value));
      }
    }

    // draw negative bands
    if (negative) {
      // mirror the negative bands, by flipping the canvas
      if (mode === 'offset') {
        context.translate(0, height);
        context.scale(1, -1);
      }

      for (let b = 0; b < bands; b++) {
        context.fillStyle = colors[bands - b - 1];

        // Adjust the range based on the current band index.
        bExtents = (b + 1 - bands) * height;
        y.range([bands * height + bExtents, bExtents]);

        // only the current data frame is being drawn i.e. what's visible:
        for (let ii = startIndex; ii < endIndex; ii++) {
          value = data[ii].y;
          if (value >= 0) {
            continue;
          }
          context.fillRect(offsetX + ii * step, y(-value), step + 1, y(0) - y(-value));
        }
      }
    }
  }

  my.axis = function (_) {
    if (!arguments.length) { return axis; }
    axis = _;
    return my;
  };

  my.title = function (_) {
    if (!arguments.length) { return title; }
    title = _;
    return my;
  };

  my.canvas = function (_) {
    if (!arguments.length) { return canvas; }
    canvas = _;
    return my;
  };

  // Array of colors representing the number of bands
  my.colors = function (_) {
    if (!arguments.length) {
      return colors;
    }
    colors = _;

    // update the number of bands
    bands = colors.length >> 1;
    return my;
  };

  my.height = function (_) {
    if (!arguments.length) { return height; }
    height = _;
    return my;
  };

  my.width = function (_) {
    if (!arguments.length) { return width; }
    width = _;
    return my;
  };

  my.spacing = function (_) {
    if (!arguments.length) { return spacing; }
    spacing = _;
    return my;
  };

  // mirror or offset
  my.mode = function (_) {
    if (!arguments.length) { return mode; }
    mode = _;
    return my;
  };

  my.extent = function (_) {
    if (!arguments.length) { return extent; }
    extent = _;
    return my;
  };

  my.offsetX = function (_) {
    if (!arguments.length) { return offsetX; }
    offsetX = _;
    return my;
  };

  return my;
};

function horizonViz(slice, payload) {
  const fd = slice.formData;
  const div = d3.select(slice.selector);
  div.selectAll('*').remove();
  let extent;
  if (fd.horizon_color_scale === 'overall') {
    let allValues = [];
    payload.data.forEach(function (d) {
      allValues = allValues.concat(d.values);
    });
    extent = d3.extent(allValues, d => d.y);
  } else if (fd.horizon_color_scale === 'change') {
    payload.data.forEach(function (series) {
      const t0y = series.values[0].y;  // value at time 0
      series.values = series.values.map(d =>
        Object.assign({}, d, { y: d.y - t0y }),
      );
    });
  }
  div.selectAll('.horizon')
  .data(payload.data)
  .enter()
  .append('div')
  .attr('class', 'horizon')
  .each(function (d, i) {
    horizonChart()
    .height(fd.series_height)
    .width(slice.width())
    .extent(extent)
    .title(d.key)
    .call(this, d.values, i);
  });
}

module.exports = horizonViz;
