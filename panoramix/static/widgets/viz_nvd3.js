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
      var data = payload.data;
      var viz = payload;
      var viz_type = viz.form_data.viz_type;
      var fd = viz.form_data;
      var f = d3.format('.4s');
      nv.addGraph(function() {
        if (viz_type === 'line') {
          if (viz.form_data.show_brush) {
            chart = nv.models.lineWithFocusChart()
          //chart.lines2.xScale( d3.time.scale.utc());
          chart.lines2.xScale(d3.time.scale.utc());
          chart.x2Axis
            .showMaxMin(viz.form_data.x_axis_showminmax)
            .tickFormat(formatDate)
            .staggerLabels(true);
          } else {
            chart = nv.models.lineChart()
          }
          // To alter the tooltip header
          // chart.interactiveLayer.tooltip.headerFormatter(function(){return '';});
          chart.xScale(d3.time.scale.utc());
          chart.interpolate(viz.form_data.line_interpolation);
          chart.xAxis
            .showMaxMin(viz.form_data.x_axis_showminmax)
            .tickFormat(formatDate)
            .staggerLabels(true);
          chart.showLegend(viz.form_data.show_legend);
          chart.yAxis.tickFormat(d3.format('.3s'));
          if (chart.y2Axis != undefined) {
              chart.y2Axis.tickFormat(d3.format('.3s'));
          }
          if (viz.form_data.contribution || viz.form_data.num_period_compare) {
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
            .tickFormat(formatDate);
          chart.showLegend(viz.form_data.show_legend);
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
          chart.showLegend(viz.form_data.show_legend);
          if (viz.form_data.donut) {
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
            .tickFormat(formatDate);
          chart.showLegend(viz.form_data.show_legend);
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
          chart.pointRange([5, 5000]);

        } else if (viz_type === 'area') {
          chart = nv.models.stackedAreaChart();
          chart.xScale(d3.time.scale.utc());
          chart.xAxis
            .showMaxMin(false)
            .tickFormat(formatDate);
          chart.showLegend(viz.form_data.show_legend);
          chart.yAxis.tickFormat(d3.format('.3s'));
        }

        // make space for labels on right
        //chart.height($(".chart").height() - 50).margin({"right": 50});
        if ((viz_type === "line" || viz_type === "area") && viz.form_data.rich_tooltip) {
          chart.useInteractiveGuideline(true);
        }
        if (viz.form_data.y_axis_zero) {
          chart.forceY([0, 1]);
        }
        else if (viz.form_data.y_log_scale) {
          chart.yScale(d3.scale.log());
        }
        if (viz.form_data.x_log_scale) {
          chart.xScale(d3.scale.log());
        }
        if (viz.form_data.y_axis_format) {
          chart.yAxis.tickFormat(d3.format(viz.form_data.y_axis_format));

          if (chart.y2Axis != undefined) {
            chart.y2Axis.tickFormat(d3.format(viz.form_data.y_axis_format));
          }
        }

        chart.duration(0);

        d3.select(slice.selector).append("svg")
          .datum(data.chart_data)
          .transition().duration(500)
          .call(chart);

        return chart;
      });
      slice.done(data);
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
