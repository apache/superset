import React from 'react';
import ViewportMercator from 'viewport-mercator-project';
import COMPOSITE_TYPES from 'canvas-composite-types';
import Immutable from 'immutable';
import {
  kmToPixels,
  rgbLuminance,
  isNumeric,
  MILES_PER_KM
} from '../../utils/utils';

const propTypes = {
  width: React.PropTypes.number.isRequired,
  height: React.PropTypes.number.isRequired,
  latitude: React.PropTypes.number.isRequired,
  longitude: React.PropTypes.number.isRequired,
  zoom: React.PropTypes.number.isRequired,
  isDragging: React.PropTypes.bool.isRequired,
  locations: React.PropTypes.instanceOf(Immutable.List).isRequired,
  lngLatAccessor: React.PropTypes.func.isRequired,
  renderWhileDragging: React.PropTypes.bool,
  globalOpacity: React.PropTypes.number.isRequired,
  pointRadius: React.PropTypes.number.isRequired,
  pointRadiusUnit: React.PropTypes.string,
  rgb: React.PropTypes.array.isRequired,
  aggregatorName: React.PropTypes.string,
  compositeOperation: React.PropTypes.oneOf(COMPOSITE_TYPES).isRequired
};

// Modified: https://github.com/uber/react-map-gl/blob/master/src/overlays/scatterplot.react.js
class ScatterPlotClusterOverlay extends React.Component {
  componentDidMount() {
    this.drawPoints();
  }

  componentDidUpdate() {
    this.drawPoints();
  }

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

  drawPoints() {
    const props = this.props;
    const pixelRatio = window.devicePixelRatio || 1;
    const canvas = this.refs.overlay;
    const ctx = canvas.getContext('2d');
    const radius = props.pointRadius;
    const mercator = ViewportMercator(props);
    const rgb = props.rgb;
    let maxLabel = -1;
    let clusterLabelMap = [];

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
              clusterLabel = clusterLabel >= 10000 ? Math.round(clusterLabel / 1000) + 'k' :
                             clusterLabel >= 1000 ? (Math.round(clusterLabel / 100) / 10) + 'k' :
                             clusterLabel;
              this.drawText(ctx, pixelRounded, {
                fontHeight: fontHeight,
                label: clusterLabel,
                radius: scaledRadius,
                rgb: rgb,
                shadow: true
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
                rgb: rgb,
                shadow: false
              });
            }
          }
        }
      }, this);
    }

    ctx.restore();
  }

  render() {
    const pixelRatio = window.devicePixelRatio || 1;
    const style = {
      width: this.props.width + 'px',
      height: this.props.height + 'px',
      position: 'absolute',
      pointerEvents: 'none',
      opacity: this.props.globalOpacity,
      left: 0,
      top: 0
    }

    return (
      <canvas
        ref={'overlay'}
        width={this.props.width * pixelRatio}
        height={this.props.height * pixelRatio}
        style={style}
      />
    )
  }
}

ScatterPlotClusterOverlay.propTypes = propTypes;

export default ScatterPlotClusterOverlay;
