// Javascript for the explorer page
// Init explorer view -> load vis dependencies -> read data (from dynamic html) -> render slice
// nb: to add a new vis, you must also add a Python fn in viz.py
//
// js
const $ = window.$ = require('jquery');
const px = require('./../modules/caravel.js');
const showModal = require('./../modules/utils.js').showModal;
const jQuery = window.jQuery = require('jquery'); // eslint-disable-line

import React from 'react';
import ReactDOM from 'react-dom';
import QueryAndSaveBtns from './components/QueryAndSaveBtns.jsx';

require('jquery-ui');
$.widget.bridge('uitooltip', $.ui.tooltip); // Shutting down jq-ui tooltips
require('bootstrap');

require('./../caravel-select2.js');

// css
require('../../vendor/pygments.css');
require('../../stylesheets/explore.css');

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

function saveSlice() {
  const action = $('input[name=rdo_save]:checked').val();
  if (action === 'saveas') {
    const sliceName = $('input[name=new_slice_name]').val();
    if (sliceName === '') {
      showModal({
        title: 'Error',
        body: 'You must pick a name for the new slice',
      });
      return;
    }
    document.getElementById('slice_name').value = sliceName;
  }
  const addToDash = $('input[name=addToDash]:checked').val();
  if (addToDash === 'existing' && $('#save_to_dashboard_id').val() === '') {
    showModal({
      title: 'Error',
      body: 'You must pick an existing dashboard',
    });
    return;
  } else if (addToDash === 'new' && $('input[name=new_dashboard_name]').val() === '') {
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

function initExploreView() {
  function getCollapsedFieldsets() {
    let collapsedFieldsets = $('#collapsedFieldsets').val();

    if (collapsedFieldsets !== undefined && collapsedFieldsets !== '') {
      collapsedFieldsets = collapsedFieldsets.split('||');
    } else {
      collapsedFieldsets = [];
    }
    return collapsedFieldsets;
  }

  function toggleFieldset(legend, animation) {
    const parent = legend.parent();
    const fieldset = parent.find('.legend_label').text();
    const collapsedFieldsets = getCollapsedFieldsets();
    let index;

    if (parent.hasClass('collapsed')) {
      if (animation) {
        parent.find('.panel-body').slideDown();
      } else {
        parent.find('.panel-body').show();
      }
      parent.removeClass('collapsed');
      parent.find('span.collapser').text('[-]');

      // removing from array, js is overcomplicated
      index = collapsedFieldsets.indexOf(fieldset);
      if (index !== -1) {
        collapsedFieldsets.splice(index, 1);
      }
    } else { // not collapsed
      if (animation) {
        parent.find('.panel-body').slideUp();
      } else {
        parent.find('.panel-body').hide();
      }

      parent.addClass('collapsed');
      parent.find('span.collapser').text('[+]');
      index = collapsedFieldsets.indexOf(fieldset);
      if (index === -1 && fieldset !== '' && fieldset !== undefined) {
        collapsedFieldsets.push(fieldset);
      }
    }

    $('#collapsedFieldsets').val(collapsedFieldsets.join('||'));
  }

  px.initFavStars();

  function copyURLToClipboard(url) {
    const textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.left = '-1000px';
    textArea.value = url;

    document.body.appendChild(textArea);
    textArea.select();
    let successful;
    try {
      successful = document.execCommand('copy');
      if (!successful) {
        throw new Error('Not successful');
      }
    } catch (err) {
      window.alert('Sorry, your browser does not support copying. Use Ctrl / Cmd + C!'); // eslint-disable-line
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
        const close = (
          '<a style="cursor: pointer;">' +
            '<i class="fa fa-close" id="close_shortner"></i>' +
          '</a>'
        );
        const copy = (
          '<a style="cursor: pointer;">' +
            '<i class="fa fa-clipboard" title="Copy to clipboard" id="copy_url"></i>' +
          '</a>'
        );
        const spaces = '&nbsp;&nbsp;&nbsp;';
        const popover = data + spaces + copy + spaces + close;

        const $shortner = $('#shortner')
          .popover({
            content: popover,
            placement: 'left',
            html: true,
            trigger: 'manual',
          })
          .popover('show');
        function destroyPopover() {
          $shortner.popover('destroy');
        }

        $('#copy_url')
        .tooltip()
        .click(function () {
          const success = copyURLToClipboard(data);
          if (success) {
            $(this).attr('data-original-title', 'Copied!')
            .tooltip('fixTitle')
            .tooltip('show');
            window.setTimeout(destroyPopover, 1200);
          }
        });
        $('#close_shortner').click(destroyPopover);
      },
      error(error) {
        showModal({
          title: 'Error',
          body: 'Sorry, an error occurred during this operation:<br/>' + error,
        });
      },
    });
  });

  $('#standalone').click(function () {
    const srcLink = window.location.origin + slice.data.standalone_endpoint;
    const close = (
      '<a style="cursor: pointer;">' +
        '<i class="fa fa-close" id="close_standalone"></i>' +
      '</a>'
    );
    const copy = (
      '<a style="cursor: pointer;">' +
        '<i class="fa fa-clipboard" title="Copy to clipboard" id="copy_embed"></i>' +
      '</a>'
    );
    const spaces = '&nbsp;&nbsp;&nbsp;';
    const widthInput = '<input type="number" id="standalone_width" placeholder="width">';
    const heightInput = '<input type="number" id="standalone_height" placeholder="height">';
    let popover = "<input id='standalone_text' value='' disabled></input>";
    popover = popover + spaces + copy + spaces + close + spaces + widthInput + spaces + heightInput;
    let dataToCopy = '';

    const $standalone = $(this);

    function destroyPopover() {
      $standalone.popover('destroy');
    }

    $standalone.popover({
      content: popover,
      title: 'embed html',
      placement: 'left',
      html: true,
      trigger: 'manual',
    })
    .popover('show');
    $('#copy_embed').tooltip().click(function () {
      const success = copyURLToClipboard(dataToCopy);
      if (success) {
        $(this).attr('data-original-title', 'Copied!')
        .tooltip('fixTitle')
        .tooltip('show');
        window.setTimeout(destroyPopover, 1200);
      }
    });

    $('#close_standalone').click(destroyPopover);

    const $standaloneWidth = $('#standalone_width');
    const $standaloneHeight = $('#standalone_height');
    const $standaloneText = $('#standalone_text');

    function generateEmbedHTML() {
      const width = $standaloneWidth.val();
      const height = $standaloneHeight.val();
      dataToCopy = `<iframe src="${srcLink}" width="${width}" height="${height}"`;
      dataToCopy = dataToCopy + ' seamless frameBorder="0" scrolling="no"></iframe>';
      $standaloneText.val(dataToCopy);
    }

    $standaloneHeight.change(function () {
      generateEmbedHTML();
    });
    $standaloneWidth.change(function () {
      generateEmbedHTML();
    });
    generateEmbedHTML();
  });

  $('#viz_type').change(function () {
    $('#query').submit();
  });

  $('#datasource_id').change(function () {
    window.location = $(this).find('option:selected').attr('url');
  });

  const collapsedFieldsets = getCollapsedFieldsets();
  for (let i = 0; i < collapsedFieldsets.length; i++) {
    toggleFieldset($('legend:contains("' + collapsedFieldsets[i] + '")'), false);
  }
  function formatViz(viz) {
    const url = `/static/assets/images/viz_thumbnails/${viz.id}.png`;
    const noImg = '/static/assets/images/noimg.png';
    return $(
      `<img class="viz-thumb-option" src="${url}" onerror="this.src='${noImg}';">` +
      `<span>${viz.text}</span>`
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

  function addFilter(i, fieldPrefix) {
    const cp = $('#' + fieldPrefix + '0').clone();
    $(cp).appendTo('#' + getPanelClass(fieldPrefix) + ' #filters');
    $(cp).show();
    if (i !== undefined) {
      $(cp).find('#' + fieldPrefix + '_eq_0').val(px.getParam(fieldPrefix + '_eq_' + i));
      $(cp).find('#' + fieldPrefix + '_op_0').val(px.getParam(fieldPrefix + '_op_' + i));
      $(cp).find('#' + fieldPrefix + '_col_0').val(px.getParam(fieldPrefix + '_col_' + i));
    }
    $(cp).find('select').select2();
    $(cp).find('.remove').click(function () {
      $(this)
      .parent()
      .parent()
      .remove();
    });
  }

  function setFilters() {
    ['flt', 'having'].forEach(function (prefix) {
      for (let i = 1; i < 10; i++) {
        const col = px.getParam(prefix + '_col_' + i);
        if (col !== '') {
          addFilter(i, prefix);
        }
      }
    });
  }
  setFilters();

  $(window).bind('popstate', function () {
    // Browser back button
    const returnLocation = history.location || document.location;
    // Could do something more lightweight here, but we're not optimizing
    // for the use of the back button anyways
    returnLocation.reload();
  });

  $('#filter_panel #plus').click(function () {
    addFilter(undefined, 'flt');
  });
  $('#having_panel #plus').click(function () {
    addFilter(undefined, 'having');
  });

  const queryAndSaveBtnsEl = document.getElementById('js-query-and-save-btns');
  ReactDOM.render(
    <QueryAndSaveBtns
      canAdd={queryAndSaveBtnsEl.getAttribute('data-can-add')}
      onQuery={() => query(true)}
    />,
    queryAndSaveBtnsEl
  );

  function createChoices(term, data) {
    const filtered = $(data).filter(function () {
      return this.text.localeCompare(term) === 0;
    });
    if (filtered.length === 0) {
      return {
        id: term,
        text: term,
      };
    }
    return {};
  }

  function initSelectionToValue(element, callback) {
    callback({
      id: element.val(),
      text: element.val(),
    });
  }

  $('.select2_freeform').each(function () {
    const parent = $(this).parent();
    const name = $(this).attr('name');
    const l = [];
    let selected = '';
    for (let i = 0; i < this.options.length; i++) {
      l.push({
        id: this.options[i].value,
        text: this.options[i].text,
      });
      if (this.options[i].selected) {
        selected = this.options[i].value;
      }
    }
    parent.append(
      `<input class="${$(this).attr('class')}" ` +
      `name="${name}" type="text" value="${selected}">`
    );
    $(`input[name='${name}']`).select2({
      createSearchChoice: createChoices,
      initSelection: initSelectionToValue,
      dropdownAutoWidth: true,
      multiple: false,
      data: l,
    });
    $(this).remove();
  });

  function prepSaveDialog() {
    const setButtonsState = function () {
      const addToDash = $('input[name=addToDash]:checked').val();
      if (addToDash === 'existing' || addToDash === 'new') {
        $('.gotodash').removeAttr('disabled');
      } else {
        $('.gotodash').prop('disabled', true);
      }
    };
    const url = '/dashboardmodelviewasync/api/read?_flt_0_owners=' + $('#userid').val();
    $.get(url, function (data) {
      const choices = [];
      for (let i = 0; i < data.pks.length; i++) {
        choices.push({ id: data.pks[i], text: data.result[i].dashboard_title });
      }
      $('#save_to_dashboard_id').select2({
        data: choices,
        dropdownAutoWidth: true,
      }).on('select2-selecting', function () {
        $('#addToDash_existing').prop('checked', true);
        setButtonsState();
      });
    });

    $('input[name=addToDash]').change(setButtonsState);
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

$(document).ready(function () {
  const data = $('.slice').data('slice');

  initExploreView();

  slice = px.Slice(data);

  $('.slice').data('slice', slice);

  // call vis render method, which issues ajax
  query(false, false);

  slice.bindResizeToWindowResize();
});
