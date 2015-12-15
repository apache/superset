px.registerWidget('markup', function(data_attribute) {

  function refresh(done) {
      $('#code').attr('rows', '15')
      done();
  }
  return {
    render: refresh,
    resize: refresh,
  };
});
