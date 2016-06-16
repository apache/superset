var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;

var showApiMessage = function (resp) {
    var template = '<div class="alert"> ' +
        '<button type="button" class="close" ' +
        'data-dismiss="alert">×</button> </div>';

    var severity = resp.severity || 'info';
    $(template)
        .addClass('alert-' + severity)
        .append(resp.message)
        .appendTo($('#alert-container'));
};

var toggleCheckbox = function (apiUrlPrefix, selector) {
    var apiUrl = apiUrlPrefix + $(selector)[0].checked;
    $.get(apiUrl).fail(function (xhr, textStatus, errorThrown) {
        var resp = xhr.responseJSON;
        if (resp && resp.message) {
            showApiMessage(resp);
        }
    });
};

$.extend(window, {
    toggleCheckbox: toggleCheckbox
});
