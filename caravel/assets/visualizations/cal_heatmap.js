// JS
var d3 = window.d3 || require('d3');

// CSS
require('./cal_heatmap.css');
require('../node_modules/cal-heatmap/cal-heatmap.css');

var CalHeatMap = require('cal-heatmap');

function calHeatmap(slice) {

  var div = d3.select(slice.selector);
  var cal = new CalHeatMap();

  var render = function () {
    d3.json(slice.jsonEndpoint(), function (error, json) {

      if (error !== null) {
        slice.error(error.responseText);
        return '';
      }

      div.selectAll("*").remove();
      cal = new CalHeatMap();

      var timestamps = json.data["timestamps"],
          extents = d3.extent(Object.keys(timestamps), function (key) {
            return timestamps[key];
          }),
          step = (extents[1] - extents[0]) / 5;

      try {
        cal.init({
          start: json.data["start"],
          data: timestamps,
          itemSelector: slice.selector,
          tooltip: true,
          domain: json.data["domain"],
          subDomain: json.data["subdomain"],
          range: json.data["range"],
          browsing: true,
          legend: [extents[0], extents[0]+step, extents[0]+step*2, extents[0]+step*3]
        });
      } catch (e) {
        slice.error(e);
      }

      slice.done(json);
    });
  };

  return {
    render: render,
    resize: render
  };
}

module.exports = calHeatmap;
