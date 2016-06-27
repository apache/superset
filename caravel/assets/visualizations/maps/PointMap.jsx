import React from 'react';
import ScatterPlotClusterOverlay from './ScatterPlotClusterOverlay.jsx';
import BaseMapWrapper from './BaseMapWrapper.jsx';
import ViewportMercator from 'viewport-mercator-project';
import Immutable from 'immutable';
import supercluster from 'supercluster';

const DEFAULT_MAX_ZOOM = 16;
const propTypes = {
  isDragging: React.PropTypes.bool.isRequired,
  width: React.PropTypes.number.isRequired,
  height: React.PropTypes.number.isRequired,
  pointRadius: React.PropTypes.number.isRequired,
  pointRadiusUnit: React.PropTypes.string.isRequired,
  globalOpacity: React.PropTypes.number.isRequired,
  renderWhileDragging: React.PropTypes.bool.isRequired,
  geoJSON: React.PropTypes.object.isRequired
};

class PointMapViz extends React.Component {
  constructor(props) {
    super(props);

    const aggName = this.props.aggregatorName;
    const rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(this.props.color);
    let reducer;
    let clusterer;

    // Validate mapbox color
    if (rgb === null) {
      this.props.slice.error('Color field must be of form \'rgb(%d, %d, %d)\'');
      return '';
    }

    if (aggName === 'sum' || !this.props.customMetric) {
      reducer = function (a, b) {
        return a + b;
      };
    } else if (aggName === 'min') {
      reducer = Math.min;
    } else if (aggName === 'max') {
      reducer = Math.max;
    } else {
      reducer = function (a, b) {
        if (a instanceof Array) {
          if (b instanceof Array) {
            return a.concat(b);
          }
          a.push(b);
          return a;
        } else {
          if (b instanceof Array) {
            b.push(a);
            return b;
          }
          return [a, b];
        }
      };
    }

    clusterer = supercluster({
      radius: this.props.clusteringRadius,
      maxZoom: DEFAULT_MAX_ZOOM,
      metricKey: 'metric',
      metricReducer: reducer
    });
    clusterer.load(this.props.geoJSON.features);

    this.state = {
      clusterer: clusterer,
      rgb: rgb
    };
  }

  render() {
    const mercator = ViewportMercator({
      width: this.props.width,
      height: this.props.height,
      longitude: this.props.viewport.longitude,
      latitude: this.props.viewport.latitude,
      zoom: this.props.viewport.zoom
    });
    const topLeft = mercator.unproject([0, 0]);
    const bottomRight = mercator.unproject([this.props.width, this.props.height]);
    const bbox = [topLeft[0], bottomRight[1], bottomRight[0], topLeft[1]];
    const clusters = this.state.clusterer.getClusters(bbox, Math.round(this.props.viewport.zoom));

    return (
      <ScatterPlotClusterOverlay
        {...this.props.viewport}
        isDragging={this.props.isDragging}
        width={this.props.width}
        height={this.props.height}
        locations={Immutable.fromJS(clusters)}
        pointRadius={this.props.pointRadius}
        pointRadiusUnit={this.props.pointRadiusUnit}
        rgb={this.state.rgb}
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

PointMapViz.propTypes = propTypes;

export default BaseMapWrapper(PointMapViz);
