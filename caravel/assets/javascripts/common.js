var $ = require('jquery');
var utils = require('./modules/utils');

$(document).ready(function () {
    $(':checkbox[data-checkbox-api-prefix]').change(function () {
        var $this = $(this);
        var prefix = $this.data('checkbox-api-prefix');
        var id = $this.attr('id');
        utils.toggleCheckbox(prefix, "#" + id);
    });
});
