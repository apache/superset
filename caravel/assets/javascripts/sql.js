var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
require('select2');
require('datatables');
require('bootstrap');

var ace = require('brace');
require('brace/mode/sql');
require('brace/theme/crimson_editor');

$(document).ready(function () {
  function getParam(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  function initSqlEditorView() {
    var database_id = $('#database_id').val();
    var editor = ace.edit("sql");
    editor.$blockScrolling = Infinity;
    editor.getSession().setUseWrapMode(true);

    $('#sql').hide();
    editor.setTheme("ace/theme/crimson_editor");
    editor.setOptions({
      minLines: 16,
      maxLines: Infinity
    });
    editor.getSession().setMode("ace/mode/sql");
    editor.focus();
    $("select").select2({
      dropdownAutoWidth: true
    });

    function showTableMetadata() {
      $(".metadata").load(
        '/dashed/table/' + database_id + '/' + $("#dbtable").val() + '/');
    }
    $("#dbtable").on("change", showTableMetadata);
    showTableMetadata();
    $("#create_view").click(function () {
      alert("Not implemented");
    });
    $(".sqlcontent").show();

    function selectStarOnClick() {
      $.ajax('/dashed/select_star/' + database_id + '/' + $("#dbtable").val() + '/')
        .done(function (msg) {
          editor.setValue(msg);
        });
    }

    $("#select_star").click(selectStarOnClick);

    editor.setValue(getParam('sql'));
    $(window).bind("popstate", function (event) {
      // Could do something more lightweight here, but we're not optimizing
      // for the use of the back button anyways
      editor.setValue(getParam('sql'));
      $("#run").click();
    });
    $("#run").click(function () {
      $('#results').hide(0);
      $('#loading').show(0);
      history.pushState({}, document.title, '?sql=' + encodeURIComponent(editor.getValue()));
      $.ajax({
        type: "POST",
        url: '/dashed/runsql/',
        data: {
          data: JSON.stringify({
            database_id: $('#database_id').val(),
            sql: editor.getSession().getValue()
          })
        },
        success: function (data) {
          $('#loading').hide(0);
          $('#results').show(0);
          $('#results').html(data);

          $('table.sql_results').DataTable({
            paging: false,
            searching: true,
            aaSorting: []
          });
        },
        error: function (err, err2) {
          $('#loading').hide(0);
          $('#results').show(0);
          $('#results').html(err.responseText);
        }
      });
    });
  }
  initSqlEditorView();
});
