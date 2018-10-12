import React from 'react';
import ReactDOM from 'react-dom';

import { PolygonLayer } from 'deck.gl';
import _ from 'underscore';
import d3 from 'd3';

import DeckGLContainer from './../DeckGLContainer';

import * as common from './common';
import { colorScalerFactory } from '../../../modules/colors';
import sandboxedEval from '../../../modules/sandbox';

function getPoints(features) {
  return _.flatten(features.map(d => d.polygon), true);
}

function getLayer(formData, payload, slice) {
  const fd = formData;
  const fc = fd.fill_color_picker;
  const sc = fd.stroke_color_picker;
  let data = [...payload.data.features];
  const mainMetric = payload.data.metricLabels.length ? payload.data.metricLabels[0] :  null;

  let colorScaler;
  if (mainMetric) {
    const ext = d3.extent(data, d => d[mainMetric]);
    const scaler = colorScalerFactory(fd.linear_color_scheme, null, null, ext, true);
    colorScaler = (d) => {
      const c = scaler(d[mainMetric]);
      c[3] = (fd.opacity / 100.0) * 255;
      return c;
    };
  }

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new PolygonLayer({
    id: `path-layer-${fd.slice_id}`,
    data,
    filled: fd.filled,
    stroked: fd.stroked,
    getFillColor: colorScaler || [fc.r, fc.g, fc.b, 255 * fc.a],
    getLineColor: [sc.r, sc.g, sc.b, 255 * sc.a],
    getLineWidth: fd.line_width,
    extruded: fd.extruded,
    fp64: true,
    ...common.commonLayerProps(fd, slice),
  });
}

function deckPolygon(slice, payload, setControlValue) {
  const layer = getLayer(slice.formData, payload, slice);
  const fd = slice.formData;
  let viewport = {
    ...slice.formData.viewport,
    width: slice.width(),
    height: slice.height(),
  };

  if (fd.autozoom) {
    viewport = common.fitViewport(viewport, getPoints(payload.data.features));
  }

  ReactDOM.render(
    <DeckGLContainer
      mapboxApiAccessToken={payload.data.mapboxApiKey}
      viewport={viewport}
      layers={[layer]}
      mapStyle={slice.formData.mapbox_style}
      setControlValue={setControlValue}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = {
  default: deckPolygon,
  getLayer,
};
