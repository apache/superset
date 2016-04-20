var $ = window.$ || require('jquery');

function iframeWidget(slice) {

  function refresh() {
    $('#code').attr('rows', '15');
    $.getJSON(slice.jsonEndpoint(), function (payload) {
        slice.container.html('<iframe style="width:100%;"></iframe>');
        var iframe = slice.container.find('iframe');
        iframe.css('height', slice.height());
        iframe.attr('src', payload.form_data.url);
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

module.exports = iframeWidget;
