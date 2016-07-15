// JS
var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
var d3 = window.d3 || require('d3');

// CSS
require('./filter_box.css');
require('../javascripts/caravel-select2.js');

function filterBox(slice) {
  var filtersObj = {};
  var d3token = d3.select(slice.selector);

  var fltChanged = function () {
    var val = $(this).val();
    var vals = [];
    if (val !== '') {
      vals = val.split(',');
    }
    slice.setFilter($(this).attr('name'), vals);
  };

  var sortAlphabetically = function (data) {
    data.sort(function (a, b) {
      return String(a.text).localeCompare(b.text);
    });
  };

  var sortByMetric = function (data) {
    data.sort(function (a, b) {
      return -(a.metric - b.metric);
    });
  };

  var refresh = function () {
    d3token.selectAll("*").remove();
    var container = d3token
      .append('div')
      .classed('padded', true);

    var preSelectDict = slice.getFilters() || {};
    $.getJSON(slice.jsonEndpoint({
        // filter box should ignore the filters
        // otherwise there will be only a few options in the dropdown menu
        extraFilters: false
    }), function (payload) {
        var maxes = {};

        Object.keys(payload.data).forEach(function (filter) {
          var data = payload.data[filter];
          var sortedBy = 'metric';
          maxes[filter] = d3.max(data, function (d) {
            return d.metric;
          });
          var id = 'fltbox__' + filter;

          var div = container.append('div');

          div.append("label").text(filter);

          var button = div.append('a')
            .attr('href', '#')
            .classed('pull-right', true)
            .on('click', function (d) {
              if (sortedBy === 'metric') {
                sortAlphabetically(data);
                sortedBy = 'alphabet';
              } else {
                sortByMetric(data);
                sortedBy = 'metric';
              }

              updateButtonLabel();
              d3.event.preventDefault();
            });
          var updateButtonLabel = function () {
            button.text(sortedBy === "metric" ?
              "Alphabetic order" : "Order by metric");
          };
          updateButtonLabel();
          div.append('div')
            .attr('name', filter)
            .classed('form-control', true)
            .attr('multiple', '')
            .attr('id', id);

          filtersObj[filter] = $('#' + id).select2({
            placeholder: "Select [" + filter + ']',
            containment: 'parent',
            dropdownAutoWidth: true,
            data: function () {
              return {
                results: data
              };
            },
            multiple: true,
            formatResult: select2Formatter
          })
            .on('change', fltChanged);

          var preSelect = preSelectDict[filter];
          if (preSelect !== undefined) {
           filtersObj[filter].select2('val', preSelect);
          }
        });
        slice.done(payload);

        function select2Formatter(result, container /*, query, escapeMarkup*/) {
          var perc = Math.round((result.metric / maxes[result.filter]) * 100);
          var style = 'padding: 2px 5px;';
          style += "background-image: ";
          style += "linear-gradient(to right, lightgrey, lightgrey " + perc + "%, rgba(0,0,0,0) " + perc + "%";

          $(container).attr('style', 'padding: 0px; background: white;');
          $(container).addClass('filter_box');
          return '<div style="' + style + '"><span>' + result.text + '</span></div>';
        }
      })
      .fail(function (xhr) {
        slice.error(xhr.responseText, xhr);
      });
  };
  return {
    render: refresh,
    resize: refresh
  };
}

module.exports = filterBox;
