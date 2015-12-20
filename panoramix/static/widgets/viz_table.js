px.registerViz('table', function(slice) {
  var data = slice.data;
  var form_data = data.form_data;

  function refresh() {
    var f = d3.format('.3s');
    $.getJSON(data.json_endpoint, function(json){
      var data = json.data;
      var metrics = json.form_data.metrics;
      function col(c){
        arr = [];
        for (var i=0; i<data.records.length; i++){
          arr.push(json.data.records[i][c]);
        }
        return arr;
      }
      maxes = {};
      for (var i=0; i<metrics.length; i++){
        maxes[metrics[i]] = d3.max(col(metrics[i]));
      }
      var table = d3.select(slice.selector).append('table')
        .attr('class', 'dataframe table table-striped table-bordered table-condensed table-hover');
      table.append('thead').append('tr')
       .selectAll('th')
       .data(data.columns).enter()
       .append('th')
       .text(function(d){return d});
      table.append('tbody')
       .selectAll('tr')
       .data(data.records).enter()
       .append('tr')
       .selectAll('td')
       .data(function(row, i) {
          return data.columns.map(function(c) {
            return {col: c, val: row[c], isMetric: metrics.indexOf(c) >=0};
          });
       }).enter()
       .append('td')
       .style('background-image', function(d){
          if (d.isMetric){
            var perc = Math.round((d.val / maxes[d.col]) * 100);
            return "linear-gradient(to right, lightgrey, lightgrey " + perc + "%, rgba(0,0,0,0) " + perc + "%";
          }
       })
       .attr('data-sort', function(d){
          if (d.isMetric)
            return d.val;
       })
       .on("click", function(d){
         if(!d.isMetric){
          table.selectAll('.filtered').classed('filtered', false);
          d3.select(this).classed('filtered', true);
          slice.addFilter(d.col, [d.val]);
        }
       })
       .style("cursor", function(d){
         if(!d.isMetric){
          return 'pointer';
        }
       })
       .html(function(d){
          if (d.isMetric)
            return f(d.val);
          else
            return d.val;
       });
      var datatable = slice.container.find('table').DataTable({
        paging: false,
        searching: form_data.include_search,
      });
      // Sorting table by main column
      if (form_data.metrics.length > 0) {
        var main_metric = form_data.metrics[0];
        datatable.column(data.columns.indexOf(main_metric)).order( 'desc' ).draw();
      }
      slice.done(json);
    }).fail(function(xhr){
      slice.error(xhr.responseText);
    });
  }

  return {
    render: refresh,
    resize: function(){},
  };
});
