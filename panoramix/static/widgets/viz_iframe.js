px.registerViz('iframe', function(slice) {

  function refresh() {
      $('#code').attr('rows', '15')
      $.getJSON(slice.jsonEndpoint(), function(payload) {
        slice.container.html(
          '<iframe style="width:100%;"></iframe>');
        console.log(slice);
        iframe = slice.container.find('iframe');
        iframe.css('height', slice.height());
        iframe.attr('src', payload.form_data.url);
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
