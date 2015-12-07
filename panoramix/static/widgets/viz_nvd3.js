function viz_nvd3(data_attribute) {
  var token_name = data_attribute['token'];
  var json_callback = data_attribute['json_endpoint'];
  var chart = undefined;

  function UTC(dttm){
    return v = new Date(dttm.getUTCFullYear(), dttm.getUTCMonth(), dttm.getUTCDate(),  dttm.getUTCHours(), dttm.getUTCMinutes(), dttm.getUTCSeconds());
  }
  var tickMultiFormat = d3.time.format.multi([
    [".%L", function(d) { return d.getMilliseconds(); }],
    [":%S", function(d) { return d.getSeconds(); }],
    ["%I:%M", function(d) { return d.getMinutes(); }],
    ["%I %p", function(d) { return d.getHours(); }],
    ["%a %d", function(d) { return d.getDay() && d.getDate() != 1; }],
    ["%b %d", function(d) { return d.getDate() != 1; }],
    ["%B", function(d) { return d.getMonth(); }],
    ["%Y", function() { return true; }]
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
  var token = d3.select('#' + token_name);
  var jtoken = $('#' + token_name);
  var loading = $('#' + token_name).find("img.loading");
  var chart_div = $('#' + token_name).find("div.chart");

  var refresh = function() {
    chart_div.hide();
    loading.show();
    $.getJSON(json_callback, function(payload) {
      var data = payload.data;
      var viz = payload;
      var viz_type = viz.form_data.viz_type;
      $("#query_container").html(data.query);
      nv.addGraph(function() {
        if (viz_type === 'line') {
          if (viz.form_data.show_brush) {
            chart = nv.models.lineWithFocusChart()
          //chart.lines2.xScale( d3.time.scale.utc());
          chart.lines2.xScale(d3.time.scale.utc());
          chart.x2Axis
            .showMaxMin(viz.form_data.x_axis_showminmax)
            .tickFormat(formatDate);
          } else {
            chart = nv.models.lineChart()
          }
          // To alter the tooltip header
          // chart.interactiveLayer.tooltip.headerFormatter(function(){return '';});
          chart.xScale(d3.time.scale.utc());
          chart.useInteractiveGuideline(false);
          chart.interactiveLayer.tooltip.chartContainer(document.body);

          chart.interpolate(viz.form_data.line_interpolation);
          chart.xAxis
            .showMaxMin(viz.form_data.x_axis_showminmax)
            .tickFormat(formatDate);
          chart.showLegend(viz.form_data.show_legend);
          chart.yAxis.tickFormat(d3.format('.3s'));
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
          chart = nv.models.scatterChart();
          chart.xAxis.tickFormat(d3.format('.3s'));
          chart.yAxis.tickFormat(d3.format('.3s'));
          chart.showLegend(viz.form_data.show_legend);
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

        token.select('.chart').append("svg")
          .datum(data.chart_data)
          .transition().duration(500)
          .call(chart);

        return chart;
      });
      chart_div.show();
      loading.hide();
  }).fail(function(xhr) {
      var err = '<div class="alert alert-danger">' + xhr.responseText  + '</div>';
      loading.hide();
      chart_div.show();
      chart_div.html(err);
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
  px.registerWidget(name, viz_nvd3);
});
