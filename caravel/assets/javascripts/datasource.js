var jsonGenerator = require("./modules/json_generator");

$(document).ready(function () {
    $('#convertButton').click(function () {
        var expression = $('#expression').val().trim();
        var parse_tree = jsonGenerator.parse(expression);
        console.log(parse_tree);
        $('#json').val(JSON.stringify(parse_tree));
        $(this).closest('.modal').modal('hide');
    });
    $('#json_gen_modal').on('shown.bs.modal', function () {
        $('#expression').focus();
    });

    var showJsonGenModal = function () {
        $('#json_gen_modal').modal('show');
    };

    $.extend(window, {
        showJsonGenModal: showJsonGenModal
    });
});
