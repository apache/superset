px.registerWidget('table', function(data_attribute) {

  var token_name = data_attribute['token'];
  var token = $('#' + token_name);

  function refresh(ctrl) {
    $.getJSON(data_attribute.json_endpoint, function(json){
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

      var table = d3.select('#' + token_name).append('table')
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
          return data.columns.map(function(c) {return [c, row];});
       }).enter()
       .append('td')
       .style('background-image', function(d){
          var perc = Math.round((d[1][d[0]] / maxes[d[0]]) * 100);
          if (perc !== NaN)
            return "linear-gradient(to right, lightgrey, lightgrey " + perc + "%, rgba(0,0,0,0) " + perc + "%"
       })
       .html(function(d){return d[1][d[0]]});
      var datatable = token.find('table').DataTable({
        paging: false,
        searching: data_attribute.form_data.include_search,
      });
      // Sorting table by main column
      if (data_attribute.form_data.metrics.length > 0) {
        var main_metric = data_attribute.form_data.metrics[0];
        datatable.column(data.columns.indexOf(main_metric)).order( 'desc' ).draw();
      }
      ctrl.done(json);
    }).fail(function(xhr){
      ctrl.error(xhr.responseText);
    });
  }

  return {
    render: refresh,
    resize: function(){},
  };
});
