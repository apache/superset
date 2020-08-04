import {CompositeLayer} from '@deck.gl/core';
import GPUGridAggregator from '../utils/gpu-grid-aggregation/gpu-grid-aggregator';
import GPUGridLayer from '../gpu-grid-layer/gpu-grid-layer';
import CPUGridLayer from '../cpu-grid-layer/cpu-grid-layer';

const defaultProps = Object.assign({}, GPUGridLayer.defaultProps, CPUGridLayer.defaultProps, {
  gpuAggregation: false
});

export default class GridLayer extends CompositeLayer {
  initializeState() {
    this.state = {
      useGPUAggregation: true
    };
  }

  updateState({oldProps, props, changeFlags}) {
    const newState = {};
    newState.useGPUAggregation = this.canUseGPUAggregation(props);
    this.setState(newState);
  }

  renderLayers() {
    const {data, updateTriggers} = this.props;
    const id = this.state.useGPUAggregation ? 'GPU' : 'CPU';
    const LayerType = this.state.useGPUAggregation
      ? this.getSubLayerClass('GPU', GPUGridLayer)
      : this.getSubLayerClass('CPU', CPUGridLayer);
    return new LayerType(
      this.props,
      this.getSubLayerProps({
        id,
        updateTriggers
      }),
      {
        data
      }
    );
  }

  // Private methods

  canUseGPUAggregation(props) {
    const {
      gpuAggregation,
      lowerPercentile,
      upperPercentile,
      getColorValue,
      getElevationValue
    } = props;
    if (!gpuAggregation) {
      // cpu aggregation is requested
      return false;
    }
    if (!GPUGridAggregator.isSupported(this.context.gl)) {
      return false;
    }
    if (lowerPercentile !== 0 || upperPercentile !== 100) {
      // percentile calculations requires sorting not supported on GPU
      return false;
    }
    if (getColorValue !== null || getElevationValue !== null) {
      // accessor for custom color or elevation calculation is specified
      return false;
    }
    return true;
  }
}

GridLayer.layerName = 'GridLayer';
GridLayer.defaultProps = defaultProps;
