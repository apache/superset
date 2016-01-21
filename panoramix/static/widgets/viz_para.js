px.registerViz('para', function(slice) {

  function refresh() {
      $('#code').attr('rows', '15')
      $.getJSON(slice.jsonEndpoint(), function(payload) {
        var data = payload.data;
        var fd = payload.form_data;
        ext = d3.extent(data, function(d){
          return d[fd.secondary_metric];
        });
        ext = [ext[0], (ext[1]-ext[0])/2,ext[1]];
        var cScale = d3.scale.linear()
          .domain(ext)
          .range(['red', 'grey', 'blue'])
          .interpolate(d3.interpolateLab);
        var color = function(d){return cScale(d[fd.secondary_metric])};
        var container = d3.select(slice.selector);
        if (fd.show_datatable)
          var eff_height = slice.height() / 2;
        else
          var eff_height = slice.height();

        var div = container.append('div')
          .attr('id', 'parcoords_' + slice.container_id)
          .style('height', eff_height + 'px')
          .classed("parcoords", true);
        var parcoords = d3.parcoords()('#parcoords_' + slice.container_id)
          .width(slice.width())
          .color(color)
          .alpha(0.5)
          .composite("darken")
          .height(eff_height)
          .data(payload.data)
          .render()
          .createAxes()
          .shadows()
          .reorderable()
          .brushMode("1D-axes");

        if (fd.show_datatable) {
          // create data table, row hover highlighting
          var grid = d3.divgrid();
          container.append("div")
            .datum(data.slice(0,10))
            .attr('id', "grid")
            .call(grid)
            .classed("parcoords", true)
            .selectAll(".row")
            .on({
              "mouseover": function(d) { parcoords.highlight([d]) },
              "mouseout": parcoords.unhighlight
            });
          // update data table on brush event
          parcoords.on("brush", function(d) {
            d3.select("#grid")
              .datum(d.slice(0,10))
              .call(grid)
              .selectAll(".row")
              .on({
                "mouseover": function(d) { parcoords.highlight([d]) },
                "mouseout": parcoords.unhighlight
              });
          });
        }
        slice.done();
      })
      .fail(function(xhr) {
          slice.error(xhr.responseText);
        });
      };
  return {
    render: refresh,
    resize: refresh,
  };
});
