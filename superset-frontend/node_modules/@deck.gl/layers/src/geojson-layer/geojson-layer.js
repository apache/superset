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

import {CompositeLayer} from '@deck.gl/core';
import ScatterplotLayer from '../scatterplot-layer/scatterplot-layer';
import PathLayer from '../path-layer/path-layer';
import {PhongMaterial} from '@luma.gl/core';
// Use primitive layer to avoid "Composite Composite" layers for now
import SolidPolygonLayer from '../solid-polygon-layer/solid-polygon-layer';

import {
  getGeojsonFeatures,
  separateGeojsonFeatures,
  unwrapSourceFeature,
  unwrapSourceFeatureIndex
} from './geojson';

const defaultLineColor = [0, 0, 0, 255];
const defaultFillColor = [0, 0, 0, 255];
const defaultMaterial = new PhongMaterial();

const defaultProps = {
  stroked: true,
  filled: true,
  extruded: false,
  wireframe: false,

  lineWidthUnits: 'meters',
  lineWidthScale: 1,
  lineWidthMinPixels: 0,
  lineWidthMaxPixels: Number.MAX_SAFE_INTEGER,
  lineJointRounded: false,
  lineMiterLimit: 4,

  elevationScale: 1,

  pointRadiusScale: 1,
  pointRadiusMinPixels: 0, //  min point radius in pixels
  pointRadiusMaxPixels: Number.MAX_SAFE_INTEGER, // max point radius in pixels

  lineDashJustified: false,
  fp64: false,

  // Line and polygon outline color
  getLineColor: {type: 'accessor', value: defaultLineColor},
  // Point and polygon fill color
  getFillColor: {type: 'accessor', value: defaultFillColor},
  // Point radius
  getRadius: {type: 'accessor', value: 1},
  // Line and polygon outline accessors
  getLineWidth: {type: 'accessor', value: 1},
  // Line dash array accessor
  getLineDashArray: {type: 'accessor', value: [0, 0]},
  // Polygon extrusion accessor
  getElevation: {type: 'accessor', value: 1000},
  // Optional material for 'lighting' shader module
  material: defaultMaterial
};

function getCoordinates(f) {
  return f.geometry.coordinates;
}

/**
 * Unwraps the real source feature passed into props and passes as the argument to `accessor`.
 */
function unwrappingAccessor(accessor) {
  if (typeof accessor !== 'function') return accessor;

  return feature => accessor(unwrapSourceFeature(feature));
}

export default class GeoJsonLayer extends CompositeLayer {
  initializeState() {
    this.state = {
      features: {}
    };
  }

  updateState({oldProps, props, changeFlags}) {
    if (changeFlags.dataChanged) {
      const {data} = props;
      const features = getGeojsonFeatures(data);
      this.state.features = separateGeojsonFeatures(features);
    }
  }

  getPickingInfo({info, sourceLayer}) {
    // `info.index` is the index within the particular sub-layer
    // We want to expose the index of the feature the user provided

    return Object.assign(info, {
      // override object with picked feature
      object: info.object ? unwrapSourceFeature(info.object) : info.object,
      index: info.object ? unwrapSourceFeatureIndex(info.object) : info.index
    });
  }

  /* eslint-disable complexity */
  renderLayers() {
    const {features} = this.state;
    const {pointFeatures, lineFeatures, polygonFeatures, polygonOutlineFeatures} = features;

    // Layer composition props
    const {stroked, filled, extruded, wireframe, material, transitions} = this.props;

    // Rendering props underlying layer
    const {
      lineWidthUnits,
      lineWidthScale,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      lineJointRounded,
      lineMiterLimit,
      pointRadiusScale,
      pointRadiusMinPixels,
      pointRadiusMaxPixels,
      elevationScale,
      lineDashJustified,
      fp64
    } = this.props;

    // Accessor props for underlying layers
    const {
      getLineColor,
      getFillColor,
      getRadius,
      getLineWidth,
      getLineDashArray,
      getElevation,
      updateTriggers
    } = this.props;

    const PolygonFillLayer = this.getSubLayerClass('polygons-fill', SolidPolygonLayer);
    const PolygonStrokeLayer = this.getSubLayerClass('polygons-stroke', PathLayer);
    const LineStringsLayer = this.getSubLayerClass('line-strings', PathLayer);
    const PointsLayer = this.getSubLayerClass('points', ScatterplotLayer);

    // Filled Polygon Layer
    const polygonFillLayer =
      this.shouldRenderSubLayer('polygons-fill', polygonFeatures) &&
      new PolygonFillLayer(
        {
          fp64,
          extruded,
          elevationScale,
          filled,
          wireframe,
          material,
          getElevation: unwrappingAccessor(getElevation),
          getFillColor: unwrappingAccessor(getFillColor),
          getLineColor: unwrappingAccessor(getLineColor),

          transitions: transitions && {
            getPolygon: transitions.geometry,
            getElevation: transitions.getElevation,
            getFillColor: transitions.getFillColor,
            getLineColor: transitions.getLineColor
          }
        },
        this.getSubLayerProps({
          id: 'polygons-fill',
          updateTriggers: {
            getElevation: updateTriggers.getElevation,
            getFillColor: updateTriggers.getFillColor,
            getLineColor: updateTriggers.getLineColor
          }
        }),
        {
          data: polygonFeatures,
          getPolygon: getCoordinates
        }
      );

    const polygonLineLayer =
      !extruded &&
      stroked &&
      this.shouldRenderSubLayer('polygons-stroke', polygonOutlineFeatures) &&
      new PolygonStrokeLayer(
        {
          fp64,
          widthUnits: lineWidthUnits,
          widthScale: lineWidthScale,
          widthMinPixels: lineWidthMinPixels,
          widthMaxPixels: lineWidthMaxPixels,
          rounded: lineJointRounded,
          miterLimit: lineMiterLimit,
          dashJustified: lineDashJustified,

          getColor: unwrappingAccessor(getLineColor),
          getWidth: unwrappingAccessor(getLineWidth),
          getDashArray: unwrappingAccessor(getLineDashArray),

          transitions: transitions && {
            getPath: transitions.geometry,
            getColor: transitions.getLineColor,
            getWidth: transitions.getLineWidth
          }
        },
        this.getSubLayerProps({
          id: 'polygons-stroke',
          updateTriggers: {
            getColor: updateTriggers.getLineColor,
            getWidth: updateTriggers.getLineWidth,
            getDashArray: updateTriggers.getLineDashArray
          }
        }),
        {
          data: polygonOutlineFeatures,
          getPath: getCoordinates
        }
      );

    const pathLayer =
      this.shouldRenderSubLayer('linestrings', lineFeatures) &&
      new LineStringsLayer(
        {
          fp64,
          widthUnits: lineWidthUnits,
          widthScale: lineWidthScale,
          widthMinPixels: lineWidthMinPixels,
          widthMaxPixels: lineWidthMaxPixels,
          rounded: lineJointRounded,
          miterLimit: lineMiterLimit,
          dashJustified: lineDashJustified,

          getColor: unwrappingAccessor(getLineColor),
          getWidth: unwrappingAccessor(getLineWidth),
          getDashArray: unwrappingAccessor(getLineDashArray),

          transitions: transitions && {
            getPath: transitions.geometry,
            getColor: transitions.getLineColor,
            getWidth: transitions.getLineWidth
          }
        },
        this.getSubLayerProps({
          id: 'line-strings',
          updateTriggers: {
            getColor: updateTriggers.getLineColor,
            getWidth: updateTriggers.getLineWidth,
            getDashArray: updateTriggers.getLineDashArray
          }
        }),
        {
          data: lineFeatures,
          getPath: getCoordinates
        }
      );

    const pointLayer =
      this.shouldRenderSubLayer('points', pointFeatures) &&
      new PointsLayer(
        {
          fp64,
          stroked,
          filled,
          radiusScale: pointRadiusScale,
          radiusMinPixels: pointRadiusMinPixels,
          radiusMaxPixels: pointRadiusMaxPixels,
          lineWidthUnits,
          lineWidthScale,
          lineWidthMinPixels,
          lineWidthMaxPixels,

          getFillColor: unwrappingAccessor(getFillColor),
          getLineColor: unwrappingAccessor(getLineColor),
          getRadius: unwrappingAccessor(getRadius),
          getLineWidth: unwrappingAccessor(getLineWidth),

          transitions: transitions && {
            getPosition: transitions.geometry,
            getFillColor: transitions.getFillColor,
            getLineColor: transitions.getLineColor,
            getRadius: transitions.getRadius,
            getLineWidth: transitions.getLineWidth
          }
        },
        this.getSubLayerProps({
          id: 'points',
          updateTriggers: {
            getFillColor: updateTriggers.getFillColor,
            getLineColor: updateTriggers.getLineColor,
            getRadius: updateTriggers.getRadius,
            getLineWidth: updateTriggers.getLineWidth
          }
        }),
        {
          data: pointFeatures,
          getPosition: getCoordinates
        }
      );

    return [
      // If not extruded: flat fill layer is drawn below outlines
      !extruded && polygonFillLayer,
      polygonLineLayer,
      pathLayer,
      pointLayer,
      // If extruded: draw fill layer last for correct blending behavior
      extruded && polygonFillLayer
    ];
  }
  /* eslint-enable complexity */
}

GeoJsonLayer.layerName = 'GeoJsonLayer';
GeoJsonLayer.defaultProps = defaultProps;
