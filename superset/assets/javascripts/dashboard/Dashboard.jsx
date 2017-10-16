import React from 'react';
import { render } from 'react-dom';
import d3 from 'd3';
import { Alert } from 'react-bootstrap';
import moment from 'moment';

import GridLayout from './components/GridLayout';
import Header from './components/Header';
import { appSetup } from '../common';
import AlertsWrapper from '../components/AlertsWrapper';
import { t } from '../locales';
import '../../stylesheets/dashboard.css';

const superset = require('../modules/superset');
const urlLib = require('url');
const utils = require('../modules/utils');

let px;

appSetup();

export function getInitialState(boostrapData) {
  const dashboard = Object.assign(
    {},
    utils.controllerInterface,
    boostrapData.dashboard_data,
    { common: boostrapData.common });
  dashboard.firstLoad = true;

  dashboard.posDict = {};
  if (dashboard.position_json) {
    dashboard.position_json.forEach((position) => {
      dashboard.posDict[position.slice_id] = position;
    });
  }
  dashboard.refreshTimer = null;
  const state = Object.assign({}, boostrapData, { dashboard });
  return state;
}

function unload() {
  const message = t('You have unsaved changes.');
  window.event.returnValue = message; // Gecko + IE
  return message; // Gecko + Webkit, Safari, Chrome etc.
}

function onBeforeUnload(hasChanged) {
  if (hasChanged) {
    window.addEventListener('beforeunload', unload);
  } else {
    window.removeEventListener('beforeunload', unload);
  }
}

function renderAlert() {
  render(
    <div className="container-fluid">
      <Alert bsStyle="warning">
        <strong>{t('You have unsaved changes.')}</strong> {t('Click the')} &nbsp;
        <i className="fa fa-save" />&nbsp;
        {t('button on the top right to save your changes.')}
      </Alert>
    </div>,
    document.getElementById('alert-container'),
  );
}

function initDashboardView(dashboard) {
  render(
    <div>
      <AlertsWrapper initMessages={dashboard.common.flash_messages} />
      <Header dashboard={dashboard} />
    </div>,
    document.getElementById('dashboard-header'),
  );
  // eslint-disable-next-line no-param-reassign
  dashboard.reactGridLayout = render(
    <GridLayout dashboard={dashboard} />,
    document.getElementById('grid-container'),
  );

  // Displaying widget controls on hover
  $('.react-grid-item').hover(
    function () {
      $(this).find('.chart-controls').fadeIn(300);
    },
    function () {
      $(this).find('.chart-controls').fadeOut(300);
    },
  );
  $('div.grid-container').css('visibility', 'visible');

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
  px.initFavStars();
  $('[data-toggle="tooltip"]').tooltip({ container: 'body' });
}

export function dashboardContainer(dashboard, datasources, userid) {
  return Object.assign({}, dashboard, {
    type: 'dashboard',
    filters: {},
    curUserId: userid,
    init() {
      this.sliceObjects = [];
      dashboard.slices.forEach((data) => {
        if (data.error) {
          const html = `<div class="alert alert-danger">${data.error}</div>`;
          $(`#slice_${data.slice_id}`).find('.token').html(html);
        } else {
          const slice = px.Slice(data, datasources[data.form_data.datasource], this);
          $(`#slice_${data.slice_id}`).find('a.refresh').click(() => {
            slice.render(true);
          });
          this.sliceObjects.push(slice);
        }
      });
      this.loadPreSelectFilters();
      this.renderSlices(this.sliceObjects);
      this.firstLoad = false;
      this.bindResizeToWindowResize();
    },
    onChange() {
      onBeforeUnload(true);
      renderAlert();
    },
    onSave() {
      onBeforeUnload(false);
      $('#alert-container').html('');
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
      const cachedWhen = moment.utc(data.cached_dttm).fromNow();
      if (data !== undefined && data.is_cached) {
        refresh
        .addClass('danger')
        .attr(
          'title',
          t('Served from data cached %s . Click to force refresh.', cachedWhen))
        .tooltip('fixTitle');
      } else {
        refresh
        .removeClass('danger')
        .attr('title', t('Click to force refresh'))
        .tooltip('fixTitle');
      }
    },
    effectiveExtraFilters(sliceId) {
      const f = [];
      const immuneSlices = this.metadata.filter_immune_slices || [];
      if (sliceId && immuneSlices.includes(sliceId)) {
        // The slice is immune to dashboard filters
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
        if (filteringSliceId === sliceId.toString()) {
          // Filters applied by the slice don't apply to itself
          continue;
        }
        for (const field in this.filters[filteringSliceId]) {
          if (!immuneToFields.includes(field)) {
            f.push({
              col: field,
              op: 'in',
              val: this.filters[filteringSliceId][field],
            });
          }
        }
      }
      return f;
    },
    addFilter(sliceId, col, vals, merge = true, refresh = true) {
      if (
        this.getSlice(sliceId) && (
          ['__from', '__to', '__time_col', '__time_grain', '__time_origin', '__granularity']
            .indexOf(col) >= 0 ||
            this.getSlice(sliceId).formData.groupby.indexOf(col) !== -1
        )
      ) {
        if (!(sliceId in this.filters)) {
          this.filters[sliceId] = {};
        }
        if (!(col in this.filters[sliceId]) || !merge) {
          this.filters[sliceId][col] = vals;

          // d3.merge pass in array of arrays while some value form filter components
          // from and to filter box require string to be process and return
        } else if (this.filters[sliceId][col] instanceof Array) {
          this.filters[sliceId][col] = d3.merge([this.filters[sliceId][col], vals]);
        } else {
          this.filters[sliceId][col] = d3.merge([[this.filters[sliceId][col]], vals])[0] || '';
        }
        if (refresh) {
          this.refreshExcept(sliceId);
        }
      }
      this.updateFilterParamsInUrl();
    },
    readFilters() {
      // Returns a list of human readable active filters
      return JSON.stringify(this.filters, null, '  ');
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
          dash.sliceObjects.forEach((slice) => {
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
    renderSlices(slices, force = false, interval = 0) {
      if (!interval) {
        slices.forEach(slice => slice.render(force));
        return;
      }
      const meta = this.metadata;
      const refreshTime = Math.max(interval, meta.stagger_time || 5000); // default 5 seconds
      if (typeof meta.stagger_refresh !== 'boolean') {
        meta.stagger_refresh = meta.stagger_refresh === undefined ?
          true : meta.stagger_refresh === 'true';
      }
      const delay = meta.stagger_refresh ? refreshTime / (slices.length - 1) : 0;
      slices.forEach((slice, i) => {
        setTimeout(() => slice.render(force), delay * i);
      });
    },
    startPeriodicRender(interval) {
      this.stopPeriodicRender();
      const dash = this;
      const immune = this.metadata.timed_refresh_immune_slices || [];
      const refreshAll = () => {
        const slices = dash.sliceObjects
          .filter(slice => immune.indexOf(slice.data.slice_id) === -1);
        dash.renderSlices(slices, true, interval * 0.2);
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
      const slices = this.sliceObjects.filter(slice =>
        slice.data.slice_id !== sliceId && immune.indexOf(slice.data.slice_id) === -1);
      this.renderSlices(slices);
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
      while (i < this.sliceObjects.length) {
        // when the slice is found, assign to slice and break;
        if (this.sliceObjects[i].data.slice_id === id) {
          slice = this.sliceObjects[i];
          break;
        }
        i++;
      }
      return slice;
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
        url: `/superset/add_slices/${dashboard.id}/`,
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
            title: t('Error'),
            body: t('Sorry, there was an error adding slices to this dashboard: %s', errorMsg),
          });
        },
      });
    },
    updateDashboardTitle(title) {
      this.dashboard_title = title;
      this.onChange();
    },
  });
}

$(document).ready(() => {
  // Getting bootstrapped data from the DOM
  utils.initJQueryAjax();
  const dashboardData = $('.dashboard').data('bootstrap');

  const state = getInitialState(dashboardData);
  px = superset(state);
  const dashboard = dashboardContainer(state.dashboard, state.datasources, state.user_id);
  initDashboardView(dashboard);
  dashboard.init();
});
