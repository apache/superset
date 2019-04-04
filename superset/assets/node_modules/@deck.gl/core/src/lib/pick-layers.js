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

import {drawPickingBuffer, getPixelRatio} from './draw-layers';
import log from '../utils/log';
import assert from '../utils/assert';

const NO_PICKED_OBJECT = {
  pickedColor: null,
  pickedLayer: null,
  pickedObjectIndex: -1
};

/* eslint-disable max-depth, max-statements */
// Pick the closest object at the given (x,y) coordinate
export function pickObject(
  gl,
  {
    layers,
    viewports,
    x,
    y,
    radius,
    layerFilter,
    depth = 1,
    mode,
    onViewportActive,
    pickingFBO,
    lastPickedInfo,
    useDevicePixels
  }
) {
  // Convert from canvas top-left to WebGL bottom-left coordinates
  // And compensate for pixelRatio
  const pixelRatio = getPixelRatio({useDevicePixels});
  const deviceX = Math.round(x * pixelRatio);
  const deviceY = Math.round(gl.canvas.height - y * pixelRatio);
  const deviceRadius = Math.round(radius * pixelRatio);

  const deviceRect = getPickingRect({
    deviceX,
    deviceY,
    deviceRadius,
    deviceWidth: pickingFBO.width,
    deviceHeight: pickingFBO.height
  });

  const result = [];
  const affectedLayers = {};

  for (let i = 0; i < depth; i++) {
    const pickedColors =
      deviceRect &&
      drawAndSamplePickingBuffer(gl, {
        layers,
        viewports,
        onViewportActive,
        useDevicePixels,
        pickingFBO,
        deviceRect,
        layerFilter,
        redrawReason: mode
      });

    const pickInfo =
      (pickedColors &&
        getClosestFromPickingBuffer(gl, {
          pickedColors,
          layers,
          deviceX,
          deviceY,
          deviceRadius,
          deviceRect
        })) ||
      NO_PICKED_OBJECT;

    // Only exclude if we need to run picking again.
    // We need to run picking again if an object is detected AND
    // we have not exhausted the requested depth.
    if (pickInfo.pickedColor && i + 1 < depth) {
      const layerId = pickInfo.pickedColor[3] - 1;
      if (!affectedLayers[layerId]) {
        // backup original colors
        affectedLayers[layerId] = layers[layerId].copyPickingColors();
      }
      layers[layerId].clearPickingColor(pickInfo.pickedColor);
    }

    // This logic needs to run even if no object is picked.
    const processedPickInfos = processPickInfo({
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
    });

    if (processedPickInfos) {
      processedPickInfos.forEach(info => result.push(info));
    }

    // If no object is picked stop.
    if (!pickInfo.pickedColor) {
      break;
    }
  }

  // reset only affected buffers
  Object.keys(affectedLayers).forEach(layerId =>
    layers[layerId].restorePickingColors(affectedLayers[layerId])
  );

  return result;
}

// Pick all objects within the given bounding box
export function pickVisibleObjects(
  gl,
  {
    layers,
    viewports,
    x,
    y,
    width,
    height,
    mode,
    layerFilter,
    onViewportActive,
    pickingFBO,
    useDevicePixels
  }
) {
  // Convert from canvas top-left to WebGL bottom-left coordinates
  // And compensate for pixelRatio
  const pixelRatio = getPixelRatio({useDevicePixels});

  const deviceLeft = Math.round(x * pixelRatio);
  const deviceBottom = Math.round(gl.canvas.height - y * pixelRatio);
  const deviceRight = Math.round((x + width) * pixelRatio);
  const deviceTop = Math.round(gl.canvas.height - (y + height) * pixelRatio);

  const deviceRect = {
    x: deviceLeft,
    y: deviceTop,
    width: deviceRight - deviceLeft,
    height: deviceBottom - deviceTop
  };

  const pickedColors = drawAndSamplePickingBuffer(gl, {
    layers,
    viewports,
    onViewportActive,
    pickingFBO,
    useDevicePixels,
    deviceRect,
    layerFilter,
    redrawReason: mode
  });

  const pickInfos = getUniquesFromPickingBuffer(gl, {pickedColors, layers});

  // Only return unique infos, identified by info.object
  const uniqueInfos = new Map();

  pickInfos.forEach(pickInfo => {
    let info = {
      color: pickInfo.pickedColor,
      layer: null,
      index: pickInfo.pickedObjectIndex,
      picked: true,
      x,
      y,
      width,
      height,
      pixelRatio
    };

    info = getLayerPickingInfo({layer: pickInfo.pickedLayer, info, mode});
    if (!uniqueInfos.has(info.object)) {
      uniqueInfos.set(info.object, info);
    }
  });

  return Array.from(uniqueInfos.values());
}

// HELPER METHODS

// returns pickedColor or null if no pickable layers found.
function drawAndSamplePickingBuffer(
  gl,
  {
    layers,
    viewports,
    onViewportActive,
    useDevicePixels,
    pickingFBO,
    deviceRect,
    layerFilter,
    redrawReason
  }
) {
  assert(deviceRect);
  assert(Number.isFinite(deviceRect.width) && deviceRect.width > 0, '`width` must be > 0');
  assert(Number.isFinite(deviceRect.height) && deviceRect.height > 0, '`height` must be > 0');

  const pickableLayers = layers.filter(layer => layer.isPickable());
  if (pickableLayers.length < 1) {
    return null;
  }

  drawPickingBuffer(gl, {
    layers,
    viewports,
    onViewportActive,
    useDevicePixels,
    pickingFBO,
    deviceRect,
    layerFilter,
    redrawReason
  });

  // Read from an already rendered picking buffer
  // Returns an Uint8ClampedArray of picked pixels
  const {x, y, width, height} = deviceRect;
  const pickedColors = new Uint8Array(width * height * 4);
  pickingFBO.readPixels({x, y, width, height, pixelArray: pickedColors});
  return pickedColors;
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

// Calculate a picking rect centered on deviceX and deviceY and clipped to device
// Returns null if pixel is outside of device
function getPickingRect({deviceX, deviceY, deviceRadius, deviceWidth, deviceHeight}) {
  const valid = deviceX >= 0 && deviceY >= 0 && deviceX < deviceWidth && deviceY < deviceHeight;

  // x, y out of bounds.
  if (!valid) {
    return null;
  }

  // Create a box of size `radius * 2 + 1` centered at [deviceX, deviceY]
  const x = Math.max(0, deviceX - deviceRadius);
  const y = Math.max(0, deviceY - deviceRadius);
  const width = Math.min(deviceWidth, deviceX + deviceRadius) - x + 1;
  const height = Math.min(deviceHeight, deviceY + deviceRadius) - y + 1;

  return {x, y, width, height};
}

// TODO - break this monster function into 3+ parts
function processPickInfo({
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
    }
  }

  const viewport = getViewportFromCoordinates({viewports}); // TODO - add coords

  const baseInfo = {
    color: null,
    layer: null,
    index: -1,
    picked: false,
    x,
    y,
    pixel: [x, y],
    lngLat: viewport.unproject([x, y]),
    devicePixel: [deviceX, deviceY],
    pixelRatio
  };

  // Use a Map to store all picking infos.
  // The following two forEach loops are the result of
  // https://github.com/uber/deck.gl/issues/443
  // Please be very careful when changing this pattern
  const infos = new Map();

  affectedLayers.forEach(layer => {
    let info = Object.assign({}, baseInfo);

    if (layer === pickedLayer) {
      info.color = pickedColor;
      info.index = pickedObjectIndex;
      info.picked = true;
    }

    info = getLayerPickingInfo({layer, info, mode});

    // This guarantees that there will be only one copy of info for
    // one composite layer
    if (info) {
      infos.set(info.layer.id, info);
    }

    const pickingSelectedColor =
      layer.props.autoHighlight && pickedLayer === layer ? pickedColor : null;

    const pickingParameters = {
      pickingSelectedColor
    };

    for (const model of layer.getModels()) {
      model.updateModuleSettings(pickingParameters);
    }
  });

  const unhandledPickInfos = callLayerPickingCallbacks(infos, mode);

  return unhandledPickInfos;
}

// Per-layer event handlers (e.g. onClick, onHover) are provided by the
// user and out of deck.gl's control. It's very much possible that
// the user calls React lifecycle methods in these function, such as
// ReactComponent.setState(). React lifecycle methods sometimes induce
// a re-render and re-generation of props of deck.gl and its layers,
// which invalidates all layers currently passed to this very function.

// Therefore, per-layer event handlers must be invoked at the end
// of the picking operation. NO operation that relies on the states of current
// layers should be called after this code.
function callLayerPickingCallbacks(infos, mode) {
  const unhandledPickInfos = [];

  infos.forEach(info => {
    let handled = false;
    switch (mode) {
      case 'click':
        handled = info.layer.props.onClick(info);
        break;
      case 'hover':
        handled = info.layer.props.onHover(info);
        break;
      case 'query':
        break;
      default:
        throw new Error('unknown pick type');
    }

    if (!handled) {
      unhandledPickInfos.push(info);
    }
  });

  return unhandledPickInfos;
}

/**
 * Pick at a specified pixel with a tolerance radius
 * Returns the closest object to the pixel in shape `{pickedColor, pickedLayer, pickedObjectIndex}`
 */
export function getClosestFromPickingBuffer(
  gl,
  {pickedColors, layers, deviceX, deviceY, deviceRadius, deviceRect}
) {
  assert(pickedColors);

  // Traverse all pixels in picking results and find the one closest to the supplied
  // [deviceX, deviceY]
  const {x, y, width, height} = deviceRect;
  let minSquareDistanceToCenter = deviceRadius * deviceRadius;
  let closestPixelIndex = -1;
  let i = 0;

  for (let row = 0; row < height; row++) {
    const dy = row + y - deviceY;
    const dy2 = dy * dy;

    if (dy2 > minSquareDistanceToCenter) {
      // skip this row
      i += 4 * width;
    } else {
      for (let col = 0; col < width; col++) {
        // Decode picked layer from color
        const pickedLayerIndex = pickedColors[i + 3] - 1;

        if (pickedLayerIndex >= 0) {
          const dx = col + x - deviceX;
          const d2 = dx * dx + dy2;

          if (d2 <= minSquareDistanceToCenter) {
            minSquareDistanceToCenter = d2;
            closestPixelIndex = i;
          }
        }
        i += 4;
      }
    }
  }

  if (closestPixelIndex >= 0) {
    // Decode picked object index from color
    const pickedLayerIndex = pickedColors[closestPixelIndex + 3] - 1;
    const pickedColor = pickedColors.slice(closestPixelIndex, closestPixelIndex + 4);
    const pickedLayer = layers[pickedLayerIndex];
    if (pickedLayer) {
      const pickedObjectIndex = pickedLayer.decodePickingColor(pickedColor);
      return {pickedColor, pickedLayer, pickedObjectIndex};
    }
    log.error('Picked non-existent layer. Is picking buffer corrupt?')();
  }

  return NO_PICKED_OBJECT;
}
/* eslint-enable max-depth, max-statements */

/**
 * Examines a picking buffer for unique colors
 * Returns array of unique objects in shape `{x, y, pickedColor, pickedLayer, pickedObjectIndex}`
 */
function getUniquesFromPickingBuffer(gl, {pickedColors, layers}) {
  const uniqueColors = new Map();

  // Traverse all pixels in picking results and get unique colors
  if (pickedColors) {
    for (let i = 0; i < pickedColors.length; i += 4) {
      // Decode picked layer from color
      const pickedLayerIndex = pickedColors[i + 3] - 1;

      if (pickedLayerIndex >= 0) {
        const pickedColor = pickedColors.slice(i, i + 4);
        const colorKey = pickedColor.join(',');
        // eslint-disable-next-line
        if (!uniqueColors.has(colorKey)) {
          const pickedLayer = layers[pickedLayerIndex];
          // eslint-disable-next-line
          if (pickedLayer) {
            uniqueColors.set(colorKey, {
              pickedColor,
              pickedLayer,
              pickedObjectIndex: pickedLayer.decodePickingColor(pickedColor)
            });
          } else {
            log.error('Picked non-existent layer. Is picking buffer corrupt?')();
          }
        }
      }
    }
  }

  return Array.from(uniqueColors.values());
}

// Walk up the layer composite chain to populate the info object
function getLayerPickingInfo({layer, info, mode}) {
  while (layer && info) {
    // For a composite layer, sourceLayer will point to the sublayer
    // where the event originates from.
    // It provides additional context for the composite layer's
    // getPickingInfo() method to populate the info object
    const sourceLayer = info.layer || layer;
    info.layer = layer;
    // layer.pickLayer() function requires a non-null ```layer.state```
    // object to funtion properly. So the layer refereced here
    // must be the "current" layer, not an "out-dated" / "invalidated" layer
    info = layer.pickLayer({info, mode, sourceLayer});
    layer = layer.parent;
  }
  return info;
}
