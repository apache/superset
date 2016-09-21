import $ from 'jquery';
const Mustache = require('mustache');
const utils = require('./utils');
// vis sources
/* eslint camel-case: 0 */
import vizMap from '../../visualizations/main.js';

/* eslint wrap-iife: 0*/
const px = function () {
  let slice;
  function getParam(name) {
    const formattedName = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + formattedName + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }
  function initFavStars() {
    const baseUrl = '/caravel/favstar/';
    // Init star behavihor for favorite
    function show() {
      if ($(this).hasClass('selected')) {
        $(this).html('<i class="fa fa-star"></i>');
      } else {
        $(this).html('<i class="fa fa-star-o"></i>');
      }
    }
    $('.favstar')
      .attr('title', 'Click to favorite/unfavorite')
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
  const Slice = function (data, dashboard) {
    let timer;
    const token = $('#' + data.token);
    const containerId = data.token + '_con';
    const selector = '#' + containerId;
    const container = $(selector);
    const sliceId = data.slice_id;
    let dttm = 0;
    const stopwatch = function () {
      dttm += 10;
      const num = dttm / 1000;
      $('#timer').text(num.toFixed(2) + ' sec');
    };
    let qrystr = '';
    const always = function () {
      // Private f, runs after done and error
      clearInterval(timer);
      $('#timer').removeClass('btn-warning');
    };
    slice = {
      data,
      container,
      containerId,
      selector,
      querystring(params) {
        const newParams = params || {};
        const parser = document.createElement('a');
        parser.href = data.json_endpoint;
        if (dashboard !== undefined) {
          let flts;
          if (newParams.extraFilters === false) {
            flts = '';
          } else {
            flts = dashboard.effectiveExtraFilters(sliceId);
            flts = encodeURIComponent(JSON.stringify(flts));
          }
          qrystr = parser.search + '&extra_filters=' + flts;
        } else if ($('#query').length === 0) {
          qrystr = parser.search;
        } else {
          qrystr = '?' + $('#query').serialize();
        }
        return qrystr;
      },
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
      jsonEndpoint(params) {
        const newParams = params || {};
        const parser = document.createElement('a');
        parser.href = data.json_endpoint;
        let endpoint = parser.pathname + this.querystring({ extraFilters: newParams.extraFilters });
        endpoint += '&json=true';
        endpoint += '&force=' + this.force;
        return endpoint;
      },
      d3format(col, number) {
        // uses the utils memoized d3format function and formats based on
        // column level defined preferences
        const format = this.data.column_formats[col];
        return utils.d3format(format, number);
      },
      /* eslint no-shadow: 0 */
      done(data) {
        clearInterval(timer);
        token.find('img.loading').hide();
        container.show();
        let cachedSelector = null;
        if (dashboard === undefined) {
          cachedSelector = $('#is_cached');
          if (data !== undefined && data.is_cached) {
            cachedSelector
              .attr(
                'title',
                `Served from data cached at ${data.cached_dttm}. Click [Query] to force-refresh`)
              .show()
              .tooltip('fixTitle');
          } else {
            cachedSelector.hide();
          }
        } else {
          const refresh = this.getWidgetHeader().find('.refresh');
          if (data !== undefined && data.is_cached) {
            refresh
              .addClass('danger')
              .attr('title',
                    'Served from data cached at ' + data.cached_dttm +
                    '. Click to force-refresh')
              .tooltip('fixTitle');
          } else {
            refresh
              .removeClass('danger')
              .attr('title', 'Click to force-refresh')
              .tooltip('fixTitle');
          }
        }

        if (data !== undefined) {
          slice.viewSqlQuery = data.query;
        }

        $('#timer').removeClass('label-warning label-danger');
        $('#timer').addClass('label-success');
        $('.query-and-save button').removeAttr('disabled');
        always(data);
      },
      getErrorMsg(xhr) {
        if (xhr.statusText === 'timeout') {
          return 'The request timed out';
        }
        let msg = '';
        if (!xhr.responseText) {
          const status = xhr.status;
          msg += 'An unknown error occurred. (Status: ' + status + ')';
          if (status === 0) {
            // This may happen when the worker in gunicorn times out
            msg += ' Maybe the request timed out?';
          }
        }
        return msg;
      },
      error(msg, xhr) {
        token.find('img.loading').hide();
        let err = msg ? '<div class="alert alert-danger">' + msg + '</div>' : '';
        if (xhr) {
          const extendedMsg = this.getErrorMsg(xhr);
          if (extendedMsg) {
            err += '<div class="alert alert-danger">' + extendedMsg + '</div>';
          }
        }
        container.html(err);
        container.show();
        $('span.query').removeClass('disabled');
        $('#timer').addClass('btn-danger');
        $('.query-and-save button').removeAttr('disabled');
        always(data);
      },
      width() {
        return token.width();
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
        token.find('img.loading').show();
        container.css('height', this.height());
        dttm = 0;
        timer = setInterval(stopwatch, 10);
        $('#timer').removeClass('label-danger label-success');
        $('#timer').addClass('label-warning');
        this.viz.render();
      },
      resize() {
        token.find('img.loading').show();
        container.css('height', this.height());
        this.viz.render();
        this.viz.resize();
      },
      addFilter(col, vals) {
        if (dashboard !== undefined) {
          dashboard.addFilter(sliceId, col, vals);
        }
      },
      setFilter(col, vals) {
        if (dashboard !== undefined) {
          dashboard.setFilter(sliceId, col, vals);
        }
      },
      getFilters() {
        if (dashboard !== undefined) {
          return dashboard.filters[sliceId];
        }
        return false;
      },
      clearFilter() {
        if (dashboard !== undefined) {
          dashboard.clearFilter(sliceId);
        }
      },
      removeFilter(col, vals) {
        if (dashboard !== undefined) {
          dashboard.removeFilter(sliceId, col, vals);
        }
      },
    };
    slice.viz = vizMap[data.form_data.viz_type](slice);
    return slice;
  };
  // Export public functions
  return {
    getParam,
    initFavStars,
    Slice,
  };
}();
module.exports = px;
