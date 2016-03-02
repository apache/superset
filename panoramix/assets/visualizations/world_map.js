// JS
var d3 = window.d3 || require('d3');
//var Datamap = require('../vendor/datamaps/datamaps.all.js');
var Datamap = require('datamaps');

// CSS
require('./world_map.css');

function worldMapChart(slice) {
  var render = function () {
    var container = slice.container;
    var div = d3.select(slice.selector);

    container.css('height', slice.height());

    d3.json(slice.jsonEndpoint(), function (error, json) {
      var fd = json.form_data;

      if (error !== null) {
        slice.error(error.responseText);
        return '';
      }
      var ext = d3.extent(json.data, function (d) {
        return d.m1;
      });
      var extRadius = d3.extent(json.data, function (d) {
        return d.m2;
      });
      var radiusScale = d3.scale.linear()
        .domain([extRadius[0], extRadius[1]])
        .range([1, fd.max_bubble_size]);

      json.data.forEach(function (d) {
        d.radius = radiusScale(d.m2);
      });

      var colorScale = d3.scale.linear()
        .domain([ext[0], ext[1]])
        .range(["#FFF", "black"]);

      var d = {};
      for (var i = 0; i < json.data.length; i++) {
        var country = json.data[i];
        country.fillColor = colorScale(country.m1);
        d[country.country] = country;
      }

      var f = d3.format('.3s');

      container.show();

      var map = new Datamap({
        element: slice.container.get(0),
        data: json.data,
        fills: {
          defaultFill: '#ddd'
        },
        geographyConfig: {
          popupOnHover: true,
          highlightOnHover: true,
          borderWidth: 1,
          borderColor: '#fff',
          highlightBorderColor: '#fff',
          highlightFillColor: '#005a63',
          highlightBorderWidth: 1,
          popupTemplate: function (geo, data) {
            return '<div class="hoverinfo"><strong>' + data.name + '</strong><br>' + f(data.m1) + '</div>';
          }
        },
        bubblesConfig: {
          borderWidth: 1,
          borderOpacity: 1,
          borderColor: '#005a63',
          popupOnHover: true,
          radius: null,
          popupTemplate: function (geo, data) {
            return '<div class="hoverinfo"><strong>' + data.name + '</strong><br>' + f(data.m2) + '</div>';
          },
          fillOpacity: 0.5,
          animate: true,
          highlightOnHover: true,
          highlightFillColor: '#005a63',
          highlightBorderColor: 'black',
          highlightBorderWidth: 2,
          highlightBorderOpacity: 1,
          highlightFillOpacity: 0.85,
          exitDelay: 100,
          key: JSON.stringify
        }
      });

      map.updateChoropleth(d);

      if (fd.show_bubbles) {
        map.bubbles(json.data);
        div.selectAll("circle.datamaps-bubble").style('fill', '#005a63');
      }

      slice.done(json);

    });
  };

  return {
    render: render,
    resize: render
  };
}

module.exports = worldMapChart;
