var $ = window.$ || require('jquery');
var jsonGenerator = require("./modules/json_generator");

$(document).ready(function () {
    var $modal = $('#json_gen_modal');

    var getJsonOrWarn = function () {
        var expression = $('#expression').val().trim();
        var $alert = $modal.find('#errorMsg');
        $alert
            .removeClass('hidden')
            .hide()
            .html("");
        try {
            var parse_tree = jsonGenerator.parse(expression);
            return JSON.stringify(parse_tree);
        } catch (e) {
            $alert
                .show()
                .html(e.message);
        }
        return null;
    };

    $('#convertButton').click(function () {
        var json = getJsonOrWarn();
        if (json) {
            $('#json').val(json);
            $(this).closest('.modal').modal('hide');
        }
    });

    $('#previewButton').click(function () {
        var $preview = $modal.find('#preview');
        var json = getJsonOrWarn();
        $preview.html(json || "");
    });

    $modal.on('shown.bs.modal', function () {
        $('#expression').focus();
    });

    var showJsonGenModal = function () {
        $modal.modal('show');
    };

    $.extend(window, {
        showJsonGenModal: showJsonGenModal
    });
});
