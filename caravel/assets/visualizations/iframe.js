var $ = window.$ || require('jquery');

function iframeWidget(slice) {

  function refresh() {
    $('#code').attr('rows', '15');
    $.getJSON(slice.jsonEndpoint(), function (payload) {
        var url = slice.render_template(payload.form_data.url);
        slice.container.html('<iframe style="width:100%;"></iframe>');
        var iframe = slice.container.find('iframe');
        iframe.css('height', slice.height());
        iframe.attr('src', url);
        slice.done(payload);
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
