/* eslint camel-case: 0 */
import $ from 'jquery';
import Mustache from 'mustache';
import vizMap from '../../visualizations/main';
import { getExploreUrl } from '../explore/exploreUtils';
import { applyDefaultFormData } from '../explore/stores/store';
import { t } from '../locales';

const utils = require('./utils');

/* eslint wrap-iife: 0 */
const px = function (state) {
  let slice;
  const timeout = state.common.conf.SUPERSET_WEBSERVER_TIMEOUT;
  function getParam(name) {
    /* eslint no-useless-escape: 0 */
    const formattedName = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + formattedName + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }
  function initFavStars() {
    const baseUrl = '/superset/favstar/';
    // Init star behavihor for favorite
    function show() {
      if ($(this).hasClass('selected')) {
        $(this).html('<i class="fa fa-star"></i>');
      } else {
        $(this).html('<i class="fa fa-star-o"></i>');
      }
    }
    $('.favstar')
    .attr('title', t('Click to favorite/unfavorite'))
    .css('cursor', 'pointer')
    .each(show)
    .each(function () {
      let url = baseUrl + $(this).attr('class_name');
      const star = this;
      url += '/' + $(this).attr('obj_id') + '/';
      $.getJSON(url + 'count/', function (data) {
        if (data.count > 0) {
          $(star).addClass('selected').each(show);
        }
      });
    })
    .click(function () {
      $(this).toggleClass('selected');
      let url = baseUrl + $(this).attr('class_name');
      url += '/' + $(this).attr('obj_id') + '/';
      if ($(this).hasClass('selected')) {
        url += 'select/';
      } else {
        url += 'unselect/';
      }
      $.get(url);
      $(this).each(show);
    })
    .tooltip();
  }
  const Slice = function (data, datasource, controller) {
    const token = $('#token_' + data.slice_id);
    const controls = $('#controls_' + data.slice_id);
    const containerId = 'con_' + data.slice_id;
    const selector = '#' + containerId;
    const container = $(selector);
    const sliceId = data.slice_id;
    const formData = applyDefaultFormData(data.form_data);
    const sliceCell = $(`#${data.slice_id}-cell`);
    slice = {
      data,
      formData,
      container,
      containerId,
      datasource,
      selector,
      getWidgetHeader() {
        return this.container.parents('div.widget').find('.chart-header');
      },
      render_template(s) {
        const context = {
          width: this.width,
          height: this.height,
        };
        return Mustache.render(s, context);
      },
      jsonEndpoint(data) {
        return this.endpoint(data, 'json');
      },
      endpoint(data, endpointType = 'json') {
        let endpoint = getExploreUrl(data, endpointType, this.force);
        if (endpoint.charAt(0) !== '/') {
          // Known issue for IE <= 11:
          // https://connect.microsoft.com/IE/feedbackdetail/view/1002846/pathname-incorrect-for-out-of-document-elements
          endpoint = '/' + endpoint;
        }
        return endpoint;
      },
      d3format(col, number) {
        // uses the utils memoized d3format function and formats based on
        // column level defined preferences
        let format = '.3s';
        if (this.datasource.column_formats[col]) {
          format = this.datasource.column_formats[col];
        }
        return utils.d3format(format, number);
      },
      /* eslint no-shadow: 0 */
      always(data) {
        if (data && data.query) {
          slice.viewSqlQuery = data.query;
        }
      },
      done(payload) {
        Object.assign(data, payload);

        token.find('img.loading').hide();
        container.fadeTo(0.5, 1);
        sliceCell.removeClass('slice-cell-highlight');
        container.show();

        $('.query-and-save button').removeAttr('disabled');
        this.always(data);
        controller.done(this);
      },
      getErrorMsg(xhr) {
        let msg = '';
        if (!xhr.responseText) {
          const status = xhr.status;
          if (status === 0) {
            // This may happen when the worker in gunicorn times out
            msg += (
              t('The server could not be reached. You may want to ' +
              'verify your connection and try again.'));
          } else {
            msg += (t('An unknown error occurred. (Status: %s )', status));
          }
        }
        return msg;
      },
      error(msg, xhr) {
        let errorMsg = msg;
        token.find('img.loading').hide();
        container.fadeTo(0.5, 1);
        sliceCell.removeClass('slice-cell-highlight');
        let errHtml = '';
        let o;
        try {
          o = JSON.parse(msg);
          if (o.error) {
            errorMsg = o.error;
          }
        } catch (e) {
          // pass
        }
        if (errorMsg) {
          errHtml += `<div class="alert alert-danger">${errorMsg}</div>`;
        }
        if (xhr) {
          if (xhr.statusText === 'timeout') {
            errHtml += (
              '<div class="alert alert-warning">' +
              'Query timeout - visualization query are set to time out ' +
              `at ${timeout} seconds.</div>`);
          } else {
            const extendedMsg = this.getErrorMsg(xhr);
            if (extendedMsg) {
              errHtml += `<div class="alert alert-danger">${extendedMsg}</div>`;
            }
          }
        }
        container.html(errHtml);
        container.show();
        $('span.query').removeClass('disabled');
        $('.query-and-save button').removeAttr('disabled');
        this.always(o);
        controller.error(this);
      },
      clearError() {
        $(selector + ' div.alert').remove();
      },
      width() {
        return container.width();
      },
      height() {
        let others = 0;
        const widget = container.parents('.widget');
        const sliceDescription = widget.find('.slice_description');
        if (sliceDescription.is(':visible')) {
          others += widget.find('.slice_description').height() + 25;
        }
        others += widget.find('.chart-header').height();
        return widget.height() - others - 10;
      },
      bindResizeToWindowResize() {
        let resizeTimer;
        const slice = this;
        $(window).on('resize', function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            slice.resize();
          }, 500);
        });
      },
      render(force) {
        if (force === undefined) {
          this.force = false;
        } else {
          this.force = force;
        }
        const formDataExtra = Object.assign({}, formData);
        formDataExtra.extra_filters = controller.effectiveExtraFilters(sliceId);
        controls.find('a.exploreChart').attr('href', getExploreUrl(formDataExtra));
        controls.find('a.exportCSV').attr('href', getExploreUrl(formDataExtra, 'csv'));
        token.find('img.loading').show();
        container.fadeTo(0.5, 0.25);
        sliceCell.addClass('slice-cell-highlight');
        container.css('height', this.height());
        $.ajax({
          url: this.jsonEndpoint(formDataExtra),
          timeout: timeout * 1000,
          success: (queryResponse) => {
            try {
              vizMap[formData.viz_type](this, queryResponse);
              this.done(queryResponse);
            } catch (e) {
              this.error(t('An error occurred while rendering the visualization: %s', e));
            }
          },
          error: (err) => {
            this.error(err.responseText, err);
          },
        });
      },
      resize() {
        this.render();
      },
      addFilter(col, vals, merge = true, refresh = true) {
        controller.addFilter(sliceId, col, vals, merge, refresh);
      },
      setFilter(col, vals, refresh = true) {
        controller.setFilter(sliceId, col, vals, refresh);
      },
      getFilters() {
        return controller.filters[sliceId];
      },
      clearFilter() {
        controller.clearFilter(sliceId);
      },
      removeFilter(col, vals) {
        controller.removeFilter(sliceId, col, vals);
      },
    };
    return slice;
  };
  // Export public functions
  return {
    getParam,
    initFavStars,
    Slice,
  };
};
module.exports = px;
