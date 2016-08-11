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
import ExploreActionButtons from './components/ExploreActionButtons.jsx';

require('jquery-ui');
$.widget.bridge('uitooltip', $.ui.tooltip); // Shutting down jq-ui tooltips
require('bootstrap');

require('./../caravel-select2.js');

// css
require('../../vendor/pygments.css');
require('../../stylesheets/explore.css');

let slice;
let filterCount = 1;

const getPanelClass = function (fieldPrefix) {
  return (fieldPrefix === 'flt' ? 'filter' : 'having') + '_panel';
};

function query(forceUpdate, pushState) {
  let force = forceUpdate;
  if (force === undefined) {
    force = false;
  }
  $('.query-and-save button').attr('disabled', 'disabled');
  if (force) {  // Don't hide the alert message when the page is just loaded
    $('div.alert').remove();
  }
  $('#is_cached').hide();

  if (pushState !== false) {
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

  function convertSelect(selectId, multiple) {
    const parent = $(selectId).parent();
    const name = $(selectId).attr('name');
    const l = [];
    let selected = '';
    const options = $(selectId + ' option');
    const classes = $(selectId).attr('class');
    for (let i = 0; i < options.length; i++) {
      l.push({
        id: options[i].value,
        text: options[i].text,
      });
      if (options[i].selected) {
        selected = options[i].value;
      }
    }
    $(selectId).remove();
    parent.append(
      '<input class="' + classes + '" id="' + selectId.substring(1) +
      '" name="' + name + '" type="text" value="' + selected + '">'
    );
    $(`input[name='${name}']`).select2({
      createSearchChoice: createChoices,
      dropdownAutoWidth: true,
      multiple,
      data: l,
      sortResults(data) {
        return data.sort(function (a, b) {
          if (a.text > b.text) {
            return 1;
          } else if (a.text < b.text) {
            return -1;
          }
          return 0;
        });
      },
    });
  }

  function insertFilterChoices(i, fieldPrefix) {
    const column = $('#' + fieldPrefix + '_col_' + i).val();
    const eq = '#' + fieldPrefix + '_eq_' + i;
    $(eq).empty();

    $.getJSON(slice.filterEndpoint(column), function (data) {
      $(eq).append($('<option></option>').attr('value', null).text(''));
      $.each(data, function (key, value) {
        const wrappedValue = '\'' + value + '\'';
        $(eq).append($('<option></option>')
          .attr('value', wrappedValue)
          .text(wrappedValue));
      });
      $(eq).select2('destroy');
      convertSelect(eq, true);
    });
  }

  function addFilter(i, fieldPrefix) {
    const isHaving = fieldPrefix === 'having';
    const cp = $('#' + fieldPrefix + '0').clone();
    $(cp).appendTo('#' + getPanelClass(fieldPrefix) + ' #filters');
    $(cp).attr('id', fieldPrefix + filterCount);
    $(cp).show();

    const eqId = fieldPrefix + '_eq_' + filterCount;
    const $eq = $(cp).find('#' + fieldPrefix + '_eq_0');
    $eq.attr('id', eqId).attr('name', eqId);

    const opId = fieldPrefix + '_op_' + filterCount;
    const $op = $(cp).find('#' + fieldPrefix + '_op_0');
    $op.attr('id', opId).attr('name', opId);

    const colId = fieldPrefix + '_col_' + filterCount;
    const $col = $(cp).find('#' + fieldPrefix + '_col_0');
    $col.attr('id', colId).attr('name', colId);

    // Set existing values
    if (i !== undefined) {
      $op.val(px.getParam(fieldPrefix + '_op_' + i));
      $col.val(px.getParam(fieldPrefix + '_col_' + i));

      if (isHaving || !slice.filterSelectEnabled) {
        $eq.val(px.getParam(fieldPrefix + '_eq_' + i));
      } else {
        insertFilterChoices(filterCount, fieldPrefix);
        const eqVal = px.getParam(fieldPrefix + '_eq_' + i);
        $eq.append($('<option selected></option>')
          .attr('value', eqVal).text(eqVal));
      }
    }

    if (slice.filterSelectEnabled && !isHaving) {
      const currentFilter = filterCount;
      $col.change(function () {
        insertFilterChoices(currentFilter, fieldPrefix);
      });
    }

    $(cp).find('select').select2();
    $(cp).find('.remove').click(function () {
      $(this)
      .parent()
      .parent()
      .remove();
    });
    filterCount++;
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

  $('.select2_freeform').each(function () {
    convertSelect('#' + $(this).attr('id'), false);
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

function initComponents() {
  const queryAndSaveBtnsEl = document.getElementById('js-query-and-save-btns');
  ReactDOM.render(
    <QueryAndSaveBtns
      canAdd={queryAndSaveBtnsEl.getAttribute('data-can-add')}
      onQuery={() => query(true)}
    />,
    queryAndSaveBtnsEl
  );

  const exploreActionsEl = document.getElementById('js-explore-actions');
  ReactDOM.render(
    <ExploreActionButtons
      canDownload={exploreActionsEl.getAttribute('data-can-download')}
      slice={slice}
    />,
    exploreActionsEl
  );
}

$(document).ready(function () {
  const data = $('.slice').data('slice');
  slice = px.Slice(data);
  $('.slice').data('slice', slice);

  initExploreView();

  // call vis render method, which issues ajax
  // calls render on the slice for the first time
  query(false, false);

  slice.bindResizeToWindowResize();

  initComponents();
});
