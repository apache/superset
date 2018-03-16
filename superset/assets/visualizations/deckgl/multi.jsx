import React from 'react';
import ReactDOM from 'react-dom';
import $ from 'jquery';

import DeckGLContainer from './DeckGLContainer';
import { getExploreLongUrl } from '../../javascripts/explore/exploreUtils';
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
    // Filters applied to multi_deck are passed down to underlying charts
    // note that dashboard contextual information (filter_immune_slices and such) aren't
    // taken into consideration here
    let filters = subslice.form_data.filters.concat(fd.filters);
    if (fd.extra_filters) {
      filters = filters.concat(fd.extra_filters);
    }
    const subsliceCopy = {
      ...subslice,
      form_data: {
        ...subslice.form_data,
        filters,
      },
    };

    const url = getExploreLongUrl(subsliceCopy.form_data, 'json');
    $.get(url, (data) => {
      // Late import to avoid circular deps
      const layer = layerGenerators[subsliceCopy.form_data.viz_type](subsliceCopy.form_data, data);
      slice.subSlicesLayers[subsliceCopy.slice_id] = layer; // eslint-disable-line no-param-reassign
      render();
    });
  });
}
module.exports = deckMulti;
