px.registerViz('helloworld', function(slice) {

  function refresh() {
      $('#code').attr('rows', '15')
      $.getJSON(slice.jsonEndpoint(), function(payload) {
        slice.container.html(
          '<h1>HELLOW '+ payload.form_data.username +' !!!</h1>');
        console.log(payload);
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
