const $ = require('jquery');

function iframeWidget(slice) {
  $('#code').attr('rows', '15');
  const url = slice.render_template(slice.formData.url);
  slice.container.html('<iframe style="width:100%;"></iframe>');
  const iframe = slice.container.find('iframe');
  iframe.css('height', slice.height());
  iframe.attr('src', url);
}

module.exports = iframeWidget;
