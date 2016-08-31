const $ = require('jquery');

function iframeWidget(slice) {
  function refresh() {
    $('#code').attr('rows', '15');
    $.getJSON(slice.jsonEndpoint(), function (payload) {
      const url = slice.render_template(payload.form_data.url);
      slice.container.html('<iframe style="width:100%;"></iframe>');
      const iframe = slice.container.find('iframe');
      iframe.css('height', slice.height());
      iframe.attr('src', url);
      slice.done(payload);
    })
      .fail(function (xhr) {
        slice.error(xhr.responseText, xhr);
      });
  }

  return {
    render: refresh,
    resize: refresh,
  };
}

module.exports = iframeWidget;
