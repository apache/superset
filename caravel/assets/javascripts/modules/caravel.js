var $ = require('jquery');
var jQuery = $;
var d3 = require('d3');

// vis sources
var sourceMap = {
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
  para: 'parallel_coordinates.js',
  pie: 'nvd3_vis.js',
  box_plot: 'nvd3_vis.js',
  pivot_table: 'pivot_table.js',
  sankey: 'sankey.js',
  sunburst: 'sunburst.js',
  table: 'table.js',
  word_cloud: 'word_cloud.js',
  world_map: 'world_map.js'
};

var color = function () {
  // Color related utility functions go in this object
  var bnbColors = [
    //rausch    hackb      kazan      babu      lima        beach     barol
    '#ff5a5f', '#7b0051', '#007A87', '#00d1c1', '#8ce071', '#ffb400', '#b4a76c',
    '#ff8083', '#cc0086', '#00a1b3', '#00ffeb', '#bbedab', '#ffd266', '#cbc29a',
    '#ff3339', '#ff1ab1', '#005c66', '#00b3a5', '#55d12e', '#b37e00', '#988b4e'
  ];
  var spectrums = {
    blue_white_yellow: ['#00d1c1', 'white', '#ffb400'],
    fire: ['white', 'yellow', 'red', 'black'],
    white_black: ['white', 'black'],
    black_white: ['black', 'white']
  };
  var colorBnb = function () {
    // Color factory
    var seen = {};
    return function (s) {
      if (!s) { return; }
      // next line is for caravel series that should have the same color
      s = s.replace('---', '');
      if (seen[s] === undefined) {
        seen[s] = Object.keys(seen).length;
      }
      return this.bnbColors[seen[s] % this.bnbColors.length];
    };
  };
  var colorScalerFactory = function (colors, data, accessor) {
    // Returns a linear scaler our of an array of color
    if (!Array.isArray(colors)) {
      colors = spectrums[colors];
    }

    var ext = [0, 1];
    if (data !== undefined) {
      ext = d3.extent(data, accessor);
    }

    var points = [];
    var chunkSize = (ext[1] - ext[0]) / colors.length;
    $.each(colors, function (i, c) {
      points.push(i * chunkSize);
    });
    return d3.scale.linear().domain(points).range(colors);
  };
  return {
    bnbColors: bnbColors,
    category21: colorBnb(),
    colorScalerFactory: colorScalerFactory
  };
};

var px = (function () {

  var visualizations = {};
  var slice;

  function getParam(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  function UTC(dttm) {
    return new Date(dttm.getUTCFullYear(), dttm.getUTCMonth(), dttm.getUTCDate(), dttm.getUTCHours(), dttm.getUTCMinutes(), dttm.getUTCSeconds());
  }
  var tickMultiFormat = d3.time.format.multi([
    [".%L", function (d) {
      return d.getMilliseconds();
    }], // If there are millisections, show  only them
    [":%S", function (d) {
      return d.getSeconds();
    }], // If there are seconds, show only them
    ["%a %b %d, %I:%M %p", function (d) {
      return d.getMinutes() !== 0;
    }], // If there are non-zero minutes, show Date, Hour:Minute [AM/PM]
    ["%a %b %d, %I %p", function (d) {
      return d.getHours() !== 0;
    }], // If there are hours that are multiples of 3, show date and AM/PM
    ["%a %b %d, %Y", function (d) {
      return d.getDate() !== 1;
    }], // If not the first of the month, do "month day, year."
    ["%B %Y", function (d) {
      return d.getMonth() !== 0 && d.getDate() === 1;
    }], // If the first of the month, do "month day, year."
    ["%Y", function (d) {
      return true;
    }] // fall back on month, year
  ]);

  function formatDate(dttm) {
    var d = UTC(new Date(dttm));
    //d = new Date(d.getTime() - 1 * 60 * 60 * 1000);
    return tickMultiFormat(d);
  }

  function timeFormatFactory(d3timeFormat) {
    var f = d3.time.format(d3timeFormat);
    return function (dttm) {
      var d = UTC(new Date(dttm));
      return f(d);
    };
  }

  function initFavStars() {
      var baseUrl = '/caravel/favstar/';
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
          var url = baseUrl + $(this).attr("class_name");
          var star = this;
          url += '/' + $(this).attr("obj_id") + '/';
          $.getJSON(url + 'count/', function (data) {
            if (data.count > 0) {
              $(star)
                .addClass('selected')
                .each(show);
              }
          });
        })
        .click(function () {
          $(this).toggleClass('selected');
          var url = baseUrl + $(this).attr("class_name");
          url += '/' + $(this).attr("obj_id") + '/';
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

  var Slice = function (data, dashboard) {
    var timer;
    var token = $('#' + data.token);
    var container_id = data.token + '_con';
    var selector = '#' + container_id;
    var container = $(selector);
    var slice_id = data.slice_id;
    var dttm = 0;
    var stopwatch = function () {
      dttm += 10;
      var num = dttm / 1000;
      $('#timer').text(num.toFixed(2) + " sec");
    };
    var qrystr = '';
    var always = function (data) {
      //Private f, runs after done and error
      clearInterval(timer);
      $('#timer').removeClass('btn-warning');
    };
    slice = {
      data: data,
      container: container,
      container_id: container_id,
      selector: selector,
      querystring: function () {
        var parser = document.createElement('a');
        parser.href = data.json_endpoint;
        if (dashboard !== undefined) {
          var flts = encodeURIComponent(JSON.stringify(dashboard.filters));
          qrystr = parser.search + "&extra_filters=" + flts;
        } else if ($('#query').length === 0) {
          qrystr = parser.search;
        } else {
          qrystr = '?' + $('#query').serialize();
        }
        return qrystr;
      },
      getWidgetHeader: function () {
        return this.container.parents("li.widget").find(".chart-header");
      },
      jsonEndpoint: function () {
        var parser = document.createElement('a');
        parser.href = data.json_endpoint;
        var endpoint = parser.pathname + this.querystring();
        endpoint += "&json=true";
        endpoint += "&force=" + this.force;
        return endpoint;
      },
      done: function (data) {
        clearInterval(timer);
        token.find("img.loading").hide();
        container.show();

        var cachedSelector = null;
        if (dashboard === undefined) {
          cachedSelector = $('#is_cached');
          if (data !== undefined && data.is_cached) {
            cachedSelector
              .attr('title', 'Served from data cached at ' + data.cached_dttm + '. Click to force-refresh')
              .show()
              .tooltip('fixTitle');
          } else {
            cachedSelector.hide();
          }
        } else {
          var refresh = this.getWidgetHeader().find('.refresh');
          if (data !== undefined && data.is_cached) {
            refresh
            .addClass('danger')
            .attr(
              'title',
              'Served from data cached at ' + data.cached_dttm + '. Click to force-refresh')
            .tooltip('fixTitle');
          } else {
            refresh
            .removeClass('danger')
            .attr(
              'title',
              'Click to force-refresh')
            .tooltip('fixTitle');
          }
        }
        if (data !== undefined) {
          $("#query_container").html(data.query);
        }
        $('#timer').removeClass('btn-warning');
        $('#timer').addClass('btn-success');
        $('span.query').removeClass('disabled');
        $('#json').click(function () {
          window.location = data.json_endpoint;
        });
        $('#standalone').click(function () {
          window.location = data.standalone_endpoint;
        });
        $('#csv').click(function () {
          window.location = data.csv_endpoint;
        });
        $('.btn-group.results span,a').removeAttr('disabled');
        $('.query-and-save button').removeAttr('disabled');
        always(data);
      },
      error: function (msg) {
        token.find("img.loading").hide();
        var err = '<div class="alert alert-danger">' + msg + '</div>';
        container.html(err);
        container.show();
        $('span.query').removeClass('disabled');
        $('#timer').addClass('btn-danger');
        $('.btn-group.results span,a').removeAttr('disabled');
        $('.query-and-save button').removeAttr('disabled');
        always(data);
      },
      width: function () {
        return token.width();
      },
      height: function () {
        var others = 0;
        var widget = container.parents('.widget');
        var slice_description = widget.find('.slice_description');
        if (slice_description.is(":visible")) {
          others += widget.find('.slice_description').height() + 25;
        }
        others += widget.find('.chart-header').height();
        return widget.height() - others - 10;
      },
      bindResizeToWindowResize: function () {
        var resizeTimer;
        $(window).on('resize', function (e) {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            slice.resize();
          }, 500);
        });
      },
      render: function (force) {
        if (force === undefined) {
          force = false;
        }
        this.force = force;
        token.find("img.loading").show();
        container.hide();
        container.html('');
        dttm = 0;
        timer = setInterval(stopwatch, 10);
        $('#timer').removeClass('btn-danger btn-success');
        $('#timer').addClass('btn-warning');
        this.viz.render();
      },
      resize: function () {
        token.find("img.loading").show();
        container.hide();
        container.html('');
        this.viz.render();
        this.viz.resize();
      },
      addFilter: function (col, vals) {
        if (dashboard !== undefined) {
          dashboard.addFilter(slice_id, col, vals);
        }
      },
      setFilter: function (col, vals) {
        if (dashboard !== undefined) {
          dashboard.setFilter(slice_id, col, vals);
        }
      },
      clearFilter: function () {
        if (dashboard !== undefined) {
          delete dashboard.clearFilter(slice_id);
        }
      },
      removeFilter: function (col, vals) {
        if (dashboard !== undefined) {
          delete dashboard.removeFilter(slice_id, col, vals);
        }
      }
    };
    var visType = data.form_data.viz_type;
    px.registerViz(visType);
    slice.viz = visualizations[data.form_data.viz_type](slice);
    return slice;
  };

  function registerViz(name) {
    var visSource = sourceMap[name];

    if (visSource) {
      var visFactory = require('../../visualizations/' + visSource);
      if (typeof visFactory === 'function') {
        visualizations[name] = visFactory;
      }
    } else {
      throw new Error("require(" + name + ") failed.");
    }
  }

  // Export public functions
  return {
    registerViz: registerViz,
    Slice: Slice,
    formatDate: formatDate,
    timeFormatFactory: timeFormatFactory,
    color: color(),
    getParam: getParam,
    initFavStars: initFavStars
  };
})();

module.exports = px;
