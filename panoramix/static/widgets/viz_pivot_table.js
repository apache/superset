px.registerWidget('pivot_table', function(data_attribute) {
  var token_name = data_attribute['token'];
  var token = $('#' + token_name);
  var form_data = data_attribute.form_data;

  function refresh(done) {
    token.load(data_attribute.json_endpoint, function(response, status, xhr){
      if(status=="error"){
        var err = '<div class="alert alert-danger">' + xhr.responseText  + '</div>';
        token.html(err);
        token.show();
      }
      else{
        if (form_data.groupby.length == 1){
          var table = token.find('table').DataTable({
            paging: false,
            searching: false,
          });
          table.column('-1').order( 'desc' ).draw();
        }
      }
      token.show();
      done();
    });
  }

  return {
    render: refresh,
    resize: refresh,
  };

});
