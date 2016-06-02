// JS
var d3 = window.d3 || require('d3');

// CSS
require('./mapbox.css');

import mapboxgl from 'mapbox-gl';

function mapbox(slice) {

  var div = d3.select(slice.selector);

  var render = function () {
    d3.json(slice.jsonEndpoint(), function (error, json) {

      if (error !== null) {
        slice.error(error.responseText);
        return '';
      }

      div.selectAll("*").remove();

      mapboxgl.accessToken = '';
      var map = new mapboxgl.Map({
          container: slice.selector.substring(1),
          style: 'mapbox://styles/mapbox/streets-v8'
      });

      slice.done(json);
    });
  };

  var resize = function () {
    console.log("resize");
  };

  return {
    render: render,
    resize: resize
  };
}

module.exports = mapbox;