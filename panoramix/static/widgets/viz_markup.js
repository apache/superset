px.registerWidget('markup', function(data_attribute) {

  function refresh(ctrl) {
      $('#code').attr('rows', '15')
      ctrl.done();
  }
  return {
    render: refresh,
    resize: refresh,
  };
});
