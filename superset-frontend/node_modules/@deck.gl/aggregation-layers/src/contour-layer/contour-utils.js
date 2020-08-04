import {getCode, getVertices, CONTOUR_TYPE} from './marching-squares';

// Given all the cell weights, generates contours for each threshold.
/* eslint-disable max-depth */
export function generateContours({
  thresholdData,
  colors,
  cellWeights,
  gridSize,
  gridOrigin,
  cellSize
}) {
  const contourSegments = [];
  const contourPolygons = [];
  const width = gridSize[0];
  const height = gridSize[1];

  thresholdData.forEach((data, index) => {
    const {threshold} = data;
    for (let x = -1; x < width; x++) {
      for (let y = -1; y < height; y++) {
        // Get the MarchingSquares code based on neighbor cell weights.
        const {code, meanCode} = getCode({
          cellWeights,
          threshold,
          x,
          y,
          width,
          height
        });
        const opts = {
          gridOrigin,
          cellSize,
          x,
          y,
          width,
          height,
          code,
          meanCode,
          thresholdData: data
        };
        if (Array.isArray(threshold)) {
          opts.type = CONTOUR_TYPE.ISO_BANDS;
          const polygons = getVertices(opts);
          polygons.forEach(polygon => {
            contourPolygons.push({
              vertices: polygon,
              threshold
            });
          });
        } else {
          // Get the intersection vertices based on MarchingSquares code.
          opts.type = CONTOUR_TYPE.ISO_LINES;
          const vertices = getVertices(opts);
          for (let i = 0; i < vertices.length; i += 2) {
            contourSegments.push({
              start: vertices[i],
              end: vertices[i + 1],
              threshold
            });
          }
        }
      }
    }
  });
  return {contourSegments, contourPolygons};
}
/* eslint-enable max-depth */
