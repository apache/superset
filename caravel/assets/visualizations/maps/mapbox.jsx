const d3 = window.d3 || require('d3');
require('./mapbox.css');

import React from 'react';
import ReactDOM from 'react-dom';
import PointMap from './PointMap.jsx';

function mapbox(slice) {
  const div = d3.select(slice.selector);

  let render = function () {
    div.selectAll('*').remove();

    ReactDOM.render(
      <PointMap
        slice={slice}
      />,
      div.node()
    );
  };

  return {
    render: render,
    resize: function () {}
  };
}

module.exports = mapbox;
