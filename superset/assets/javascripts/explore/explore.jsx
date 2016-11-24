// Javascript for the explorer page
// Init explorer view -> load vis dependencies -> read data (from dynamic html) -> render slice
// nb: to add a new vis, you must also add a Python fn in viz.py
//
// js
const $ = window.$ = require('jquery');
const px = require('./../modules/superset.js');
const utils = require('./../modules/utils.js');
const jQuery = window.jQuery = require('jquery'); // eslint-disable-line

import React from 'react';
import ReactDOM from 'react-dom';
import QueryAndSaveBtns from './components/QueryAndSaveBtns.jsx';
import ExploreActionButtons from './components/ExploreActionButtons.jsx';

require('jquery-ui');
$.widget.bridge('uitooltip', $.ui.tooltip); // Shutting down jq-ui tooltips
require('bootstrap');

require('./../superset-select2.js');

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
  if (force) {  // Don't hide the alert message when the page is just loaded
    $('div.alert').remove();
  }
  $('#is_cached').hide();
  prepForm();

  if (pushState !== false) {
    // update the url after prepForm() fix the field ids
    history.pushState({}, document.title, slice.querystring());
  }
  slice.container.html('');
  slice.render(force);
}

function saveSlice() {
  const action = $('input[name=rdo_save]:checked').val();
  if (action === 'saveas') {
    const sliceName = $('input[name=new_slice_name]').val();
    if (sliceName === '') {
      utils.showModal({
        title: 'Error',
        body: 'You must pick a name for the new slice',
      });
      return;
    }
    document.getElementById('slice_name').value = sliceName;
  }
  const addToDash = $('input[name=addToDash]:checked').val();
  if (addToDash === 'existing' && $('#save_to_dashboard_id').val() === '') {
    utils.showModal({
      title: 'Error',
      body: 'You must pick an existing dashboard',
    });
    return;
  } else if (addToDash === 'new' && $('input[name=new_dashboard_name]').val() === '') {
    utils.showModal({
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

function renderExploreActions() {
  const exploreActionsEl = document.getElementById('js-explore-actions');
  ReactDOM.render(
    <ExploreActionButtons
      canDownload={exploreActionsEl.getAttribute('data-can-download')}
      slice={slice}
    />,
    exploreActionsEl
  );
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
  renderExploreActions();
}

let exploreController = {
  type: 'slice',
  done: (sliceObj) => {
    slice = sliceObj;
    renderExploreActions();
    const cachedSelector = $('#is_cached');
    if (slice.data !== undefined && slice.data.is_cached) {
      cachedSelector
      .attr(
        'title',
        `Served from data cached at ${slice.data.cached_dttm}. Click [Query] to force refresh`)
      .show()
      .tooltip('fixTitle');
    } else {
      cachedSelector.hide();
    }
  },
  error: (sliceObj) => {
    slice = sliceObj;
    renderExploreActions();
  },
};
exploreController = Object.assign({}, utils.controllerInterface, exploreController);


$(document).ready(function () {
  const data = $('.slice').data('slice');

  initExploreView();

  slice = px.Slice(data, exploreController);

  // call vis render method, which issues ajax
  // calls render on the slice for the first time
  query(false, false);

  slice.bindResizeToWindowResize();

  initComponents();
});
