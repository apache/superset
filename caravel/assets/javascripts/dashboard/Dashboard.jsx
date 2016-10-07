const $ = window.$ = require('jquery');
const jQuery = window.jQuery = require('jquery'); // eslint-disable-line
const px = require('../modules/caravel.js');
const d3 = require('d3');
const urlLib = require('url');
const utils = require('../modules/utils.js');

import React from 'react';
import { render } from 'react-dom';
import SliceAdder from './components/SliceAdder.jsx';
import GridLayout from './components/GridLayout.jsx';

const ace = require('brace');
require('bootstrap');
require('brace/mode/css');
require('brace/theme/crimson_editor');
require('../../stylesheets/dashboard.css');
require('../caravel-select2.js');

// Injects the passed css string into a style sheet with the specified className
// If a stylesheet doesn't exist with the passed className, one will be injected into <head>
function injectCss(className, css) {
  const head = document.head || document.getElementsByTagName('head')[0];
  let style = document.querySelector('.' + className);

  if (!style) {
    if (className.split(' ').length > 1) {
      throw new Error('This method only supports selections with a single class name.');
    }
    style = document.createElement('style');
    style.className = className;
    style.type = 'text/css';
    head.appendChild(style);
  }

  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.innerHTML = css;
  }
}

function dashboardContainer(dashboardData) {
  let dashboard = Object.assign({}, utils.controllerInterface, dashboardData, {
    type: 'dashboard',
    filters: {},
    init() {
      this.initDashboardView();
      this.firstLoad = true;
      px.initFavStars();
      const sliceObjects = [];
      const dash = this;
      dashboard.slices.forEach((data) => {
        if (data.error) {
          const html = '<div class="alert alert-danger">' + data.error + '</div>';
          $('#slice_' + data.slice_id).find('.token').html(html);
        } else {
          const slice = px.Slice(data, dash);
          $('#slice_' + data.slice_id).find('a.refresh').click(() => {
            slice.render(true);
          });
          sliceObjects.push(slice);
        }
      });
      this.slices = sliceObjects;
      this.refreshTimer = null;
      this.loadPreSelectFilters();
      this.startPeriodicRender(0);
      this.bindResizeToWindowResize();
    },
    loadPreSelectFilters() {
      try {
        const filters = JSON.parse(px.getParam('preselect_filters') || '{}');
        for (const sliceId in filters) {
          for (const col in filters[sliceId]) {
            this.setFilter(sliceId, col, filters[sliceId][col], false, false);
          }
        }
      } catch (e) {
        // console.error(e);
      }
    },
    setFilter(sliceId, col, vals, refresh) {
      this.addFilter(sliceId, col, vals, false, refresh);
    },
    done(slice) {
      const refresh = slice.getWidgetHeader().find('.refresh');
      const data = slice.data;
      if (data !== undefined && data.is_cached) {
        refresh
        .addClass('danger')
        .attr('title',
              'Served from data cached at ' + data.cached_dttm +
                '. Click to force refresh')
                .tooltip('fixTitle');
      } else {
        refresh
        .removeClass('danger')
        .attr('title', 'Click to force refresh')
        .tooltip('fixTitle');
      }
    },
    effectiveExtraFilters(sliceId) {
      // Summarized filter, not defined by sliceId
      // returns k=field, v=array of values
      const f = {};
      const immuneSlices = this.metadata.filter_immune_slices || [];
      if (sliceId && immuneSlices.includes(sliceId)) {
        // The slice is immune to dashboard fiterls
        return f;
      }

      // Building a list of fields the slice is immune to filters on
      let immuneToFields = [];
      if (
            sliceId &&
            this.metadata.filter_immune_slice_fields &&
            this.metadata.filter_immune_slice_fields[sliceId]) {
        immuneToFields = this.metadata.filter_immune_slice_fields[sliceId];
      }
      for (const filteringSliceId in this.filters) {
        for (const field in this.filters[filteringSliceId]) {
          if (!immuneToFields.includes(field)) {
            f[field] = this.filters[filteringSliceId][field];
          }
        }
      }
      return f;
    },
    addFilter(sliceId, col, vals, merge = true, refresh = true) {
      if (!(sliceId in this.filters)) {
        this.filters[sliceId] = {};
      }
      if (!(col in this.filters[sliceId]) || !merge) {
        this.filters[sliceId][col] = vals;
      } else {
        this.filters[sliceId][col] = d3.merge([this.filters[sliceId][col], vals]);
      }
      if (refresh) {
        this.refreshExcept(sliceId);
      }
      this.updateFilterParamsInUrl();
    },
    readFilters() {
      // Returns a list of human readable active filters
      return JSON.stringify(this.filters, null, 4);
    },
    updateFilterParamsInUrl() {
      const urlObj = urlLib.parse(location.href, true);
      urlObj.query = urlObj.query || {};
      urlObj.query.preselect_filters = this.readFilters();
      urlObj.search = null;
      history.pushState(urlObj.query, window.title, urlLib.format(urlObj));
    },
    bindResizeToWindowResize() {
      let resizeTimer;
      const dash = this;
      $(window).on('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          dash.slices.forEach((slice) => {
            slice.resize();
          });
        }, 500);
      });
    },
    stopPeriodicRender() {
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
    },
    startPeriodicRender(interval) {
      this.stopPeriodicRender();
      const dash = this;
      const maxRandomDelay = Math.min(interval * 0.2, 5000);
      const refreshAll = function () {
        dash.slices.forEach(function (slice) {
          const force = !dash.firstLoad;
          setTimeout(function () {
            slice.render(force);
          },
          // Randomize to prevent all widgets refreshing at the same time
          maxRandomDelay * Math.random());
        });
        dash.firstLoad = false;
      };

      const fetchAndRender = function () {
        refreshAll();
        if (interval > 0) {
          dash.refreshTimer = setTimeout(function () {
            fetchAndRender();
          }, interval);
        }
      };
      fetchAndRender();
    },
    refreshExcept(sliceId) {
      const immune = this.metadata.filter_immune_slices || [];
      this.slices.forEach(function (slice) {
        if (slice.data.slice_id !== sliceId && immune.indexOf(slice.data.slice_id) === -1) {
          slice.render();
        }
      });
    },
    clearFilters(sliceId) {
      delete this.filters[sliceId];
      this.refreshExcept(sliceId);
      this.updateFilterParamsInUrl();
    },
    removeFilter(sliceId, col, vals) {
      if (sliceId in this.filters) {
        if (col in this.filters[sliceId]) {
          const a = [];
          this.filters[sliceId][col].forEach(function (v) {
            if (vals.indexOf(v) < 0) {
              a.push(v);
            }
          });
          this.filters[sliceId][col] = a;
        }
      }
      this.refreshExcept(sliceId);
      this.updateFilterParamsInUrl();
    },
    getSlice(sliceId) {
      const id = parseInt(sliceId, 10);
      let i = 0;
      let slice = null;
      while (i < this.slices.length) {
        // when the slice is found, assign to slice and break;
        if (this.slices[i].data.slice_id === id) {
          slice = this.slices[i];
          break;
        }
        i++;
      }
      return slice;
    },
    showAddSlice() {
      const slicesOnDashMap = {};
      const layoutPositions = this.reactGridLayout.serialize();
      layoutPositions.forEach((position) => {
        slicesOnDashMap[position.slice_id] = true;
      });
      render(
        <SliceAdder dashboard={dashboard} slicesOnDashMap={slicesOnDashMap} caravel={px} />,
        document.getElementById('add-slice-container')
      );
    },
    getAjaxErrorMsg(error) {
      const respJSON = error.responseJSON;
      return (respJSON && respJSON.message) ? respJSON.message :
              error.responseText;
    },
    addSlicesToDashboard(sliceIds) {
      const getAjaxErrorMsg = this.getAjaxErrorMsg;
      $.ajax({
        type: 'POST',
        url: '/caravel/add_slices/' + dashboard.id + '/',
        data: {
          data: JSON.stringify({ slice_ids: sliceIds }),
        },
        success() {
          // Refresh page to allow for slices to re-render
          window.location.reload();
        },
        error(error) {
          const errorMsg = getAjaxErrorMsg(error);
          utils.showModal({
            title: 'Error',
            body: 'Sorry, there was an error adding slices to this dashboard: </ br>' + errorMsg,
          });
        },
      });
    },
    saveDashboard() {
      const expandedSlices = {};
      $.each($('.slice_info'), function () {
        const widget = $(this).parents('.widget');
        const sliceDescription = widget.find('.slice_description');
        if (sliceDescription.is(':visible')) {
          expandedSlices[$(widget).attr('data-slice-id')] = true;
        }
      });
      const positions = this.reactGridLayout.serialize();
      const data = {
        positions,
        css: this.editor.getValue(),
        expanded_slices: expandedSlices,
      };
      $.ajax({
        type: 'POST',
        url: '/caravel/save_dash/' + dashboard.id + '/',
        data: {
          data: JSON.stringify(data),
        },
        success() {
          utils.showModal({
            title: 'Success',
            body: 'This dashboard was saved successfully.',
          });
        },
        error(error) {
          const errorMsg = this.getAjaxErrorMsg(error);
          utils.showModal({
            title: 'Error',
            body: 'Sorry, there was an error saving this dashboard: </ br>' + errorMsg,
          });
        },
      });
    },
    initDashboardView() {
      this.posDict = {};
      this.position_json.forEach(function (position) {
        this.posDict[position.slice_id] = position;
      }, this);

      this.reactGridLayout = render(
        <GridLayout slices={this.slices} posDict={this.posDict} dashboard={dashboard} />,
        document.getElementById('grid-container')
      );

      this.curUserId = $('.dashboard').data('user');

      dashboard = this;

      // Displaying widget controls on hover
      $('.react-grid-item').hover(
        function () {
          $(this).find('.chart-controls').fadeIn(300);
        },
        function () {
          $(this).find('.chart-controls').fadeOut(300);
        }
      );
      $('div.grid-container').css('visibility', 'visible');
      $('#savedash').click(this.saveDashboard.bind(this));
      $('#add-slice').click(this.showAddSlice.bind(this));

      const editor = ace.edit('dash_css');
      this.editor = editor;
      editor.$blockScrolling = Infinity;

      editor.setTheme('ace/theme/crimson_editor');
      editor.setOptions({
        minLines: 16,
        maxLines: Infinity,
        useWorker: false,
      });
      editor.getSession().setMode('ace/mode/css');

      $('.select2').select2({
        dropdownAutoWidth: true,
      });
      $('#css_template').on('change', function () {
        const css = $(this).find('option:selected').data('css');
        editor.setValue(css);

        $('#dash_css').val(css);
        injectCss('dashboard-template', css);
      });
      $('#filters').click(() => {
        utils.showModal({
          title: '<span class="fa fa-info-circle"></span> Current Global Filters',
          body: 'The following global filters are currently applied:<br/>' +
                dashboard.readFilters(),
        });
      });
      $('#refresh_dash_interval').on('change', function () {
        const interval = $(this).find('option:selected').val() * 1000;
        dashboard.startPeriodicRender(interval);
      });
      $('#refresh_dash').click(() => {
        dashboard.slices.forEach((slice) => {
          slice.render(true);
        });
      });

      $('div.widget').click(function (e) {
        const $this = $(this);
        const $target = $(e.target);

        if ($target.hasClass('slice_info')) {
          $this.find('.slice_description').slideToggle(0, function () {
            $this.find('.refresh').click();
          });
        } else if ($target.hasClass('controls-toggle')) {
          $this.find('.chart-controls').toggle();
        }
      });

      editor.on('change', function () {
        const css = editor.getValue();
        $('#dash_css').val(css);
        injectCss('dashboard-template', css);
      });

      const css = $('.dashboard').data('css');
      injectCss('dashboard-template', css);
    },
  });
  dashboard.init();
  return dashboard;
}

$(document).ready(() => {
  dashboardContainer($('.dashboard').data('dashboard'));
  $('[data-toggle="tooltip"]').tooltip({ container: 'body' });
});
