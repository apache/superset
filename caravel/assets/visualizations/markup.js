var $ = window.$ || require('jquery');

function markupWidget(slice) {

  function refresh() {
    $('#code').attr('rows', '15');

    $.getJSON(slice.jsonEndpoint(), function (payload) {
        slice.container.html(payload.data.html);
        slice.done();
      })
      .fail(function (xhr) {
        slice.error(xhr.responseText);
      });
  }

  return {
    render: refresh,
    resize: refresh
  };
}

module.exports = markupWidget;
