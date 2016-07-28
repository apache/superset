const $ = window.$ = require('jquery');
const showModal = require('./modules/utils.js').showModal;
require('./caravel-select2.js');
require('datatables.net-bs');
require('../node_modules/datatables-bootstrap3-plugin/media/css/datatables-bootstrap3.css');
require('bootstrap');
const ace = require('brace');
require('brace/mode/sql');
require('brace/theme/crimson_editor');
require('../stylesheets/sql.css');
$(document).ready(function () {
  function getParam(name) {
    /* eslint no-param-reassign: 0 */
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }
  function initSqlEditorView() {
    const databaseId = $('#databaseId').val();
    const editor = ace.edit('sql');
    editor.$blockScrolling = Infinity;
    editor.getSession().setUseWrapMode(true);
    $('#sql').hide();
    editor.setTheme('ace/theme/crimson_editor');
    editor.setOptions({
      minLines: 16,
      maxLines: Infinity,
    });
    editor.getSession().setMode('ace/mode/sql');
    editor.focus();

    $('select').select2({ dropdownAutoWidth: true });

    function showTableMetadata() {
      $('.metadata').load('/caravel/table/' + databaseId + '/' + $('#dbtable').val() + '/');
    }
    $('#dbtable').on('change', showTableMetadata);
    showTableMetadata();
    $('#create_view').click(function () {
      showModal({
        title: 'Error',
        body: 'Sorry, this feature is not yet implemented',
      });
    });
    $('.sqlcontent').show();
    function selectStarOnClick() {
      const url = '/caravel/select_star/' + databaseId + '/' + $('#dbtable').val() + '/';
      $.ajax(url).done(function (msg) {
        editor.setValue(msg);
      });
    }
    $('#select_star').click(selectStarOnClick);
    editor.setValue(getParam('sql'));
    $(window).bind('popstate', function () {
      // Could do something more lightweight here, but we're not optimizing
      // for the use of the back button anyways
      editor.setValue(getParam('sql'));
      $('#run').click();
    });
    $('#run').click(function () {
      $('#results').hide(0);
      $('#loading').show(0);
      history.pushState({}, document.title, '?sql=' + encodeURIComponent(editor.getValue()));
      $.ajax({
        type: 'POST',
        url: '/caravel/runsql/',
        data: {
          data: JSON.stringify({
            databaseId: $('#databaseId').val(),
            sql: editor.getSession().getValue(),
          }),
        },
        success(data) {
          $('#loading').hide(0);
          $('#results').show(0);
          $('#results').html(data);
          $('table.sql_results').DataTable({
            retrieve: true,
            paging: false,
            searching: true,
            aaSorting: [],
          });
        },
        error(err) {
          $('#loading').hide(0);
          $('#results').show(0);
          $('#results').html(err.responseText);
        },
      });
    });
  }
  initSqlEditorView();
});
