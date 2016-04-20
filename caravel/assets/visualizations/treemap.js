// JS
var d3 = window.d3 || require('d3');
var px = window.px || require('../javascripts/modules/caravel.js');

// CSS
require('./treemap.css');

/* Modified from https://bl.ocks.org/mbostock/4063582 */
function treemap(slice) {

  var div = d3.select(slice.selector);

  var _draw = function (data, eltWidth, eltHeight, includeTitle) {

    var margin = { top: 0, right: 0, bottom: 0, left: 0 },
        headerHeight = includeTitle ? 30 : 0,
        width = eltWidth - margin.left - margin.right,
        height = eltHeight - headerHeight - margin.top - margin.bottom;

    var treemap = d3.layout.treemap()
        .size([width, height])
        .value(function (d) { return d.value; });

    var root = div.append("div")
        .classed("treemap-container", true);

    var header = root.append("div")
        .style("width", (width + margin.left + margin.right) + "px")
        .style("height", headerHeight + "px");

    var container = root.append("div")
        .style("position", "relative")
        .style("width", (width + margin.left + margin.right) + "px")
        .style("height", (height + margin.top + margin.bottom) + "px")
        .style("left", margin.left + "px")
        .style("top", margin.top + "px");

    var position = function (selection) {
      selection.style("left", function (d) { return d.x + "px"; })
               .style("top", function (d) { return d.y + "px"; })
               .style("width", function (d) { return Math.max(0, d.dx - 1) + "px"; })
               .style("height", function (d) { return Math.max(0, d.dy - 1) + "px"; });
    };

    container.datum(data).selectAll(".node")
        .data(treemap.nodes)
      .enter().append("div")
        .attr("class", "node")
        .call(position)
        .style("background", function (d) {
          return d.children ? px.color.category21(d.name) : null;
        })
        .style("color", function (d) {
          // detect if our background is dark and we need a
          // light text color or vice-versa
          var bg = d.parent ? px.color.category21(d.parent.name) : null;
          if (bg) {
            return d3.hsl(bg).l < 0.35 ? '#d3d3d3' : '#111111';
          }
        })
        .text(function (d) { return d.children ? null : d.name; });

    if (includeTitle) {
      // title to help with multiple metrics (if any)
      header.append("span")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text(data.name);
    }

  };

  var render = function () {

    d3.json(slice.jsonEndpoint(), function (error, json) {

      if (error !== null) {
        slice.error(error.responseText);
        return '';
      }

      div.selectAll("*").remove();
      var width = slice.width();
      // facet muliple metrics (no sense in combining)
      var height = slice.height() / json.data.length;
      var includeTitles = json.data.length > 1;
      for (var i = 0, l = json.data.length; i < l; i ++) {
        _draw(json.data[i], width, height, includeTitles);
      }

      slice.done(json);

    });

  };

  return {
    render: render,
    resize: render
  };
}

module.exports = treemap;

