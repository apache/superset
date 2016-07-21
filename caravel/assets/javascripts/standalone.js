const $ = window.$ = require('jquery');
const jQuery = window.jQuery = $;
const px = require('./modules/caravel.js');

require('bootstrap');

$(document).ready(function () {
  const data = $('.slice').data('slice');
  const slice = px.Slice(data);
  slice.render();
  slice.bindResizeToWindowResize();
});
