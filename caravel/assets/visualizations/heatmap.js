// JS
var $ = window.$ || require('jquery');
var px = window.px || require('../javascripts/modules/caravel.js');
var d3 = require('d3');

d3.tip = require('d3-tip'); //using window.d3 doesn't capture events properly bc of multiple instances

// CSS
require('./heatmap.css');

// Inspired from http://bl.ocks.org/mbostock/3074470
// https://jsfiddle.net/cyril123/h0reyumq/
function heatmapVis(slice) {
  var margins = {
    t: 10,
    r: 10,
    b: 50,
    l: 60
  };

  function refresh() {
    var width = slice.width();
    var height = slice.height();
    var hmWidth = width - (margins.l + margins.r);
    var hmHeight = height - (margins.b + margins.t);
    var fp = d3.format('.3p');
    d3.json(slice.jsonEndpoint(), function (error, payload) {
      var matrix = {};
      if (error) {
        slice.error(error.responseText);
        return '';
      }
      var fd = payload.form_data;
      var data = payload.data;

      function ordScale(k, rangeBands, reverse) {
        if (reverse === undefined) {
          reverse = false;
        }
        var domain = {};
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
        } else {
          return d3.scale.ordinal().domain(domain).rangeBands(rangeBands);
        }
      }
      var xScale = ordScale('x');
      var yScale = ordScale('y', undefined, true);
      var xRbScale = ordScale('x', [0, hmWidth]);
      var yRbScale = ordScale('y', [hmHeight, 0]);
      var X = 0,
        Y = 1;
      var heatmapDim = [xRbScale.domain().length, yRbScale.domain().length];

      var color = px.color.colorScalerFactory(fd.linear_color_scheme);

      var scale = [
        d3.scale.linear()
        .domain([0, heatmapDim[X]])
        .range([0, hmWidth]),
        d3.scale.linear()
        .domain([0, heatmapDim[Y]])
        .range([0, hmHeight])
      ];

      var container = d3.select(slice.selector)
        .style("left", "0px")
        .style("position", "relative")
        .style("top", "0px");

      var canvas = container.append("canvas")
        .attr("width", heatmapDim[X])
        .attr("height", heatmapDim[Y])
        .style("width", hmWidth + "px")
        .style("height", hmHeight + "px")
        .style("image-rendering", fd.canvas_image_rendering)
        .style("left", margins.l + "px")
        .style("top", margins.t + "px")
        .style("position", "absolute");

      var svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("left", "0px")
        .style("top", "0px")
        .style("position", "absolute");

      var rect = svg.append('g')
        .attr("transform", "translate(" + margins.l + "," + margins.t + ")")
        .append('rect')
        .style('fill-opacity', 0)
        .attr('stroke', 'black')
        .attr("width", hmWidth)
        .attr("height", hmHeight);

      var tip = d3.tip()
        .attr('class', 'd3-tip')
        .offset(function () {
          var k = d3.mouse(this);
          var x = k[0] - (hmWidth / 2);
          return [k[1] - 20, x];
        })
        .html(function (d) {
          var k = d3.mouse(this);
          var m = Math.floor(scale[0].invert(k[0]));
          var n = Math.floor(scale[1].invert(k[1]));
          if (m in matrix && n in matrix[m]) {
            var obj = matrix[m][n];
            var s = "";
            s += "<div><b>" + fd.all_columns_x + ": </b>" + obj.x + "<div>";
            s += "<div><b>" + fd.all_columns_y + ": </b>" + obj.y + "<div>";
            s += "<div><b>" + fd.metric + ": </b>" + obj.v + "<div>";
            s += "<div><b>%: </b>" + fp(obj.perc) + "<div>";
            return s;
          }
        });

      rect.call(tip);

      var xAxis = d3.svg.axis()
        .scale(xRbScale)
        .tickValues(xRbScale.domain().filter(
          function (d, i) {
            return !(i % (parseInt(fd.xscale_interval, 10)));
          }))
        .orient("bottom");
      var yAxis = d3.svg.axis()
        .scale(yRbScale)
        .tickValues(yRbScale.domain().filter(
          function (d, i) {
            return !(i % (parseInt(fd.yscale_interval, 10)));
          }))
        .orient("left");

      svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(" + margins.l + "," + (margins.t + hmHeight) + ")")
        .call(xAxis)
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("transform", "rotate(-45)")
        .style("font-weight", "bold");

      svg.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate(" + margins.l + ", 0)")
        .call(yAxis);

      rect.on('mousemove', tip.show);
      rect.on('mouseout', tip.hide);

      var context = canvas.node().getContext("2d");
      context.imageSmoothingEnabled = false;
      createImageObj();

      // Compute the pixel colors; scaled by CSS.
      function createImageObj() {
        var imageObj = new Image();
        var image = context.createImageData(heatmapDim[0], heatmapDim[1]);
        var pixs = {};
        $.each(data, function (i, d) {
          var c = d3.rgb(color(d.perc));
          var x = xScale(d.x);
          var y = yScale(d.y);
          pixs[x + (y * xScale.domain().length)] = c;
          if (matrix[x] === undefined) {
            matrix[x] = {};
          }
          if (matrix[x][y] === undefined) {
            matrix[x][y] = d;
          }
        });

        var p = -1;
        for (var i = 0; i < heatmapDim[0] * heatmapDim[1]; i++) {
          var c = pixs[i];
          var alpha = 255;
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
      slice.done();

    });
  }
  return {
    render: refresh,
    resize: refresh
  };
}

module.exports = heatmapVis;
