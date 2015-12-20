px.registerViz('pivot_table', function(slice) {
  container = slice.container;
  var form_data = slice.data.form_data;

  function refresh() {
    $.getJSON(slice.data.json_endpoint, function(json){
      container.html(json.data);
      if (form_data.groupby.length == 1){
        var table = container.find('table').DataTable({
          paging: false,
          searching: false,
        });
        table.column('-1').order( 'desc' ).draw();
      }
      slice.done(json);
    }).fail(function(xhr){
        slice.error(xhr.responseText);
    });
  }
  return {
    render: refresh,
    resize: refresh,
  };

});
