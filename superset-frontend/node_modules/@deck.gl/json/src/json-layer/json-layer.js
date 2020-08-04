import {CompositeLayer} from '@deck.gl/core';
import {getJSONLayers} from '../parsers/convert-json';

const defaultProps = {
  // Optionally accept JSON strings by parsing them
  fetch: dataString => JSON.parse(dataString),
  configuration: []
};

export default class JSONLayer extends CompositeLayer {
  initializeState() {
    this.state = {
      layers: []
    };
  }

  updateState({props, oldProps, changeFlags}) {
    const layersChanged = changeFlags.dataChanged || props.configuration !== oldProps.configuration;

    if (layersChanged) {
      this.state.layers = getJSONLayers(props.data, props.configuration);
    }
  }

  renderLayers() {
    return this.state.layers;
  }
}

JSONLayer.layerName = 'JSONLayer';
JSONLayer.defaultProps = defaultProps;
