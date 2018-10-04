import React from 'react';
import { ArcLayer } from 'deck.gl';
import CategoricalDeckGLContainer from '../CategoricalDeckGLContainer';
import { commonLayerProps, fitViewport } from './common';
import createAdaptor from '../createAdaptor';

function getPoints(data) {
  const points = [];
  data.forEach((d) => {
    points.push(d.sourcePosition);
    points.push(d.targetPosition);
  });
  return points;
}

function getLayer(fd, payload, onAddFilter, onTooltip) {
  const data = payload.data.features;
  const sc = fd.color_picker;
  const tc = fd.target_color_picker;
  return new ArcLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    getSourceColor: d => d.sourceColor || d.color || [sc.r, sc.g, sc.b, 255 * sc.a],
    getTargetColor: d => d.targetColor || d.color || [tc.r, tc.g, tc.b, 255 * tc.a],
    strokeWidth: (fd.stroke_width) ? fd.stroke_width : 3,
    ...commonLayerProps(fd, onAddFilter, onTooltip),
  });
}

function deckArc(props) {
  const {
    formData,
    payload,
    setControlValue,
    onAddFilter,
    onTooltip,
    viewport: originalViewport,
  } = props;

  const { autozoom } = formData;

  const viewport = formData.autozoom
    ? fitViewport(originalViewport, getPoints(payload.data.features))
    : originalViewport;

  return (
    <CategoricalDeckGLContainer
      formData={formData}
      mapboxApiKey={payload.data.mapboxApiKey}
      setControlValue={setControlValue}
      viewport={viewport}
      getLayer={getLayer}
      payload={payload}
      onAddFilter={onAddFilter}
      onTooltip={onTooltip}
    />
  );
}

module.exports = {
  default: createAdaptor(deckArc),
  getLayer,
};
