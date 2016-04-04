var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
var d3 = require('d3');

require('./table.css');
require('datatables.net-bs');
require('../node_modules/datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');

function tableVis(slice) {
  var data = slice.data;
  var form_data = data.form_data;
  var f = d3.format('.3s');
  var fC = d3.format('0,000');

  function refresh() {
    $.getJSON(slice.jsonEndpoint(), onSuccess).fail(onError);

    function onError(xhr) {
      slice.error(xhr.responseText);
    }

    function onSuccess(json) {
      var data = json.data;
      var metrics = json.form_data.metrics;

      function col(c) {
        var arr = [];
        for (var i = 0; i < data.records.length; i++) {
          arr.push(json.data.records[i][c]);
        }
        return arr;
      }
      var maxes = {};
      for (var i = 0; i < metrics.length; i++) {
        maxes[metrics[i]] = d3.max(col(metrics[i]));
      }

      var table = d3.select(slice.selector).append('table')
        .classed('dataframe dataframe table table-striped table-bordered table-condensed table-hover dataTable no-footer', true)
        .attr('width', '100%');

      table.append('thead').append('tr')
        .selectAll('th')
        .data(data.columns).enter()
        .append('th')
        .text(function (d) {
          return d;
        });

      table.append('tbody')
        .selectAll('tr')
        .data(data.records).enter()
        .append('tr')
        .selectAll('td')
        .data(function (row, i) {
          return data.columns.map(function (c) {
            return {
              col: c,
              val: row[c],
              isMetric: metrics.indexOf(c) >= 0
            };
          });
        }).enter()
        .append('td')
        .style('background-image', function (d) {
          if (d.isMetric) {
            var perc = Math.round((d.val / maxes[d.col]) * 100);
            return "linear-gradient(to right, lightgrey, lightgrey " + perc + "%, rgba(0,0,0,0) " + perc + "%";
          }
        })
        .attr('title', function (d) {
          if (!isNaN(d.val)) {
            return fC(d.val);
          }
        })
        .attr('data-sort', function (d) {
          if (d.isMetric) {
            return d.val;
          }
        })
        .on("click", function (d) {
          if (!d.isMetric) {
            var td = d3.select(this);
            if (td.classed('filtered')) {
              slice.removeFilter(d.col, [d.val]);
              d3.select(this).classed('filtered', false);
            } else {
              d3.select(this).classed('filtered', true);
              slice.addFilter(d.col, [d.val]);
            }
          }
        })
        .style("cursor", function (d) {
          if (!d.isMetric) {
            return 'pointer';
          }
        })
        .html(function (d) {
          if (d.isMetric) {
            return f(d.val);
          } else {
            return d.val;
          }
        });
      var datatable = slice.container.find('.dataTable').DataTable({
        paging: false,
        searching: form_data.include_search
      });
      // Sorting table by main column
      if (form_data.metrics.length > 0) {
        var main_metric = form_data.metrics[0];
        datatable.column(data.columns.indexOf(main_metric)).order('desc').draw();
      }
      slice.done(json);
      slice.container.parents('.widget').find('.tooltip').remove();
    }
  }

  return {
    render: refresh,
    resize: function () {}
  };
}

module.exports = tableVis;
