const $ = require('jquery');

require('./markup.css');

function markupWidget(slice, payload) {
  $('#code').attr('rows', '15');
  slice.container.css({
    overflow: 'auto',
    height: slice.container.height(),
  });
  slice.container.html(payload.data.html);
}

module.exports = markupWidget;
