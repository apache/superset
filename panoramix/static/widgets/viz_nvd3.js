function viz_nvd3(slice) {
  var chart = undefined;
  var data = {};

  function UTC(dttm){
    return v = new Date(dttm.getUTCFullYear(), dttm.getUTCMonth(), dttm.getUTCDate(),  dttm.getUTCHours(), dttm.getUTCMinutes(), dttm.getUTCSeconds());
  }
  var tickMultiFormat = d3.time.format.multi([
    [".%L", function(d) { return d.getMilliseconds(); }], // If there are millisections, show  only them
    [":%S", function(d) { return d.getSeconds(); }], // If there are seconds, show only them
    ["%a %b %d, %I:%M %p", function(d) { return d.getMinutes()!=0; }], // If there are non-zero minutes, show Date, Hour:Minute [AM/PM]
    ["%a %b %d, %I %p", function(d) { return d.getHours() != 0; }], // If there are hours that are multiples of 3, show date and AM/PM
    ["%a %b %d, %Y", function(d) { return d.getDate() != 1; }], // If not the first of the month, do "month day, year."
    ["%B %Y", function(d) { return d.getMonth() != 0 && d.getDate() == 1; }], // If the first of the month, do "month day, year."
    ["%Y", function(d) { return true; }] // fall back on month, year
  ]);
  function formatDate(dttm) {
    var d = UTC(new Date(dttm));
    //d = new Date(d.getTime() - 1 * 60 * 60 * 1000);
    return tickMultiFormat(d);
  }
  colors = [
    "#FF5A5F", "#007A87", "#7B0051", "#00D1C1", "#8CE071", "#FFB400",
    "#FFAA91", "#B4A76C", "#9CA299", "#565A5C"
  ];
  var refresh = function() {
    $.getJSON(slice.jsonEndpoint(), function(payload) {
      var fd = payload.form_data;
      var viz_type = fd.viz_type;
      var f = d3.format('.4s');
      nv.addGraph(function() {
        if (viz_type === 'line') {
          if (fd.show_brush) {
            chart = nv.models.lineWithFocusChart();
            //chart.lines2.xScale( d3.time.scale.utc());
            chart.lines2.xScale(d3.time.scale.utc());
            chart.x2Axis
              .showMaxMin(fd.x_axis_showminmax)
              .tickFormat(formatDate)
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
            .tickFormat(formatDate)
            .staggerLabels(true);
          chart.showLegend(fd.show_legend);
          chart.yAxis.tickFormat(d3.format('.3s'));
          if (chart.y2Axis != undefined) {
              chart.y2Axis.tickFormat(d3.format('.3s'));
          }
          if (fd.contribution || fd.num_period_compare) {
            chart.yAxis.tickFormat(d3.format('.3p'));
            if (chart.y2Axis != undefined) {
                chart.y2Axis.tickFormat(d3.format('.3p'));
            }
          }
        } else if (viz_type === 'bar') {
          chart = nv.models.multiBarChart()
              .showControls(true)
              .groupSpacing(0.1);
          chart.xAxis
            .showMaxMin(false)
            .tickFormat(formatDate)
            .staggerLabels(true);
          chart.showLegend(fd.show_legend);
          chart.yAxis.tickFormat(d3.format('.3s'));

        } else if (viz_type === 'dist_bar') {
          chart = nv.models.multiBarChart()
            .showControls(true)   //Allow user to switch between 'Grouped' and 'Stacked' mode.
            .reduceXTicks(false)
            .rotateLabels(45)
            .groupSpacing(0.1);   //Distance between each group of bars.
          chart.xAxis
            .showMaxMin(false);
          chart.yAxis.tickFormat(d3.format('.3s'));

        } else if (viz_type === 'pie') {
          chart = nv.models.pieChart()
          chart.showLegend(fd.show_legend);
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
          chart.yAxis.tickFormat(d3.format('.3s'));

        } else if (viz_type === 'compare') {
          chart = nv.models.cumulativeLineChart();
          chart.xScale(d3.time.scale.utc());
          chart.xAxis
            .showMaxMin(false)
            .tickFormat(formatDate)
            .staggerLabels(true);
          chart.showLegend(fd.show_legend);
          chart.yAxis.tickFormat(d3.format('.3p'));

        } else if (viz_type === 'bubble') {
          var row = function(col1, col2){
            return "<tr><td>" + col1 + "</td><td>" + col2 + "</td></r>"
          }
          chart = nv.models.scatterChart();
          chart.showDistX(true);
          chart.showDistY(true);
          chart.xAxis.tickFormat(d3.format('.3s'));
          chart.yAxis.tickFormat(d3.format('.3s'));
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
          chart.xScale(d3.time.scale.utc());
          chart.xAxis
            .showMaxMin(false)
            .tickFormat(formatDate)
            .staggerLabels(true);
          chart.showLegend(fd.show_legend);
          chart.yAxis.tickFormat(d3.format('.3s'));
        }

        // make space for labels on right
        //chart.height($(".chart").height() - 50).margin({"right": 50});
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
        if (fd.y_axis_format) {
          chart.yAxis.tickFormat(d3.format(fd.y_axis_format));

          if (chart.y2Axis != undefined) {
            chart.y2Axis.tickFormat(d3.format(fd.y_axis_format));
          }
        }

        chart.duration(0);
        d3.select(slice.selector).append("svg")
          .datum(payload.data)
          .transition().duration(500)
          .call(chart);

        // if it is a two axis chart, rescale it down just a little so it fits in the div.
        if(chart.hasOwnProperty("x2Axis")) {
          two_axis_chart = $(slice.selector + " > svg");
          w = two_axis_chart.width();
          h = two_axis_chart.height();
          two_axis_chart.get(0).setAttribute('viewBox', '0 0 '+w+' '+(h+30));
        }
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
