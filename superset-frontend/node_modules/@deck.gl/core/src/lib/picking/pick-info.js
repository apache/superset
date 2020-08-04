// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// TODO - break this monster function into 3+ parts
/* eslint-disable max-depth, max-statements */

export function processPickInfo({
  pickInfo,
  lastPickedInfo,
  mode,
  layers,
  viewports,
  x,
  y,
  deviceX,
  deviceY,
  pixelRatio
}) {
  const {pickedColor, pickedLayer, pickedObjectIndex} = pickInfo;

  const affectedLayers = pickedLayer ? [pickedLayer] : [];

  if (mode === 'hover') {
    // only invoke onHover events if picked object has changed
    const lastPickedObjectIndex = lastPickedInfo.index;
    const lastPickedLayerId = lastPickedInfo.layerId;
    const pickedLayerId = pickedLayer && pickedLayer.props.id;

    // proceed only if picked object changed
    if (pickedLayerId !== lastPickedLayerId || pickedObjectIndex !== lastPickedObjectIndex) {
      if (pickedLayerId !== lastPickedLayerId) {
        // We cannot store a ref to lastPickedLayer in the context because
        // the state of an outdated layer is no longer valid
        // and the props may have changed
        const lastPickedLayer = layers.find(layer => layer.props.id === lastPickedLayerId);
        if (lastPickedLayer) {
          // Let leave event fire before enter event
          affectedLayers.unshift(lastPickedLayer);
        }
      }

      // Update layer manager context
      lastPickedInfo.layerId = pickedLayerId;
      lastPickedInfo.index = pickedObjectIndex;
      lastPickedInfo.info = null;
    }
  }

  const viewport = getViewportFromCoordinates({viewports}); // TODO - add coords
  const coordinate = viewport && viewport.unproject([x, y]);

  const baseInfo = {
    color: null,
    layer: null,
    index: -1,
    picked: false,
    x,
    y,
    pixel: [x, y],
    coordinate,
    // TODO remove the lngLat prop after compatibility check
    lngLat: coordinate,
    devicePixel: [deviceX, deviceY],
    pixelRatio
  };

  // Use a Map to store all picking infos.
  // The following two forEach loops are the result of
  // https://github.com/uber/deck.gl/issues/443
  // Please be very careful when changing this pattern
  const infos = new Map();

  // Make sure infos always contain something even if no layer is affected
  infos.set(null, baseInfo);

  affectedLayers.forEach(layer => {
    let info = Object.assign({}, baseInfo);

    if (layer === pickedLayer) {
      info.color = pickedColor;
      info.index = pickedObjectIndex;
      info.picked = true;
    }

    info = getLayerPickingInfo({layer, info, mode});

    if (layer === pickedLayer && mode === 'hover') {
      lastPickedInfo.info = info;
    }

    // This guarantees that there will be only one copy of info for
    // one composite layer
    if (info) {
      infos.set(info.layer.id, info);
    }

    if (mode === 'hover') {
      const pickingSelectedColor =
        layer.props.autoHighlight && pickedLayer === layer ? pickedColor : null;

      layer.setModuleParameters({
        pickingSelectedColor
      });
      // TODO this needsRedraw logic should be fixed in layer
      layer.setNeedsRedraw();
    }
  });

  return infos;
}

// Walk up the layer composite chain to populate the info object
export function getLayerPickingInfo({layer, info, mode}) {
  while (layer && info) {
    // For a composite layer, sourceLayer will point to the sublayer
    // where the event originates from.
    // It provides additional context for the composite layer's
    // getPickingInfo() method to populate the info object
    const sourceLayer = info.layer || layer;
    info.layer = layer;
    // layer.pickLayer() function requires a non-null ```layer.state```
    // object to function properly. So the layer referenced here
    // must be the "current" layer, not an "out-dated" / "invalidated" layer
    info = layer.pickLayer({info, mode, sourceLayer});
    layer = layer.parent;
  }
  return info;
}

// Indentifies which viewport, if any corresponds to x and y
// Returns first viewport if no match
// TODO - need to determine which viewport we are in
// TODO - document concept of "primary viewport" that matches all coords?
// TODO - static method on Viewport class?
function getViewportFromCoordinates({viewports}) {
  const viewport = viewports[0];
  return viewport;
}
