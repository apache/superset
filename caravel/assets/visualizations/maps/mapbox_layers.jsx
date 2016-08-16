/* eslint global-require: 0 */
const d3 = window.d3 || require('d3');
require('./mapbox.css');

import React from 'react';
import ReactDOM from 'react-dom';
import LayeredMap from './LayeredMap.jsx';

function mapboxLayers(slice) {
  const div = d3.select(slice.selector);

  const render = function () {
    div.selectAll('*').remove();

    ReactDOM.render(
      <LayeredMap
        slice={slice}
      />,
      div.node()
    );
  };

  return {
    render,
    resize: () => {},
  };
}

module.exports = mapboxLayers;
