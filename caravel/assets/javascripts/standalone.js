var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
var px = require('./modules/caravel.js');

require('bootstrap');

$(document).ready(function () {
  var slice;
  var data = $('.slice').data('slice');
  slice = px.Slice(data);
  slice.render();
  slice.bindResizeToWindowResize();
});
