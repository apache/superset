px.registerViz('pivot_table', function(slice) {
  var token_name = slice.data['token'];
  var token = $('#' + token_name);
  var form_data = slice.data.form_data;

  function refresh() {
    $.getJSON(slice.data.json_endpoint, function(json){
      token.html(json.data);
      if (form_data.groupby.length == 1){
        var table = token.find('table').DataTable({
          paging: false,
          searching: false,
        });
        table.column('-1').order( 'desc' ).draw();
      }
      token.show();
      slice.done(json);
    }).fail(function(xhr){
        token.show();
        slice.error(xhr.responseText);
    });
  }
  return {
    render: refresh,
    resize: refresh,
  };

});
