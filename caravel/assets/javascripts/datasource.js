var $ = window.$ || require('jquery');
var jsonGenerator = require("./modules/json_generator");

$(document).ready(function () {
    var $modal = $('#json_gen_modal');
    $('#convertButton').click(function () {
        var expression = $('#expression').val().trim();
        var $alert = $modal.find('#errorMsg');
        $alert
            .removeClass('hidden')
            .hide()
            .html("");
        try {
            var parse_tree = jsonGenerator.parse(expression);
            $('#json').val(JSON.stringify(parse_tree));

            $(this).closest('.modal').modal('hide');
        } catch (e) {
            $alert
                .show()
                .html(e.message);
        }
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
