import React from 'react';
import ScatterPlotClusterOverlay from './ScatterPlotClusterOverlay.jsx';
import BaseMapWrapper from './BaseMapWrapper.jsx';
import ViewportMercator from 'viewport-mercator-project';
import Immutable from 'immutable';

const propTypes = {
  isDragging: React.PropTypes.bool,
  sliceWidth: React.PropTypes.number.isRequired,
  sliceHeight: React.PropTypes.number.isRequired,
  pointRadius: React.PropTypes.number.isRequired,
  pointRadiusUnit: React.PropTypes.string,
  rgb: React.PropTypes.array.isRequired,
  globalOpacity: React.PropTypes.number.isRequired,
  renderWhileDragging: React.PropTypes.bool.isRequired,
  aggregatorName: React.PropTypes.string
};

class PointMap extends React.Component {
  render() {
    const mercator = ViewportMercator({
      width: this.props.sliceWidth,
      height: this.props.sliceHeight,
      longitude: this.props.viewport.longitude,
      latitude: this.props.viewport.latitude,
      zoom: this.props.viewport.zoom
    });
    const topLeft = mercator.unproject([0, 0]);
    const bottomRight = mercator.unproject([this.props.sliceWidth, this.props.sliceHeight]);
    const bbox = [topLeft[0], bottomRight[1], bottomRight[0], topLeft[1]];
    const clusters = this.props.clusterer.getClusters(bbox, Math.round(this.props.viewport.zoom));

    return (
      <ScatterPlotClusterOverlay
        {...this.props.viewport}
        isDragging={this.props.isDragging}
        width={this.props.sliceWidth}
        height={this.props.sliceHeight}
        locations={Immutable.fromJS(clusters)}
        pointRadius={this.props.pointRadius}
        pointRadiusUnit={this.props.pointRadiusUnit}
        rgb={this.props.rgb}
        globalOpacity={this.props.globalOpacity}
        compositeOperation={'screen'}
        renderWhileDragging={this.props.renderWhileDragging}
        aggregatorName={this.props.aggregatorName}
        lngLatAccessor={function (location) {
          const coordinates = location.get('geometry').get('coordinates');
          return [coordinates.get(0), coordinates.get(1)];
        }}
      />
    );
  }
}

PointMap.propTypes = propTypes;

export default BaseMapWrapper(PointMap);