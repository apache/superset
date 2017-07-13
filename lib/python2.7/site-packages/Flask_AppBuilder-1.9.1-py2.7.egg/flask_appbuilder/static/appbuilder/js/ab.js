//-----------------------------------------------------------
// AJAX REST call to server to fetch data for select2 Slaves
//-----------------------------------------------------------
function loadSelectDataSlave(elem) {
    $(".my_select2_ajax_slave").each(function( index ) {
        var elem = $(this);
        var master_id = elem.attr('master_id');
        var master_val = $('#' + master_id).val();
        if (master_val) {
            var endpoint = elem.attr('endpoint');
            endpoint = endpoint.replace("{{ID}}", master_val);
            $.get( endpoint, function( data ) {
                elem.select2({data: data, placeholder: "Select", allowClear: true});
            });
        }
        else {
            elem.select2({data: {id: "",text: ""}, placeholder: "Select", allowClear: true});
        }
        $('#' + master_id).on("change", function(e) {
            var endpoint = elem.attr('endpoint');
            if (e.val) {
                endpoint = endpoint.replace("{{ID}}", e.val);
                $.get( endpoint, function( data ) {
                    elem.select2({data: data, placeholder: "Select", allowClear: true});
                });
            }
        })
    });
}


//----------------------------------------------------
// AJAX REST call to server to fetch data for select2
//----------------------------------------------------
function loadSelectData() {
    $(".my_select2_ajax").each(function( index ) {
        var elem = $(this);
        $.get( $(this).attr('endpoint'), function( data ) {
            elem.select2({data: data, placeholder: "Select", allowClear: true});
        });
    });
}


//---------------------------------------
// Setup date time modal views, select2
//---------------------------------------
$(document).ready(function() {

    $('.appbuilder_datetime').datetimepicker({pickTime: false});
    $('.appbuilder_date').datetimepicker({
        pickTime: false });
    $(".my_select2").select2({placeholder: "Select a State", allowClear: true});
    loadSelectData();
    loadSelectDataSlave();
    $(".my_select2.readonly").select2("readonly",true);
    $("a").tooltip({container:'.row', 'placement': 'bottom'});
});


$( ".my_change" ).on("change", function(e) {
 var theForm=document.getElementById("model_form");
  theForm.action = "";
  theForm.method = "get";
  theForm.submit();
 })


//---------------------------------------
// Bootstrap modal, javascript alert
//---------------------------------------
function ab_alert(text) {
    $('#modal-alert').on('show.bs.modal', function(e) {
            $('.modal-text').text(text);
        }
    );
    $('#modal-alert').modal('show');
};


//---------------------------------------
// Modal confirmation JS support
//---------------------------------------

// On link attr "data-text" is set to the modal text
$(document).ready(function(){
    $(".confirm").click(function() {
        $('.modal-text').text($(this).data('text'));
    });
});

// If positive confirmation on model follow link
$('#modal-confirm').on('show.bs.modal', function(e) {
    $(this).find('#modal-confirm-ok').attr('href', $(e.relatedTarget).data('href'));
});

