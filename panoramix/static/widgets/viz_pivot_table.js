px.registerWidget('pivot_table', function(data_attribute) {
  var token_name = data_attribute['token'];
  var token = $('#' + token_name);
  var form_data = data_attribute.form_data;

  function refresh(ctrl) {
    $.getJSON(data_attribute.json_endpoint, function(json){
      token.html(json.data);
      if (form_data.groupby.length == 1){
        var table = token.find('table').DataTable({
          paging: false,
          searching: false,
        });
        table.column('-1').order( 'desc' ).draw();
      }
      token.show();
      ctrl.done(json);
    }).fail(function(xhr){
        token.show();
        ctrl.error(xhr.responseText);
    });
  }
  return {
    render: refresh,
    resize: refresh,
  };

});
