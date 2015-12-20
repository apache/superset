px.registerViz('markup', function(slice) {

  function refresh() {
      $('#code').attr('rows', '15')
      slice.done();
  }
  return {
    render: refresh,
    resize: refresh,
  };
});
