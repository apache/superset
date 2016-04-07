// JS
var d3 = window.d3 || require('d3');

// CSS
require('./big_number.css');

var px = require('../javascripts/modules/caravel.js');

function bigNumberVis(slice) {
  var div = d3.select(slice.selector);

  function render() {
    d3.json(slice.jsonEndpoint(), function (error, payload) {
      //Define the percentage bounds that define color from red to green
      if (error !== null) {
        slice.error(error.responseText);
        return '';
      }
      var fd = payload.form_data;
      var json = payload.data;
      var color_range = [-1, 1];

      var f = d3.format(fd.y_axis_format);
      var fp = d3.format('+.1%');
      var width = slice.width();
      var height = slice.height();
      div.selectAll("*").remove();
      var svg = div.append('svg');
      svg.attr("width", width);
      svg.attr("height", height);
      var data = json.data;
      var compare_suffix = ' ' + json.compare_suffix;
      var v_compare = null;
      var v = null;
      if (data.length > 1) {
          v = data[data.length - 1][1];
      } else {
          v = data[data.length - 1][0];
      }
      if (json.compare_lag > 0) {
        var pos = data.length - (json.compare_lag + 1);
        if (pos >= 0) {
          v_compare = (v / data[pos][1]) - 1;
        }
      }
      var date_ext = d3.extent(data, function (d) {
        return d[0];
      });
      var value_ext = d3.extent(data, function (d) {
        return d[1];
      });

      var margin = 20;
      var scale_x = d3.time.scale.utc().domain(date_ext).range([margin, width - margin]);
      var scale_y = d3.scale.linear().domain(value_ext).range([height - (margin), margin]);
      var colorRange = [d3.hsl(0, 1, 0.3), d3.hsl(120, 1, 0.3)];
      var scale_color = d3.scale
        .linear().domain(color_range)
        .interpolate(d3.interpolateHsl)
        .range(colorRange).clamp(true);
      var line = d3.svg.line()
        .x(function (d) {
          return scale_x(d[0]);
        })
        .y(function (d) {
          return scale_y(d[1]);
        })
        .interpolate("basis");

      //Drawing trend line
      var g = svg.append('g');

      g.append('path')
        .attr('d', function (d) {
          return line(data);
        })
        .attr('stroke-width', 5)
        .attr('opacity', 0.5)
        .attr('fill', "none")
        .attr('stroke-linecap', "round")
        .attr('stroke', "grey");

      g = svg.append('g')
        .attr('class', 'digits')
        .attr('opacity', 1);

      var y = height / 2;
      if (v_compare !== null) {
        y = (height / 8) * 3;
      }

      //Printing big number
      g.append('text')
        .attr('x', width / 2)
        .attr('y', y)
        .attr('class', 'big')
        .attr('alignment-baseline', 'middle')
        .attr('id', 'bigNumber')
        .style('font-weight', 'bold')
        .style('cursor', 'pointer')
        .text(f(v))
        .style('font-size', d3.min([height, width]) / 3.5)
        .attr('fill', 'white');

      //Printing big number subheader text
      if (json.subheader !== null) {
        g.append('text')
          .attr('x', width / 2)
          .attr('y', y + d3.min([height, width]) / 4.5)
          .text(json.subheader)
          .attr('id', 'subheader_text')
          .style('font-size', d3.min([height, width]) / 16)
          .style('text-anchor', 'middle')
          .attr('fill', c)
          .attr('stroke', c);
      }

      var c = scale_color(v_compare);

      //Printing compare %
      if (v_compare !== null) {
        g.append('text')
          .attr('x', width / 2)
          .attr('y', (height / 16) * 12)
          .text(fp(v_compare) + compare_suffix)
          .style('font-size', d3.min([height, width]) / 8)
          .style('text-anchor', 'middle')
          .attr('fill', c)
          .attr('stroke', c);
      }

      var g_axis = svg.append('g').attr('class', 'axis').attr('opacity', 0);
      g = g_axis.append('g');
      var x_axis = d3.svg.axis()
        .scale(scale_x)
        .orient('bottom')
        .ticks(4)
        .tickFormat(px.formatDate);
      g.call(x_axis);
      g.attr('transform', 'translate(0,' + (height - margin) + ')');

      g = g_axis.append('g').attr('transform', 'translate(' + (width - margin) + ',0)');
      var y_axis = d3.svg.axis()
        .scale(scale_y)
        .orient('left')
        .tickFormat(d3.format(fd.y_axis_format))
        .tickValues(value_ext);
      g.call(y_axis);
      g.selectAll('text')
        .style('text-anchor', 'end')
        .attr('y', '-7')
        .attr('x', '-4');

      g.selectAll("text")
        .style('font-size', '10px');

      div.on('mouseover', function (d) {
          var div = d3.select(this);
          div.select('path').transition().duration(500).attr('opacity', 1)
            .style('stroke-width', '2px');
          div.select('g.digits').transition().duration(500).attr('opacity', 0.1);
          div.select('g.axis').transition().duration(500).attr('opacity', 1);
        })
        .on('mouseout', function (d) {
          var div = d3.select(this);
          div.select('path').transition().duration(500).attr('opacity', 0.5)
            .style('stroke-width', '5px');
          div.select('g.digits').transition().duration(500).attr('opacity', 1);
          div.select('g.axis').transition().duration(500).attr('opacity', 0);
        });
      slice.done(payload);
    });
  }

  return {
    render: render,
    resize: render
  };
}

module.exports = bigNumberVis;
