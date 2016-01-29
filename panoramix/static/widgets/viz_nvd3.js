function viz_nvd3(slice) {
  var chart = undefined;
  var data = {};

  var refresh = function() {
    $.getJSON(slice.jsonEndpoint(), function(payload) {
      var fd = payload.form_data;
      var viz_type = fd.viz_type;
      var f = d3.format('.3s');
      var colorKey = 'key';
      nv.addGraph(function() {
        if (viz_type === 'line') {
          if (fd.show_brush) {
            chart = nv.models.lineWithFocusChart();
            chart.lines2.xScale(d3.time.scale.utc());
            chart.x2Axis
              .showMaxMin(fd.x_axis_showminmax)
              .staggerLabels(true);
          } else {
            chart = nv.models.lineChart()
          }
          // To alter the tooltip header
          // chart.interactiveLayer.tooltip.headerFormatter(function(){return '';});
          chart.xScale(d3.time.scale.utc());
          chart.interpolate(fd.line_interpolation);
          chart.xAxis
            .showMaxMin(fd.x_axis_showminmax)
            .staggerLabels(true);
          chart.showLegend(fd.show_legend);
        } else if (viz_type === 'bar') {
          chart = nv.models.multiBarChart()
              .showControls(true)
              .groupSpacing(0.1);
          chart.xAxis
            .showMaxMin(false)
            .staggerLabels(true);
          chart.showLegend(fd.show_legend);
          chart.stacked(fd.bar_stacked);

        } else if (viz_type === 'dist_bar') {
          chart = nv.models.multiBarChart()
            .showControls(true)   //Allow user to switch between 'Grouped' and 'Stacked' mode.
            .reduceXTicks(false)
            .rotateLabels(45)
            .groupSpacing(0.1);   //Distance between each group of bars.
          chart.xAxis
            .showMaxMin(false);
          chart.stacked(fd.bar_stacked);

        } else if (viz_type === 'pie') {
          chart = nv.models.pieChart()
          colorKey = 'x';
          chart.showLegend(fd.show_legend);
          chart.valueFormat(f);
          if (fd.donut) {
            chart.donut(true);
            chart.donutLabelsOutside(true);
          }
          chart.labelsOutside(true);
          chart.cornerRadius(true);

        } else if (viz_type === 'column') {
          chart = nv.models.multiBarChart()
            .reduceXTicks(false)
            .rotateLabels(45) ;

        } else if (viz_type === 'compare') {
          chart = nv.models.cumulativeLineChart();
          chart.xScale(d3.time.scale.utc());
          chart.xAxis
            .showMaxMin(false)
            .staggerLabels(true);
          chart.showLegend(fd.show_legend);

        } else if (viz_type === 'bubble') {
          var row = function(col1, col2){
            return "<tr><td>" + col1 + "</td><td>" + col2 + "</td></r>"
          }
          chart = nv.models.scatterChart();
          chart.showDistX(true);
          chart.showDistY(true);
          chart.showLegend(fd.show_legend);
          chart.tooltip.contentGenerator(function (obj) {
            p = obj.point;
            var s = "<table>"
            s += '<tr><td style="color:' + p.color + ';"><strong>' + p[fd.entity] + '</strong> (' + p.group + ')</td></tr>';
            s += row(fd.x, f(p.x));
            s += row(fd.y, f(p.y));
            s += row(fd.size, f(p.size));
            s += "</table>";
            return s;
          });
          chart.pointRange([5, fd.max_bubble_size * fd.max_bubble_size]);

        } else if (viz_type === 'area') {
          chart = nv.models.stackedAreaChart();
          chart.style(fd.stacked_style);
          chart.xScale(d3.time.scale.utc());
          chart.xAxis
            .showMaxMin(false)
            .staggerLabels(true);
          chart.showLegend(fd.show_legend);
        }

        var height = slice.height();
        if(chart.hasOwnProperty("x2Axis")) {
          height += 30;
        }
        chart.height(height);
        slice.container.css('height', height + 'px');

        if ((viz_type === "line" || viz_type === "area") && fd.rich_tooltip) {
          chart.useInteractiveGuideline(true);
        }
        if (fd.y_axis_zero) {
          chart.forceY([0, 1]);
        }
        else if (fd.y_log_scale) {
          chart.yScale(d3.scale.log());
        }
        if (fd.x_log_scale) {
          chart.xScale(d3.scale.log());
        }
        if (viz_type === 'bubble') {
          chart.xAxis.tickFormat(d3.format('.3s'));
        }
        else if (fd.x_axis_format == 'smart_date') {
          chart.xAxis.tickFormat(px.formatDate);
        }
        else if (fd.x_axis_format !== undefined) {
          chart.xAxis.tickFormat(px.timeFormatFactory(fd.x_axis_format));
        }
        if (chart.yAxis !== undefined)
          chart.yAxis.tickFormat(d3.format('.3s'));
        if (fd.contribution || fd.num_period_compare || viz_type == 'compare') {
          chart.yAxis.tickFormat(d3.format('.3p'));
          if (chart.y2Axis != undefined) {
              chart.y2Axis.tickFormat(d3.format('.3p'));
          }
        }
        else if (fd.y_axis_format) {
          chart.yAxis.tickFormat(d3.format(fd.y_axis_format));

          if (chart.y2Axis != undefined) {
            chart.y2Axis.tickFormat(d3.format(fd.y_axis_format));
          }
        }

        chart.color(function(d, i){
          return px.color.category21(d[colorKey]);
        });
        d3.select(slice.selector).append("svg")
          .datum(payload.data)
          .transition().duration(500)
          .attr('height', height)
          .call(chart);

        return chart;
      });
      slice.done(payload);
  })
  .fail(function(xhr) {
      slice.error(xhr.responseText);
    });
  };
  var resize = function() {
    chart.update();
  }

  return {
    render: refresh,
    resize: resize,
  };

}

[
  'area',
  'bar',
  'bubble',
  'column',
  'compare',
  'dist_bar',
  'line',
  'pie',
].forEach(function(name) {
  px.registerViz(name, viz_nvd3);
});
