const $ = require('jquery');

require('./markup.css');

function markupWidget(slice, payload) {
  $('#code').attr('rows', '15');
  slice.container.html(payload.data.html);
}

module.exports = markupWidget;
