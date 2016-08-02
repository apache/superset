import $ from 'jquery';
const d3 = require('d3');
const Mustache = require('mustache');
const utils = require('./utils');
// vis sources
/* eslint camel-case: 0 */
const sourceMap = {
  area: 'nvd3_vis.js',
  bar: 'nvd3_vis.js',
  bubble: 'nvd3_vis.js',
  big_number: 'big_number.js',
  big_number_total: 'big_number.js',
  compare: 'nvd3_vis.js',
  dist_bar: 'nvd3_vis.js',
  directed_force: 'directed_force.js',
  filter_box: 'filter_box.js',
  heatmap: 'heatmap.js',
  iframe: 'iframe.js',
  line: 'nvd3_vis.js',
  markup: 'markup.js',
  separator: 'markup.js',
  para: 'parallel_coordinates.js',
  pie: 'nvd3_vis.js',
  box_plot: 'nvd3_vis.js',
  pivot_table: 'pivot_table.js',
  sankey: 'sankey.js',
  sunburst: 'sunburst.js',
  table: 'table.js',
  word_cloud: 'word_cloud.js',
  world_map: 'world_map.js',
  treemap: 'treemap.js',
  cal_heatmap: 'cal_heatmap.js',
  horizon: 'horizon.js',
  mapbox: 'mapbox.jsx',
  histogram: 'histogram.js',
};
const color = function () {
  // Color related utility functions go in this object
  const bnbColors = [
    '#ff5a5f', // rausch
    '#7b0051', // hackb
    '#007A87', // kazan
    '#00d1c1', // babu
    '#8ce071', // lima
    '#ffb400', // beach
    '#b4a76c', // barol
    '#ff8083',
    '#cc0086',
    '#00a1b3',
    '#00ffeb',
    '#bbedab',
    '#ffd266',
    '#cbc29a',
    '#ff3339',
    '#ff1ab1',
    '#005c66',
    '#00b3a5',
    '#55d12e',
    '#b37e00',
    '#988b4e',
  ];
  const spectrums = {
    blue_white_yellow: [
      '#00d1c1',
      'white',
      '#ffb400',
    ],
    fire: [
      'white',
      'yellow',
      'red',
      'black',
    ],
    white_black: [
      'white',
      'black',
    ],
    black_white: [
      'black',
      'white',
    ],
  };
  const colorBnb = function () {
    // Color factory
    const seen = {};
    return function (s) {
      if (!s) {
        return;
      }
      let stringifyS = String(s);
      // next line is for caravel series that should have the same color
      stringifyS = stringifyS.replace('---', '');
      if (seen[stringifyS] === undefined) {
        seen[stringifyS] = Object.keys(seen).length;
      }
      /* eslint consistent-return: 0 */
      return this.bnbColors[seen[stringifyS] % this.bnbColors.length];
    };
  };
  const colorScalerFactory = function (colors, data, accessor) {
    // Returns a linear scaler our of an array of color
    if (!Array.isArray(colors)) {
      /* eslint no-param-reassign: 0 */
      colors = spectrums[colors];
    }
    let ext = [
      0,
      1,
    ];
    if (data !== undefined) {
      ext = d3.extent(data, accessor);
    }
    const points = [];
    const chunkSize = (ext[1] - ext[0]) / colors.length;
    $.each(colors, function (i) {
      points.push(i * chunkSize);
    });
    return d3.scale.linear().domain(points).range(colors);
  };
  return {
    bnbColors,
    category21: colorBnb(),
    colorScalerFactory,
  };
};
/* eslint wrap-iife: 0*/
const px = function () {
  const visualizations = {};
  let slice;
  function getParam(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  }
  function UTC(dttm) {
    return new Date(
      dttm.getUTCFullYear(),
      dttm.getUTCMonth(),
      dttm.getUTCDate(),
      dttm.getUTCHours(),
      dttm.getUTCMinutes(),
      dttm.getUTCSeconds()
    );
  }
  const tickMultiFormat = d3.time.format.multi([
    [
      '.%L',
      function (d) {
        return d.getMilliseconds();
      },
    ],
    // If there are millisections, show  only them
    [
      ':%S',
      function (d) {
        return d.getSeconds();
      },
    ],
    // If there are seconds, show only them
    [
      '%a %b %d, %I:%M %p',
      function (d) {
        return d.getMinutes() !== 0;
      },
    ],
    // If there are non-zero minutes, show Date, Hour:Minute [AM/PM]
    [
      '%a %b %d, %I %p',
      function (d) {
        return d.getHours() !== 0;
      },
    ],
    // If there are hours that are multiples of 3, show date and AM/PM
    [
      '%a %b %d',
      function (d) {
        return d.getDate() !== 1;
      },
    ],
    // If not the first of the month, do "month day, year."
    [
      '%B %Y',
      function (d) {
        return d.getMonth() !== 0 && d.getDate() === 1;
      },
    ],
    // If the first of the month, do "month day, year."
    [
      '%Y',
      function () {
        return true;
      },
    ],  // fall back on month, year
  ]);
  function formatDate(dttm) {
    const d = UTC(new Date(dttm));
    // d = new Date(d.getTime() - 1 * 60 * 60 * 1000);
    return tickMultiFormat(d);
  }
  function timeFormatFactory(d3timeFormat) {
    const f = d3.time.format(d3timeFormat);
    return function (dttm) {
      const d = UTC(new Date(dttm));
      return f(d);
    };
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
    const sliceId = data.sliceId;
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
        params = params || {};
        const parser = document.createElement('a');
        parser.href = data.json_endpoint;
        if (dashboard !== undefined) {
          const flts =
            params.extraFilters === false ? '' :
              encodeURIComponent(JSON.stringify(dashboard.filters));
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
        params = params || {};
        const parser = document.createElement('a');
        parser.href = data.json_endpoint;
        let endpoint = parser.pathname + this.querystring({ extraFilters: params.extraFilters });
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
              .attr('title',
                    'Served from data cached at ' + data.cached_dttm + '. Click to force-refresh')
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
          $('#query_container').html(data.query);
        }
        $('#timer').removeClass('btn-warning');
        $('#timer').addClass('btn-success');
        $('span.view_query').removeClass('disabled');
        $('#json').click(function () {
          window.location = data.json_endpoint;
        });
        $('#csv').click(function () {
          window.location = data.csv_endpoint;
        });
        $('.btn-group.results span,a').removeAttr('disabled');
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
        $('.btn-group.results span,a').removeAttr('disabled');
        $('.query-and-save button').removeAttr('disabled');
        always(data);
      },
      width() {
        return token.width();
      },
      height() {
        let others = 0;
        const widget = container.parents('.widget');
        const sliceDescription = widget.find('.sliceDescription');
        if (sliceDescription.is(':visible')) {
          others += widget.find('.sliceDescription').height() + 25;
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
          force = false;
        }
        this.force = force;
        token.find('img.loading').show();
        container.css('height', this.height());
        dttm = 0;
        timer = setInterval(stopwatch, 10);
        $('#timer').removeClass('btn-danger btn-success');
        $('#timer').addClass('btn-warning');
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
    const visType = data.form_data.viz_type;
    px.registerViz(visType);
    slice.viz = visualizations[data.form_data.viz_type](slice);
    return slice;
  };
  function registerViz(name) {
    const visSource = sourceMap[name];
    if (visSource) {
      /* eslint global-require: 0 */
      const visFactory = require('../../visualizations/' + visSource);
      if (typeof visFactory === 'function') {
        visualizations[name] = visFactory;
      }
    } else {
      throw new Error('require(' + name + ') failed.');
    }
  }
  // Export public functions
  return {
    color: color(),
    formatDate,
    getParam,
    initFavStars,
    registerViz,
    Slice,
    timeFormatFactory,
  };
}();
module.exports = px;
