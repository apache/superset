/* eslint-disable no-param-reassign */

import d3 from 'd3';
import React from 'react';
import ReactDOM from 'react-dom';
import MapGL from 'react-map-gl';
import ScatterPlotOverlay from 'react-map-gl/src/overlays/scatterplot.react.js';
import Immutable from 'immutable';
import supercluster from 'supercluster';
import ViewportMercator from 'viewport-mercator-project';
import {
  kmToPixels,
  rgbLuminance,
  isNumeric,
  MILES_PER_KM,
  DEFAULT_LONGITUDE,
  DEFAULT_LATITUDE,
  DEFAULT_ZOOM,
} from '../utils/common';

require('./mapbox.css');

class ScatterPlotGlowOverlay extends ScatterPlotOverlay {
  drawText(ctx, pixel, options = {}) {
    const IS_DARK_THRESHOLD = 110;
    const { fontHeight = 0, label = '', radius = 0, rgb = [0, 0, 0], shadow = false } = options;
    const maxWidth = radius * 1.8;
    const luminance = rgbLuminance(rgb[1], rgb[2], rgb[3]);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = luminance <= IS_DARK_THRESHOLD ? 'white' : 'black';
    ctx.font = fontHeight + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (shadow) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = luminance <= IS_DARK_THRESHOLD ? 'black' : '';
    }

    const textWidth = ctx.measureText(label).width;
    if (textWidth > maxWidth) {
      const scale = fontHeight / textWidth;
      ctx.font = scale * maxWidth + 'px sans-serif';
    }

    ctx.fillText(label, pixel[0], pixel[1]);
    ctx.globalCompositeOperation = this.props.compositeOperation;
    ctx.shadowBlur = 0;
    ctx.shadowColor = '';
  }

  // Modified: https://github.com/uber/react-map-gl/blob/master/src/overlays/scatterplot.react.js
  _redraw() {
    const props = this.props;
    const pixelRatio = window.devicePixelRatio || 1;
    const canvas = this.refs.overlay;
    const ctx = canvas.getContext('2d');
    const radius = props.dotRadius;
    const mercator = ViewportMercator(props);
    const rgb = props.rgb;
    const clusterLabelMap = [];
    let maxLabel = -1;

    props.locations.forEach(function (location, i) {
      if (location.get('properties').get('cluster')) {
        let clusterLabel = location.get('properties').get('metric')
          ? location.get('properties').get('metric')
          : location.get('properties').get('point_count');

        if (clusterLabel instanceof Immutable.List) {
          clusterLabel = clusterLabel.toArray();
          if (props.aggregatorName === 'mean') {
            clusterLabel = d3.mean(clusterLabel);
          } else if (props.aggregatorName === 'median') {
            clusterLabel = d3.median(clusterLabel);
          } else if (props.aggregatorName === 'stdev') {
            clusterLabel = d3.deviation(clusterLabel);
          } else {
            clusterLabel = d3.variance(clusterLabel);
          }
        }

        clusterLabel = isNumeric(clusterLabel)
          ? d3.round(clusterLabel, 2)
          : location.get('properties').get('point_count');
        maxLabel = Math.max(clusterLabel, maxLabel);
        clusterLabelMap[i] = clusterLabel;
      }
    }, this);

    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);
    ctx.clearRect(0, 0, props.width, props.height);
    ctx.globalCompositeOperation = props.compositeOperation;

    if ((props.renderWhileDragging || !props.isDragging) && props.locations) {
      props.locations.forEach(function _forEach(location, i) {
        const pixel = mercator.project(props.lngLatAccessor(location));
        const pixelRounded = [d3.round(pixel[0], 1), d3.round(pixel[1], 1)];

        if (pixelRounded[0] + radius >= 0
              && pixelRounded[0] - radius < props.width
              && pixelRounded[1] + radius >= 0
              && pixelRounded[1] - radius < props.height) {
          ctx.beginPath();
          if (location.get('properties').get('cluster')) {
            let clusterLabel = clusterLabelMap[i];
            const scaledRadius = d3.round(Math.pow(clusterLabel / maxLabel, 0.5) * radius, 1);
            const fontHeight = d3.round(scaledRadius * 0.5, 1);
            const gradient = ctx.createRadialGradient(
              pixelRounded[0], pixelRounded[1], scaledRadius,
              pixelRounded[0], pixelRounded[1], 0
            );

            gradient.addColorStop(1, 'rgba(' + rgb[1] + ', ' + rgb[2] + ', ' + rgb[3] + ', 0.8)');
            gradient.addColorStop(0, 'rgba(' + rgb[1] + ', ' + rgb[2] + ', ' + rgb[3] + ', 0)');
            ctx.arc(pixelRounded[0], pixelRounded[1], scaledRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            if (isNumeric(clusterLabel)) {
              if (clusterLabel >= 10000) {
                clusterLabel = Math.round(clusterLabel / 1000) + 'k';
              } else if (clusterLabel >= 1000) {
                clusterLabel = (Math.round(clusterLabel / 100) / 10) + 'k';
              }
              this.drawText(ctx, pixelRounded, {
                fontHeight,
                label: clusterLabel,
                radius: scaledRadius,
                rgb,
                shadow: true,
              });
            }
          } else {
            const defaultRadius = radius / 6;
            const radiusProperty = location.get('properties').get('radius');
            const pointMetric = location.get('properties').get('metric');
            let pointRadius = radiusProperty === null ? defaultRadius : radiusProperty;
            let pointLabel;

            if (radiusProperty !== null) {
              const pointLatitude = props.lngLatAccessor(location)[1];
              if (props.pointRadiusUnit === 'Kilometers') {
                pointLabel = d3.round(pointRadius, 2) + 'km';
                pointRadius = kmToPixels(pointRadius, pointLatitude, props.zoom);
              } else if (props.pointRadiusUnit === 'Miles') {
                pointLabel = d3.round(pointRadius, 2) + 'mi';
                pointRadius = kmToPixels(pointRadius * MILES_PER_KM, pointLatitude, props.zoom);
              }
            }

            if (pointMetric !== null) {
              pointLabel = isNumeric(pointMetric) ? d3.round(pointMetric, 2) : pointMetric;
            }

            // Fall back to default points if pointRadius wasn't a numerical column
            if (!pointRadius) {
              pointRadius = defaultRadius;
            }

            ctx.arc(pixelRounded[0], pixelRounded[1], d3.round(pointRadius, 1), 0, Math.PI * 2);
            ctx.fillStyle = 'rgb(' + rgb[1] + ', ' + rgb[2] + ', ' + rgb[3] + ')';
            ctx.fill();

            if (pointLabel !== undefined) {
              this.drawText(ctx, pixelRounded, {
                fontHeight: d3.round(pointRadius, 1),
                label: pointLabel,
                radius: pointRadius,
                rgb,
                shadow: false,
              });
            }
          }
        }
      }, this);
    }

    ctx.restore();
  }
}

class MapboxViz extends React.Component {
  constructor(props) {
    super(props);

    const longitude = this.props.viewportLongitude || DEFAULT_LONGITUDE;
    const latitude = this.props.viewportLatitude || DEFAULT_LATITUDE;

    this.state = {
      viewport: {
        longitude,
        latitude,
        zoom: this.props.viewportZoom || DEFAULT_ZOOM,
        startDragLngLat: [longitude, latitude],
      },
    };

    this.onChangeViewport = this.onChangeViewport.bind(this);
  }

  onChangeViewport(viewport) {
    this.setState({
      viewport,
    });
  }

  render() {
    const mercator = ViewportMercator({
      width: this.props.sliceWidth,
      height: this.props.sliceHeight,
      longitude: this.state.viewport.longitude,
      latitude: this.state.viewport.latitude,
      zoom: this.state.viewport.zoom,
    });
    const topLeft = mercator.unproject([0, 0]);
    const bottomRight = mercator.unproject([this.props.sliceWidth, this.props.sliceHeight]);
    const bbox = [topLeft[0], bottomRight[1], bottomRight[0], topLeft[1]];
    const clusters = this.props.clusterer.getClusters(bbox, Math.round(this.state.viewport.zoom));
    const isDragging = this.state.viewport.isDragging === undefined ? false :
                       this.state.viewport.isDragging;

    d3.select('#viewport_longitude').attr('value', this.state.viewport.longitude);
    d3.select('#viewport_latitude').attr('value', this.state.viewport.latitude);
    d3.select('#viewport_zoom').attr('value', this.state.viewport.zoom);

    return (
      <MapGL
        {...this.state.viewport}
        mapStyle={this.props.mapStyle}
        width={this.props.sliceWidth}
        height={this.props.sliceHeight}
        mapboxApiAccessToken={this.props.mapboxApiKey}
        onChangeViewport={this.onChangeViewport}
      >
        <ScatterPlotGlowOverlay
          {...this.state.viewport}
          isDragging={isDragging}
          width={this.props.sliceWidth}
          height={this.props.sliceHeight}
          locations={Immutable.fromJS(clusters)}
          dotRadius={this.props.pointRadius}
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
      </MapGL>
    );
  }
}
MapboxViz.propTypes = {
  aggregatorName: React.PropTypes.string,
  clusterer: React.PropTypes.object,
  globalOpacity: React.PropTypes.number,
  mapStyle: React.PropTypes.string,
  mapboxApiKey: React.PropTypes.string,
  pointRadius: React.PropTypes.number,
  pointRadiusUnit: React.PropTypes.string,
  renderWhileDragging: React.PropTypes.bool,
  rgb: React.PropTypes.array,
  sliceHeight: React.PropTypes.number,
  sliceWidth: React.PropTypes.number,
  viewportLatitude: React.PropTypes.number,
  viewportLongitude: React.PropTypes.number,
  viewportZoom: React.PropTypes.number,
};

function mapbox(slice) {
  const DEFAULT_POINT_RADIUS = 60;
  const DEFAULT_MAX_ZOOM = 16;
  const div = d3.select(slice.selector);
  let clusterer;

  const render = function () {
    d3.json(slice.jsonEndpoint(), function (error, json) {
      if (error !== null) {
        slice.error(error.responseText);
        return;
      }

      // Validate mapbox color
      const rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(json.data.color);
      if (rgb === null) {
        slice.error('Color field must be of form \'rgb(%d, %d, %d)\'');
        return;
      }

      const aggName = json.data.aggregatorName;
      let reducer;

      if (aggName === 'sum' || !json.data.customMetric) {
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
          }
          if (b instanceof Array) {
            b.push(a);
            return b;
          }
          return [a, b];
        };
      }

      clusterer = supercluster({
        radius: json.data.clusteringRadius,
        maxZoom: DEFAULT_MAX_ZOOM,
        metricKey: 'metric',
        metricReducer: reducer,
      });
      clusterer.load(json.data.geoJSON.features);

      div.selectAll('*').remove();
      ReactDOM.render(
        <MapboxViz
          {...json.data}
          rgb={rgb}
          sliceHeight={slice.height()}
          sliceWidth={slice.width()}
          clusterer={clusterer}
          pointRadius={DEFAULT_POINT_RADIUS}
          aggregatorName={aggName}
        />,
        div.node()
      );

      slice.done(json);
    });
  };

  return {
    render,
    resize() {},
  };
}

module.exports = mapbox;
