// Javascript for the explorer page
// Init explorer view -> load vis dependencies -> read data (from dynamic html) -> render slice
// nb: to add a new vis, you must also add a Python fn in viz.py
//
// js
const $ = window.$ = require('jquery');
const jQuery = window.jQuery = $;
const px = require('./../modules/caravel.js');
const showModal = require('./../modules/utils.js').showModal;

import React from 'react';
import ReactDOM from 'react-dom';
import QueryAndSaveBtns from './components/QueryAndSaveBtns.jsx';

require('jquery-ui');
$.widget.bridge('uitooltip', $.ui.tooltip); // Shutting down jq-ui tooltips
require('bootstrap');

require('./../caravel-select2.js');

require('../../node_modules/bootstrap-toggle/js/bootstrap-toggle.min.js');

// css
require('../../vendor/pygments.css');
require('../../stylesheets/explore.css');
require('../../node_modules/bootstrap-toggle/css/bootstrap-toggle.min.css');

let slice;

const getPanelClass = function (fieldPrefix) {
  return (fieldPrefix === 'flt' ? 'filter' : 'having') + '_panel';
};

function prepForm() {
  // Assigning the right id to form elements in filters
  const fixId = function ($filter, fieldPrefix, i) {
    $filter.attr('id', function () {
      return fieldPrefix + '_' + i;
    });

    ['col', 'op', 'eq'].forEach(function (fieldMiddle) {
      const fieldName = fieldPrefix + '_' + fieldMiddle;
      $filter.find('[id^=' + fieldName + '_]')
          .attr('id', function () {
            return fieldName + '_' + i;
          })
          .attr('name', function () {
            return fieldName + '_' + i;
          });
    });
  };

  ['flt', 'having'].forEach(function (fieldPrefix) {
    let i = 1;
    $('#' + getPanelClass(fieldPrefix) + ' #filters > div').each(function () {
      fixId($(this), fieldPrefix, i);
      i++;
    });
  });
}

function query(forceUpdate, pushState) {
  let force = forceUpdate;
  if (force === undefined) {
    force = false;
  }
  $('.query-and-save button').attr('disabled', 'disabled');
  $('.btn-group.results span,a').attr('disabled', 'disabled');
  if (force) {  // Don't hide the alert message when the page is just loaded
    $('div.alert').remove();
  }
  $('#is_cached').hide();
  prepForm();

  if (pushState !== false) {
    // update the url after prepForm() fix the field ids
    history.pushState({}, document.title, slice.querystring());
  }
  slice.render(force);
}

function initExploreView() {
  function get_collapsed_fieldsets() {
    var collapsed_fieldsets = $('#collapsed_fieldsets').val();

    if (collapsed_fieldsets !== undefined && collapsed_fieldsets !== '') {
      collapsed_fieldsets = collapsed_fieldsets.split('||');
    } else {
      collapsed_fieldsets = [];
    }
    return collapsed_fieldsets;
  }

  function toggle_fieldset(legend, animation) {
    var parent = legend.parent();
    var fieldset = parent.find('.legend_label').text();
    var collapsed_fieldsets = get_collapsed_fieldsets();
    var index;

    if (parent.hasClass('collapsed')) {
      if (animation) {
        parent.find('.panel-body').slideDown();
      } else {
        parent.find('.panel-body').show();
      }
      parent.removeClass('collapsed');
      parent.find('span.collapser').text('[-]');

      // removing from array, js is overcomplicated
      index = collapsed_fieldsets.indexOf(fieldset);
      if (index !== -1) {
        collapsed_fieldsets.splice(index, 1);
      }
    } else { // not collapsed
      if (animation) {
        parent.find('.panel-body').slideUp();
      } else {
        parent.find('.panel-body').hide();
      }

      parent.addClass('collapsed');
      parent.find('span.collapser').text('[+]');
      index = collapsed_fieldsets.indexOf(fieldset);
      if (index === -1 && fieldset !== '' && fieldset !== undefined) {
        collapsed_fieldsets.push(fieldset);
      }
    }

    $('#collapsed_fieldsets').val(collapsed_fieldsets.join('||'));
  }

  px.initFavStars();

  $('form .panel-heading').click(function () {
    toggle_fieldset($(this), true);
    $(this).css('cursor', 'pointer');
  });

  function copyURLToClipboard(url) {
    var textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.left = '-1000px';
    textArea.value = url;

    document.body.appendChild(textArea);
    textArea.select();

    try {
      var successful = document.execCommand('copy');
      if (!successful) {
        throw new Error('Not successful');
      }
    } catch (err) {
      window.alert('Sorry, your browser does not support copying. Use Ctrl / Cmd + C!');
    }
    document.body.removeChild(textArea);
    return successful;
  }

  $('#shortner').click(function () {
    $.ajax({
      type: 'POST',
      url: '/r/shortner/',
      data: {
        data: '/' + window.location.pathname + slice.querystring(),
      },
      success(data) {
        var close = '<a style="cursor: pointer;"><i class="fa fa-close" id="close_shortner"></i></a>';
        var copy = '<a style="cursor: pointer;"><i class="fa fa-clipboard" title="Copy to clipboard" id="copy_url"></i></a>';
        var spaces = '&nbsp;&nbsp;&nbsp;';
        var popover = data + spaces + copy + spaces + close;

        var $shortner = $('#shortner')
          .popover({
            content: popover,
            placement: 'left',
            html: true,
            trigger: 'manual',
          })
          .popover('show');

        $('#copy_url').tooltip().click(function () {
          var success = copyURLToClipboard(data);
          if (success) {
            $(this).attr('data-original-title', 'Copied!').tooltip('fixTitle').tooltip('show');
            window.setTimeout(destroyPopover, 1200);
          }
        });
        $('#close_shortner').click(destroyPopover);

        function destroyPopover() {
          $shortner.popover('destroy');
        }
      },
      error(error) {
        showModal({
          title: 'Error',
          body: 'Sorry, an error occurred during this operation:<br/>' + error,
        });
        console.warn('Short URL error', error);
      },
    });
  });

  $('#standalone').click(function () {
    var src_link = window.location.origin + slice.data.standalone_endpoint;
    var dataToCopy = '';
    var close = '<a style="cursor: pointer;"><i class="fa fa-close" id="close_standalone"></i></a>';
    var copy = '<a style="cursor: pointer;"><i class="fa fa-clipboard" title="Copy to clipboard" id="copy_embed"></i></a>';
    var spaces = '&nbsp;&nbsp;&nbsp;';
    var widthInput = '<input type="number" id="standalone_width" placeholder="width">';
    var heightInput = '<input type="number" id="standalone_height" placeholder="height">';
    var popover = "<input id='standalone_text' value='' disabled></input>";
    popover = popover + spaces + copy + spaces + close + spaces + widthInput + spaces + heightInput;

    var $standalone = $(this);
    $standalone.popover({
      content: popover,
      title: 'embed html',
      placement: 'left',
      html: true,
      trigger: 'manual',
    })
    .popover('show');
    $('#copy_embed').tooltip().click(function () {
      var success = copyURLToClipboard(dataToCopy);
      if (success) {
        $(this).attr('data-original-title', 'Copied!').tooltip('fixTitle').tooltip('show');
        window.setTimeout(destroyPopover, 1200);
      }
    });

    $('#close_standalone').click(destroyPopover);

    function destroyPopover() {
      $standalone.popover('destroy');
    }

    var $standalone_width = $('#standalone_width');
    var $standalone_height = $('#standalone_height');
    var $standalone_text = $('#standalone_text');

    $standalone_height.change(function () {
      generateEmbedHTML();
    });
    $standalone_width.change(function () {
      generateEmbedHTML();
    });
    generateEmbedHTML();
    function generateEmbedHTML() {
      var width = $standalone_width.val();
      var height = $standalone_height.val();
      dataToCopy = '<iframe src="' + src_link + '" width="' + width + '" height="' + height + '"';
      dataToCopy = dataToCopy + ' seamless frameBorder="0" scrolling="no"></iframe>';
      $standalone_text.val(dataToCopy);
    }
  });

  $('#viz_type').change(function () {
    $('#query').submit();
  });

  $('#datasource_id').change(function () {
    var url = $(this).find('option:selected').attr('url');
    window.location = url;
  });

  var collapsed_fieldsets = get_collapsed_fieldsets();
  for (var i = 0; i < collapsed_fieldsets.length; i++) {
    toggle_fieldset($('legend:contains("' + collapsed_fieldsets[i] + '")'), false);
  }
  function formatViz(viz) {
    var url = '/static/assets/images/viz_thumbnails/' + viz.id + '.png';
    var no_img = '/static/assets/images/noimg.png';
    return $(
      '<img class="viz-thumb-option" src="' + url + '" onerror="this.src=\'' + no_img + '\';">' +
      '<span>' + viz.text + '</span>'
    );
  }

  $('.select2').select2({
    dropdownAutoWidth: true,
  });
  $('.select2Sortable').select2({
    dropdownAutoWidth: true,
  });
  $('.select2-with-images').select2({
    dropdownAutoWidth: true,
    dropdownCssClass: 'bigdrop',
    formatResult: formatViz,
  });
  $('.select2Sortable').select2Sortable({
    bindOrder: 'sortableStop',
  });
  $('form').show();
  $('[data-toggle="tooltip"]').tooltip({ container: 'body' });
  $('.ui-helper-hidden-accessible').remove(); // jQuery-ui 1.11+ creates a div for every tooltip

  function set_filters() {
    ['flt', 'having'].forEach(function (prefix) {
      for (var i = 1; i < 10; i++) {
        var col = px.getParam(prefix + '_col_' + i);
        if (col !== '') {
          add_filter(i, prefix);
        }
      }
    });
  }
  set_filters();

  function add_filter(i, fieldPrefix) {
    var cp = $('#' + fieldPrefix + '0').clone();
    $(cp).appendTo('#' + getPanelClass(fieldPrefix) + ' #filters');
    $(cp).show();
    if (i !== undefined) {
      $(cp).find('#' + fieldPrefix + '_eq_0').val(px.getParam(fieldPrefix + '_eq_' + i));
      $(cp).find('#' + fieldPrefix + '_op_0').val(px.getParam(fieldPrefix + '_op_' + i));
      $(cp).find('#' + fieldPrefix + '_col_0').val(px.getParam(fieldPrefix + '_col_' + i));
    }
    $(cp).find('select').select2();
    $(cp).find('.remove').click(function () {
      $(this).parent().parent().remove();
    });
  }

  $(window).bind('popstate', function (event) {
    // Browser back button
    var returnLocation = history.location || document.location;
    // Could do something more lightweight here, but we're not optimizing
    // for the use of the back button anyways
    returnLocation.reload();
  });

  $('#filter_panel #plus').click(function () {
    add_filter(undefined, 'flt');
  });
  $('#having_panel #plus').click(function () {
    add_filter(undefined, 'having');
  });

  const queryAndSaveBtnsEl = document.getElementById('js-query-and-save-btns');
  ReactDOM.render(
    <QueryAndSaveBtns
      canAdd={queryAndSaveBtnsEl.getAttribute('data-can-add')}
      onQuery={() => query(true)}
    />,
    queryAndSaveBtnsEl
  );

  function create_choices(term, data) {
    var filtered = $(data).filter(function () {
      return this.text.localeCompare(term) === 0;
    });
    if (filtered.length === 0) {
      return {
        id: term,
        text: term,
      };
    }
  }

  function initSelectionToValue(element, callback) {
    callback({
      id: element.val(),
      text: element.val(),
    });
  }

  $('.select2_freeform').each(function () {
    var parent = $(this).parent();
    var name = $(this).attr('name');
    var l = [];
    var selected = '';
    for (var i = 0; i < this.options.length; i++) {
      l.push({
        id: this.options[i].value,
        text: this.options[i].text,
      });
      if (this.options[i].selected) {
        selected = this.options[i].value;
      }
    }
    parent.append(
      '<input class="' + $(this).attr('class') + '" name="' + name + '" type="text" value="' + selected + '">'
    );
    $("input[name='" + name + "']").select2({
      createSearchChoice: create_choices,
      initSelection: initSelectionToValue,
      dropdownAutoWidth: true,
      multiple: false,
      data: l,
    });
    $(this).remove();
  });

  function prepSaveDialog() {
    var setButtonsState = function () {
      var add_to_dash = $('input[name=add_to_dash]:checked').val();
      if (add_to_dash === 'existing' || add_to_dash === 'new') {
        $('.gotodash').removeAttr('disabled');
      } else {
        $('.gotodash').prop('disabled', true);
      }
    };
    var url = '/dashboardmodelviewasync/api/read';
    url += '?_flt_0_owners=' + $('#userid').val();
    $.get(url, function (data) {
      var choices = [];
      for (var i = 0; i < data.pks.length; i++) {
        choices.push({ id: data.pks[i], text: data.result[i].dashboard_title });
      }
      $('#save_to_dashboard_id').select2({
        data: choices,
        dropdownAutoWidth: true,
      }).on('select2-selecting', function () {
        $('#add_to_dash_existing').prop('checked', true);
        setButtonsState();
      });
    });

    $('input[name=add_to_dash]').change(setButtonsState);
    $("input[name='new_dashboard_name']").on('focus', function () {
      $('#add_to_new_dash').prop('checked', true);
      setButtonsState();
    });
    $("input[name='new_slice_name']").on('focus', function () {
      $('#save_as_new').prop('checked', true);
      setButtonsState();
    });

    $('#btn_modal_save').on('click', () => saveSlice());

    $('#btn_modal_save_goto_dash').click(() => {
      document.getElementById('goto_dash').value = 'true';
      saveSlice();
    });
  }
  prepSaveDialog();
}

function saveSlice() {
  var action = $('input[name=rdo_save]:checked').val();
  if (action === 'saveas') {
    var slice_name = $('input[name=new_slice_name]').val();
    if (slice_name === '') {
      showModal({
        title: 'Error',
        body: 'You must pick a name for the new slice',
      });
      return;
    }
    document.getElementById('slice_name').value = slice_name;
  }
  var add_to_dash = $('input[name=add_to_dash]:checked').val();
  if (add_to_dash === 'existing' && $('#save_to_dashboard_id').val() === '') {
    showModal({
      title: 'Error',
      body: 'You must pick an existing dashboard',
    });
    return;
  } else if (add_to_dash === 'new' && $('input[name=new_dashboard_name]').val() === '') {
    showModal({
      title: 'Error',
      body: 'Please enter a name for the new dashboard',
    });
    return;
  }
  $('#action').val(action);
  prepForm();
  $('#query').submit();
}

$(document).ready(function () {
  const data = $('.slice').data('slice');

  initExploreView();

  slice = px.Slice(data);

  $('.slice').data('slice', slice);

  // call vis render method, which issues ajax
  query(false, false);

  slice.bindResizeToWindowResize();
});
