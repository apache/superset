import React from 'react';
import { PathLayer } from 'deck.gl';
import DeckGLContainer from './../DeckGLContainer';
import { commonLayerProps, fitViewport } from './common';
import sandboxedEval from '../../../modules/sandbox';
import createAdaptor from '../createAdaptor';

function getLayer(fd, payload, onAddFilter, onTooltip) {
  const c = fd.color_picker;
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  let data = payload.data.features.map(feature => ({
    ...feature,
    path: feature.path,
    width: fd.line_width,
    color: fixedColor,
  }));

  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new PathLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    rounded: true,
    widthScale: 1,
    ...commonLayerProps(fd, onAddFilter, onTooltip),
  });
}

function getPoints(data) {
  let points = [];
  data.forEach((d) => {
    points = points.concat(d.path);
  });
  return points;
}

function deckPath(props) {
  const {
    formData,
    payload,
    setControlValue,
    onAddFilter,
    onTooltip,
    viewport: originalViewport,
  } = props;

  const viewport = formData.autozoom
    ? fitViewport(originalViewport, getPoints(payload.data.features))
    : originalViewport;

  const layer = getLayer(formData, payload, onAddFilter, onTooltip);

  return (
    <DeckGLContainer
      mapboxApiAccessToken={payload.data.mapboxApiKey}
      viewport={viewport}
      layers={[layer]}
      mapStyle={formData.mapbox_style}
      setControlValue={setControlValue}
    />
  );
}

// function deckPath(slice, payload, setControlValue) {
//   const layer = getLayer(slice.formData, payload, slice);
//   let viewport = {
//     ...slice.formData.viewport,
//     width: slice.width(),
//     height: slice.height(),
//   };

//   if (slice.formData.autozoom) {
//     viewport = fitViewport(viewport, getPoints(payload.data.features));
//   }

//   ReactDOM.render(
//     <DeckGLContainer
//       mapboxApiAccessToken={payload.data.mapboxApiKey}
//       viewport={viewport}
//       layers={[layer]}
//       mapStyle={slice.formData.mapbox_style}
//       setControlValue={setControlValue}
//     />,
//     document.getElementById(slice.containerId),
//   );
// }

module.exports = {
  default: createAdaptor(deckPath),
  getLayer,
};
