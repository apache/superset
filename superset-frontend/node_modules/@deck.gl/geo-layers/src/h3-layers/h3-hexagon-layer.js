import {
  h3ToGeoBoundary,
  h3GetResolution,
  h3ToGeo,
  geoToH3,
  h3IsPentagon,
  h3Distance,
  edgeLength,
  UNITS
} from 'h3-js';
import {lerp} from 'math.gl';
import {CompositeLayer, createIterable} from '@deck.gl/core';
import {ColumnLayer, PolygonLayer} from '@deck.gl/layers';

// There is a cost to updating the instanced geometries when using highPrecision: false
// This constant defines the distance between two hexagons that leads to "significant
// distortion." Smaller value makes the column layer more sensitive to viewport change.
const UPDATE_THRESHOLD_KM = 10;

// normalize longitudes w.r.t center (refLng), when not provided first vertex
export function normalizeLongitudes(vertices, refLng) {
  refLng = refLng === undefined ? vertices[0][0] : refLng;
  for (const pt of vertices) {
    const deltaLng = pt[0] - refLng;
    if (deltaLng > 180) {
      pt[0] -= 360;
    } else if (deltaLng < -180) {
      pt[0] += 360;
    }
  }
}

// scale polygon vertices w.r.t center (hexId)
export function scalePolygon(hexId, vertices, factor) {
  const [lat, lng] = h3ToGeo(hexId);
  const actualCount = vertices.length;

  // normalize with respect to center
  normalizeLongitudes(vertices, lng);

  // `h3ToGeoBoundary` returns same array object for first and last vertex (closed polygon),
  // if so skip scaling the last vertex
  const vertexCount = vertices[0] === vertices[actualCount - 1] ? actualCount - 1 : actualCount;
  for (let i = 0; i < vertexCount; i++) {
    vertices[i][0] = lerp(lng, vertices[i][0], factor);
    vertices[i][1] = lerp(lat, vertices[i][1], factor);
  }
}

function getHexagonCentroid(getHexagon, object, objectInfo) {
  const hexagonId = getHexagon(object, objectInfo);
  const [lat, lng] = h3ToGeo(hexagonId);
  return [lng, lat];
}

function h3ToPolygon(hexId, coverage = 1) {
  const vertices = h3ToGeoBoundary(hexId, true);

  if (coverage !== 1) {
    // scale and normalize vertices w.r.t to center
    scalePolygon(hexId, vertices, coverage);
  } else {
    // normalize w.r.t to start vertex
    normalizeLongitudes(vertices);
  }

  return vertices;
}

function mergeTriggers(getHexagon, coverage) {
  let trigger;
  if (getHexagon === undefined || getHexagon === null) {
    trigger = coverage;
  } else if (typeof getHexagon === 'object') {
    trigger = Object.assign({}, getHexagon, {coverage});
  } else {
    trigger = {getHexagon, coverage};
  }
  return trigger;
}

const defaultProps = Object.assign({}, PolygonLayer.defaultProps, {
  highPrecision: false,
  coverage: {type: 'number', min: 0, max: 1, value: 1},
  getHexagon: {type: 'accessor', value: x => x.hexagon},
  extruded: true,
  getColor: null
});

/**
 * A subclass of HexagonLayer that uses H3 hexagonIds in data objects
 * rather than centroid lat/longs. The shape of each hexagon is determined
 * based on a single "center" hexagon, which can be selected by passing in
 * a center lat/lon pair. If not provided, the map center will be used.
 *
 * Also sets the `hexagonId` field in the onHover/onClick callback's info
 * objects. Since this is calculated using math, hexagonId will be present
 * even when no corresponding hexagon is in the data set. You can check
 * index !== -1 to see if picking matches an actual object.
 */
export default class H3HexagonLayer extends CompositeLayer {
  shouldUpdateState({changeFlags}) {
    return this._shouldUseHighPrecision()
      ? changeFlags.propsOrDataChanged
      : changeFlags.somethingChanged;
  }

  updateState({props, oldProps, changeFlags}) {
    if (
      changeFlags.dataChanged ||
      (changeFlags.updateTriggers && changeFlags.updateTriggers.getHexagon)
    ) {
      let resolution = -1;
      let hasPentagon = false;
      const {iterable, objectInfo} = createIterable(props.data);
      for (const object of iterable) {
        objectInfo.index++;
        const hexId = props.getHexagon(object, objectInfo);
        // Take the resolution of the first hex
        resolution = resolution < 0 ? h3GetResolution(hexId) : resolution;
        if (h3IsPentagon(hexId)) {
          hasPentagon = true;
          break;
        }
      }
      this.setState({
        resolution,
        edgeLengthKM: resolution >= 0 ? edgeLength(resolution, UNITS.km) : 0,
        hasPentagon
      });
    }

    this._updateVertices(this.context.viewport);
  }

  _shouldUseHighPrecision() {
    const {resolution, hasPentagon} = this.state;
    return this.props.highPrecision || hasPentagon || (resolution >= 0 && resolution <= 5);
  }

  _updateVertices(viewport) {
    if (this._shouldUseHighPrecision()) {
      return;
    }
    const {resolution, edgeLengthKM, centerHex} = this.state;
    if (resolution < 0) {
      return;
    }
    const hex = geoToH3(viewport.latitude, viewport.longitude, resolution);
    if (
      centerHex === hex ||
      (centerHex && h3Distance(centerHex, hex) * edgeLengthKM < UPDATE_THRESHOLD_KM)
    ) {
      return;
    }

    const {pixelsPerMeter} = viewport.distanceScales;

    let vertices = h3ToPolygon(hex);
    const [centerLat, centerLng] = h3ToGeo(hex);

    const [centerX, centerY] = viewport.projectFlat([centerLng, centerLat]);
    vertices = vertices.map(p => {
      const worldPosition = viewport.projectFlat(p);
      worldPosition[0] = (worldPosition[0] - centerX) / pixelsPerMeter[0];
      worldPosition[1] = (worldPosition[1] - centerY) / pixelsPerMeter[1];
      return worldPosition;
    });

    this.setState({centerHex: hex, vertices});
  }

  renderLayers() {
    return this._shouldUseHighPrecision() ? this._renderPolygonLayer() : this._renderColumnLayer();
  }

  _getForwardProps() {
    const {
      elevationScale,
      fp64,
      material,
      coverage,
      extruded,
      wireframe,
      stroked,
      filled,
      lineWidthUnits,
      lineWidthScale,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      // TODO - Deprecate getColor Prop in v8.0
      getColor,
      getFillColor,
      getElevation,
      getLineColor,
      getLineWidth,
      updateTriggers
    } = this.props;

    return {
      elevationScale,
      fp64,
      extruded,
      coverage,
      wireframe,
      stroked,
      filled,
      lineWidthUnits,
      lineWidthScale,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      material,
      getElevation,
      getFillColor: getColor || getFillColor,
      getLineColor,
      getLineWidth,
      updateTriggers: {
        getFillColor: updateTriggers.getColor || updateTriggers.getFillColor,
        getElevation: updateTriggers.getElevation,
        getLineColor: updateTriggers.getLineColor,
        getLineWidth: updateTriggers.getLineWidth
      }
    };
  }

  _renderPolygonLayer() {
    const {data, getHexagon, updateTriggers, coverage} = this.props;

    const SubLayerClass = this.getSubLayerClass('hexagon-cell-hifi', PolygonLayer);
    const forwardProps = this._getForwardProps();

    forwardProps.updateTriggers.getPolygon = mergeTriggers(updateTriggers.getHexagon, coverage);

    return new SubLayerClass(
      forwardProps,
      this.getSubLayerProps({
        id: 'hexagon-cell-hifi',
        updateTriggers: forwardProps.updateTriggers
      }),
      {
        data,
        getPolygon: (object, objectInfo) => {
          const hexagonId = getHexagon(object, objectInfo);
          return h3ToPolygon(hexagonId, coverage);
        }
      }
    );
  }

  _renderColumnLayer() {
    const {data, getHexagon, updateTriggers} = this.props;

    const SubLayerClass = this.getSubLayerClass('hexagon-cell', ColumnLayer);
    const forwardProps = this._getForwardProps();
    forwardProps.updateTriggers.getPosition = updateTriggers.getHexagon;

    return new SubLayerClass(
      forwardProps,
      this.getSubLayerProps({
        id: 'hexagon-cell',
        updateTriggers: forwardProps.updateTriggers
      }),
      {
        data,
        diskResolution: 6, // generate an extruded hexagon as the base geometry
        radius: 1,
        vertices: this.state.vertices,
        getPosition: getHexagonCentroid.bind(null, getHexagon)
      }
    );
  }
}

H3HexagonLayer.defaultProps = defaultProps;
H3HexagonLayer.layerName = 'H3HexagonLayer';
