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
import {log} from '@deck.gl/core';

/**
 * "Normalizes" complete or partial GeoJSON data into iterable list of features
 * Can accept GeoJSON geometry or "Feature", "FeatureCollection" in addition
 * to plain arrays and iterables.
 * Works by extracting the feature array or wrapping single objects in an array,
 * so that subsequent code can simply iterate over features.
 *
 * @param {object} geojson - geojson data
 * @param {Object|Array} data - geojson object (FeatureCollection, Feature or
 *  Geometry) or array of features
 * @return {Array|"iteratable"} - iterable list of features
 */
export function getGeojsonFeatures(geojson) {
  // If array, assume this is a list of features
  if (Array.isArray(geojson)) {
    return geojson;
  }

  log.assert(geojson.type, 'GeoJSON does not have type');

  switch (geojson.type) {
    case 'Feature':
      // Wrap the feature in a 'Features' array
      return [geojson];
    case 'FeatureCollection':
      // Just return the 'Features' array from the collection
      log.assert(Array.isArray(geojson.features), 'GeoJSON does not have features array');
      return geojson.features;
    default:
      // Assume it's a geometry, we'll check type in separateGeojsonFeatures
      // Wrap the geometry object in a 'Feature' object and wrap in an array
      return [{geometry: geojson}];
  }
}

// Linearize
export function separateGeojsonFeatures(features) {
  const separated = {
    pointFeatures: [],
    lineFeatures: [],
    polygonFeatures: [],
    polygonOutlineFeatures: []
  };

  for (let featureIndex = 0; featureIndex < features.length; featureIndex++) {
    const feature = features[featureIndex];

    log.assert(feature && feature.geometry, 'GeoJSON does not have geometry');

    const {geometry} = feature;

    const sourceFeature = {
      feature,
      index: featureIndex
    };

    if (geometry.type === 'GeometryCollection') {
      log.assert(Array.isArray(geometry.geometries), 'GeoJSON does not have geometries array');
      const {geometries} = geometry;
      for (let i = 0; i < geometries.length; i++) {
        const subGeometry = geometries[i];
        separateGeometry(subGeometry, separated, sourceFeature);
      }
    } else {
      separateGeometry(geometry, separated, sourceFeature);
    }
  }

  return separated;
}

function separateGeometry(geometry, separated, sourceFeature) {
  const {type, coordinates} = geometry;
  const {pointFeatures, lineFeatures, polygonFeatures, polygonOutlineFeatures} = separated;

  if (!validateGeometry(type, coordinates)) {
    // Avoid hard failure if some features are malformed
    log.warn(`${type} coordinates are malformed`)();
    return;
  }

  // Split each feature, but keep track of the source feature and index (for Multi* geometries)
  switch (type) {
    case 'Point':
      pointFeatures.push({
        geometry,
        sourceFeature
      });
      break;
    case 'MultiPoint':
      coordinates.forEach(point => {
        pointFeatures.push({
          geometry: {type: 'Point', coordinates: point},
          sourceFeature
        });
      });
      break;
    case 'LineString':
      lineFeatures.push({
        geometry,
        sourceFeature
      });
      break;
    case 'MultiLineString':
      // Break multilinestrings into multiple lines
      coordinates.forEach(path => {
        lineFeatures.push({
          geometry: {type: 'LineString', coordinates: path},
          sourceFeature
        });
      });
      break;
    case 'Polygon':
      polygonFeatures.push({
        geometry,
        sourceFeature
      });
      // Break polygon into multiple lines
      coordinates.forEach(path => {
        polygonOutlineFeatures.push({
          geometry: {type: 'LineString', coordinates: path},
          sourceFeature
        });
      });
      break;
    case 'MultiPolygon':
      // Break multipolygons into multiple polygons
      coordinates.forEach(polygon => {
        polygonFeatures.push({
          geometry: {type: 'Polygon', coordinates: polygon},
          sourceFeature
        });
        // Break polygon into multiple lines
        polygon.forEach(path => {
          polygonOutlineFeatures.push({
            geometry: {type: 'LineString', coordinates: path},
            sourceFeature
          });
        });
      });
      break;
    default:
  }
}

/**
 * Returns the source feature that was passed to `separateGeojsonFeatures`
 */
export function unwrapSourceFeature(wrappedFeature) {
  // The feature provided by the user is under `sourceFeature.feature`
  return wrappedFeature.sourceFeature.feature;
}

/**
 * Returns the index of the source feature that was passed to `separateGeojsonFeatures`
 */
export function unwrapSourceFeatureIndex(wrappedFeature) {
  // The index of the feature provided by the user is under `sourceFeature.index`
  return wrappedFeature.sourceFeature.index;
}

/**
 * Simple GeoJSON validation util. For perf reasons we do not validate against the full spec,
 * only the following:
   - geometry.type is supported
   - geometry.coordinate has correct nesting level
 */
const COORDINATE_NEST_LEVEL = {
  Point: 1,
  MultiPoint: 2,
  LineString: 2,
  MultiLineString: 3,
  Polygon: 3,
  MultiPolygon: 4
};

export function validateGeometry(type, coordinates) {
  let nestLevel = COORDINATE_NEST_LEVEL[type];

  log.assert(nestLevel, `Unknown GeoJSON type ${type}`);

  while (coordinates && --nestLevel > 0) {
    coordinates = coordinates[0];
  }

  return coordinates && Number.isFinite(coordinates[0]);
}
