import React from 'react';
import ReactDOM from 'react-dom';

import { LineLayer } from 'deck.gl';

import DeckGLContainer from './../DeckGLContainer';

import * as common from './common';
import sandboxedEval from '../../../javascripts/modules/sandbox';

let startDttm;
let timeExt;
let curTime = Date.now();

function getLayer(formData, payload, slice) {
  const fd = formData;
  const seq = fd.sequence_duration * 1000;
  const perc = ((Date.now() - startDttm) % seq) / seq;

  curTime = (perc * (timeExt[1] - timeExt[0])) + timeExt[0];
  const timeWidth = (fd.tail_length || 10) * 1000;

  const c = fd.color_picker;
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  const opacityTimeScaler = d3.scale.linear()
    .domain([curTime - timeWidth, curTime])
    .range([0, fixedColor[3]]);
  let data = [];
  payload.data.features.forEach((line) => {
    line.points.forEach((p) => {
      let color;
      if (fd.animate) {
        if (p.dttm >= curTime - timeWidth && p.dttm <= curTime) {
          color = fixedColor.slice();
          color[3] = opacityTimeScaler(p.dttm);
          data.push({
            ...p,
            color,
          });
        }
      } else {
        data.push({
          ...p,
          color: fixedColor,
        });
      }
    });
  });

  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }
  return new LineLayer({
    id: `line-layer-${fd.slice_id}`,
    data,
    strokeWidth: fd.line_width,
    ...common.commonLayerProps(fd, slice),
    getSourcePosition: d => d.source,
    getTargetPosition: d => d.target,
    getColor: d => d.color,
  });
}

function overlayContent() {
  return (
    <div style={{ fontWeight: 'bold' }}>
      {(new Date(curTime)).toISOString().substring(0, 19)}
    </div>);
}

function deckLine(slice, payload, setControlValue) {
  const fd = slice.formData;
  startDttm = Date.now();

  const times = [];
  payload.data.features.forEach((line) => {
    line.points.forEach((p) => {
      times.push(p.dttm);
    });
  });
  timeExt = d3.extent(times);

  const layerGenerator = () => getLayer(fd, payload, slice);
  const viewport = {
    ...fd.viewport,
    width: slice.width(),
    height: slice.height(),
  };
  const overlayF = fd.animate ? overlayContent : () => {};
  ReactDOM.render(
    <DeckGLContainer
      mapboxApiAccessToken={payload.data.mapboxApiKey}
      viewport={viewport}
      layers={[layerGenerator]}
      mapStyle={fd.mapbox_style}
      setControlValue={setControlValue}
      overlayContent={overlayF}
      animate={fd.animate}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = {
  default: deckLine,
  getLayer,
};
