const $ = window.$ = require('jquery');
/* eslint no-unused-vars: 0 */
const jQuery = window.jQuery = $;
const px = require('./modules/superset.js');
const utils = require('./modules/utils.js');

require('bootstrap');

const standaloneController = Object.assign(
  {}, utils.controllerInterface, { type: 'standalone' });

$(document).ready(function () {
  const data = $('.slice').data('slice');
  const slice = px.Slice(data, standaloneController);
  slice.render();
  slice.bindResizeToWindowResize();
});
