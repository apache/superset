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

import log from '../../utils/log';

const NO_PICKED_OBJECT = {
  pickedColor: null,
  pickedLayer: null,
  pickedObjectIndex: -1
};

/* eslint-disable max-depth, max-statements */
/**
 * Pick at a specified pixel with a tolerance radius
 * Returns the closest object to the pixel in shape `{pickedColor, pickedLayer, pickedObjectIndex}`
 */
export function getClosestObject({
  pickedColors,
  layers,
  deviceX,
  deviceY,
  deviceRadius,
  deviceRect
}) {
  if (pickedColors) {
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
  }
  return NO_PICKED_OBJECT;
}

/**
 * Examines a picking buffer for unique colors
 * Returns array of unique objects in shape `{x, y, pickedColor, pickedLayer, pickedObjectIndex}`
 */
export function getUniqueObjects({pickedColors, layers}) {
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
