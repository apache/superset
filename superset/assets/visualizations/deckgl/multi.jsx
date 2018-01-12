import React from 'react';
import ReactDOM from 'react-dom';
import $ from 'jquery';

import DeckGLContainer from './DeckGLContainer';
import { getExploreUrl } from '../../javascripts/explore/exploreUtils';
import layerGenerators from './layers';


function deckMulti(slice, payload, setControlValue) {
  if (!slice.subSlicesLayers) {
    slice.subSlicesLayers = {}; // eslint-disable-line no-param-reassign
  }
  const fd = slice.formData;
  const render = () => {
    const viewport = {
      ...fd.viewport,
      width: slice.width(),
      height: slice.height(),
    };
    const layers = Object.keys(slice.subSlicesLayers).map(k => slice.subSlicesLayers[k]);
    ReactDOM.render(
      <DeckGLContainer
        mapboxApiAccessToken={payload.data.mapboxApiKey}
        viewport={viewport}
        layers={layers}
        mapStyle={fd.mapbox_style}
        setControlValue={setControlValue}
      />,
      document.getElementById(slice.containerId),
    );
  };
  render();
  payload.data.slices.forEach((subslice) => {
    const url = getExploreUrl(subslice.form_data, 'json');
    $.get(url, (data) => {
      // Late import to avoid circular deps
      const layer = layerGenerators[subslice.form_data.viz_type](subslice.form_data, data);
      slice.subSlicesLayers[subslice.slice_id] = layer; // eslint-disable-line no-param-reassign
      render();
    });
  });
}
module.exports = deckMulti;
