const d3 = window.d3 || require('d3');
require('./mapbox.css');

import React from 'react'
import ReactDOM from 'react-dom';
import supercluster from 'supercluster';
import PointMap from './PointMap.jsx'

function mapbox(slice) {
  const DEFAULT_POINT_RADIUS = 60;
  const DEFAULT_MAX_ZOOM = 16;
  const div = d3.select(slice.selector);
  let clusterer;

  let render = function () {

    d3.json(slice.jsonEndpoint(), function (error, json) {

      if (error !== null) {
        slice.error(error.responseText);
        return '';
      }

      // Validate mapbox color
      const rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(json.data.color);
      if (rgb === null) {
        slice.error('Color field must be of form \'rgb(%d, %d, %d)\'');
        return '';
      }

      const aggName = json.data.aggregatorName;
      let reducer;

      if (aggName === 'sum' || !json.data.customMetric) {
        reducer = function (a, b) {
          return a + b;
        };
      } else if (aggName === 'min') {
        reducer = Math.min;
      } else if (aggName === 'max') {
        reducer = Math.max;
      } else {
        reducer = function (a, b) {
          if (a instanceof Array) {
            if (b instanceof Array) {
              return a.concat(b);
            }
            a.push(b);
            return a;
          } else {
            if (b instanceof Array) {
              b.push(a);
              return b;
            }
            return [a, b];
          }
        };
      }

      clusterer = supercluster({
        radius: json.data.clusteringRadius,
        maxZoom: DEFAULT_MAX_ZOOM,
        metricKey: 'metric',
        metricReducer: reducer
      });
      clusterer.load(json.data.geoJSON.features);

      div.selectAll('*').remove();
      ReactDOM.render(
        <PointMap
          {...json.data}
          rgb={rgb}
          sliceHeight={slice.height()}
          sliceWidth={slice.width()}
          clusterer={clusterer}
          pointRadius={DEFAULT_POINT_RADIUS}
          aggregatorName={aggName}/>,
        div.node()
      );

      slice.done(json);
    });
  };

  return {
    render: render,
    resize: function () {}
  };
}

module.exports = mapbox;
