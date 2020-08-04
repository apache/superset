import {h3SetToMultiPolygon} from 'h3-js';

import {CompositeLayer, createIterable} from '@deck.gl/core';
import {PolygonLayer} from '@deck.gl/layers';

const defaultProps = Object.assign(
  {
    getHexagons: {type: 'accessor', value: d => d.hexagons}
  },
  PolygonLayer.defaultProps
);

export default class H3ClusterLayer extends CompositeLayer {
  updateState({props, oldProps, changeFlags}) {
    if (
      changeFlags.dataChanged ||
      (changeFlags.updateTriggers && changeFlags.updateTriggers.getHexagons)
    ) {
      const {data, getHexagons} = props;
      const polygons = [];

      const {iterable, objectInfo} = createIterable(data);
      for (const object of iterable) {
        objectInfo.index++;
        const hexagons = getHexagons(object, objectInfo);
        const multiPolygon = h3SetToMultiPolygon(hexagons, true);

        for (const polygon of multiPolygon) {
          polygons.push({polygon, _obj: object, _idx: objectInfo.index});
        }
      }

      this.setState({polygons});
    }
  }

  getPickingInfo({info}) {
    return Object.assign(info, {
      object: info.object && info.object._obj,
      index: info.object && info.object._idx
    });
  }

  getSubLayerAccessor(accessor) {
    if (typeof accessor !== 'function') return accessor;

    return (object, objectInfo) => {
      return accessor(object._obj, objectInfo);
    };
  }

  renderLayers() {
    const {
      elevationScale,
      extruded,
      wireframe,
      filled,
      stroked,
      lineWidthScale,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      lineJointRounded,
      lineMiterLimit,
      lineDashJustified,
      fp64,
      material,

      getFillColor,
      getLineColor,
      getLineWidth,
      getLineDashArray,
      getElevation,
      updateTriggers
    } = this.props;

    const SubLayerClass = this.getSubLayerClass('cluster-region', PolygonLayer);

    return new SubLayerClass(
      {
        fp64,
        filled,
        wireframe,

        extruded,
        elevationScale,

        stroked,
        lineWidthScale,
        lineWidthMinPixels,
        lineWidthMaxPixels,
        lineJointRounded,
        lineMiterLimit,
        lineDashJustified,

        material,

        getFillColor: this.getSubLayerAccessor(getFillColor),
        getLineColor: this.getSubLayerAccessor(getLineColor),
        getLineWidth: this.getSubLayerAccessor(getLineWidth),
        getLineDashArray: this.getSubLayerAccessor(getLineDashArray),
        getElevation: this.getSubLayerAccessor(getElevation)
      },
      this.getSubLayerProps({
        id: 'cluster-region',
        updateTriggers
      }),
      {
        data: this.state.polygons,
        getPolygon: d => d.polygon
      }
    );
  }
}

H3ClusterLayer.defaultProps = defaultProps;
H3ClusterLayer.layerName = 'H3ClusterLayer';
