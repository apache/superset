var $ = window.$ || require('jquery');

function markupWidget(slice) {

  function refresh(callback) {
    $('#code').attr('rows', '15');

    $.getJSON(slice.jsonEndpoint(), function (payload) {
        slice.container.html(payload.data.html);
        slice.done();
      })
      .always(function () {
        if (callback) {
          return callback();
        }
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
