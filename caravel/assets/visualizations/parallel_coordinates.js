// JS
var $  = window.$ || require('jquery');
var d3 = window.d3 || require('d3');
d3.parcoords = require('../vendor/parallel_coordinates/d3.parcoords.js');
d3.divgrid = require('../vendor/parallel_coordinates/divgrid.js');

// CSS
require('../vendor/parallel_coordinates/d3.parcoords.css');
require('./parallel_coordinates.css');

function parallelCoordVis(slice) {

  function refresh() {
    $('#code').attr('rows', '15');
    $.getJSON(slice.jsonEndpoint(), function (payload) {
        var fd = payload.form_data;
        var data = payload.data;

        var cols = fd.metrics;
        if (fd.include_series) {
          cols = [fd.series].concat(fd.metrics);
        }

        var ttypes = {};
        ttypes[fd.series] = 'string';
        fd.metrics.forEach(function (v) {
          ttypes[v] = 'number';
        });

        var ext = d3.extent(data, function (d) {
          return d[fd.secondary_metric];
        });
        ext = [ext[0], (ext[1] - ext[0]) / 2, ext[1]];
        var cScale = d3.scale.linear()
          .domain(ext)
          .range(['red', 'grey', 'blue'])
          .interpolate(d3.interpolateLab);

        var color = function (d) {
          return cScale(d[fd.secondary_metric]);
        };
        var container = d3.select(slice.selector);
        container.selectAll('*').remove();
        var eff_height = fd.show_datatable ? (slice.height() / 2) : slice.height();

        container.append('div')
          .attr('id', 'parcoords_' + slice.container_id)
          .style('height', eff_height + 'px')
          .classed("parcoords", true);

        var parcoords = d3.parcoords()('#parcoords_' + slice.container_id)
          .width(slice.width())
          .color(color)
          .alpha(0.5)
          .composite("darken")
          .height(eff_height)
          .data(data)
          .dimensions(cols)
          .types(ttypes)
          .render()
          .createAxes()
          .shadows()
          .reorderable()
          .brushMode("1D-axes");

        if (fd.show_datatable) {
          // create data table, row hover highlighting
          var grid = d3.divgrid();
          container.append("div")
            .style('height', eff_height + 'px')
            .datum(data)
            .call(grid)
            .classed("parcoords grid", true)
            .selectAll(".row")
            .on({
              mouseover: function (d) {
                parcoords.highlight([d]);
              },
              mouseout: parcoords.unhighlight
            });
          // update data table on brush event
          parcoords.on("brush", function (d) {
            d3.select(".grid")
              .datum(d)
              .call(grid)
              .selectAll(".row")
              .on({
                mouseover: function (d) {
                  parcoords.highlight([d]);
                },
                mouseout: parcoords.unhighlight
              });
          });
        }
        slice.done(payload);
      })
      .fail(function (xhr) {
        slice.error(xhr.responseText);
      });
  }

  return {
    render: refresh,
    resize: refresh
  };
}

module.exports = parallelCoordVis;
