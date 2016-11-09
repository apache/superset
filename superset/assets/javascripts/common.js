const $ = require('jquery');
const utils = require('./modules/utils');
$(document).ready(function () {
  $(':checkbox[data-checkbox-api-prefix]').change(function () {
    const $this = $(this);
    const prefix = $this.data('checkbox-api-prefix');
    const id = $this.attr('id');
    utils.toggleCheckbox(prefix, '#' + id);
  });
});
