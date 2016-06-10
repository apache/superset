// JS
var d3 = window.d3 || require('d3');

// CSS
require('./mapbox.css');

import React from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl';
import MapGL from 'react-map-gl';
import ScatterPlotOverlay from 'react-map-gl/src/overlays/scatterplot.react.js';
import Immutable from 'immutable';
import supercluster from 'supercluster';
import ViewportMercator from 'viewport-mercator-project';

const earthCircumferenceKm = 40075.16;

class ScatterPlotGlowOverlay extends ScatterPlotOverlay {
  _isNumeric(num) {
    return !isNaN(parseFloat(num)) && isFinite(num);
  }

  _drawText(ctx, pixel, fontHeight, label, radius) {
    var maxWidth = radius * 2 * 0.9;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = "black";
    ctx.font = fontHeight + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    var textWidth = ctx.measureText(label).width;
    if (textWidth > maxWidth) {
      var scale = fontHeight / textWidth;
      fontHeight = scale * maxWidth;
      ctx.font = scale * maxWidth + "px sans-serif";
    }

    ctx.fillText(
      label,
      pixel[0],
      pixel[1]
    );
    ctx.globalCompositeOperation = this.props.compositeOperation;
  }

  // Modified from https://github.com/uber/react-map-gl/blob/master/src/overlays/scatterplot.react.js
  _redraw() {
    const milesToKm = 1.60934;
    var pixelRatio = window.devicePixelRatio || 1;
    var canvas = this.refs.overlay;
    var ctx = canvas.getContext('2d');
    var props = this.props;
    var radius = this.props.dotRadius;
    var fill = this.props.dotFill;
    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);
    ctx.clearRect(0, 0, props.width, props.height);
    ctx.globalCompositeOperation = this.props.compositeOperation;
    var mercator = ViewportMercator(this.props);
    var maxCount = -1;
    var clusterLabelMap = [];
    props.locations.forEach(function (location, i) {
      if (location.get("properties").get("cluster")) {
        var clusterLabel = location.get("properties").get("metric")
          ? location.get("properties").get("metric")
          : location.get("properties").get("point_count");

        if (clusterLabel instanceof Immutable.List) {
          clusterLabel = clusterLabel.toArray();
          if (props.aggregatorName == "mean") {
            clusterLabel = d3.mean(clusterLabel);
          } else if (props.aggregatorName == "median") {
            clusterLabel = d3.median(clusterLabel);
          } else if (props.aggregatorName == "stdev") {
            clusterLabel = d3.deviation(clusterLabel);
          } else {
            clusterLabel = d3.variance(clusterLabel);
          }
        }

        clusterLabel = this._isNumeric(clusterLabel)
          ? d3.round(clusterLabel, 2)
          : location.get("properties").get("point_count");
        maxCount = Math.max(clusterLabel, maxCount);
        clusterLabelMap[i] = clusterLabel;
      }
    }, this);

    if ((this.props.renderWhileDragging || !this.props.isDragging) && this.props.locations) {
      this.props.locations.forEach(function _forEach(location, i) {
        var pixel = mercator.project(this.props.lngLatAccessor(location));
        var pixelRounded = [d3.round(pixel[0], 1), d3.round(pixel[1], 1)];
        if (pixelRounded[0] + radius >= 0 &&
            pixelRounded[0] - radius < props.width &&
            pixelRounded[1] + radius >= 0 &&
            pixelRounded[1] - radius < props.height) {
          ctx.beginPath();

          if (location.get("properties").get("cluster")) {
            var clusterLabel = clusterLabelMap[i],
                scaledRadius = d3.round(
                  Math.pow(clusterLabel / maxCount, 0.5) * radius, 1
                );
                var fontHeight = d3.round(scaledRadius * 0.5, 1),
                gradient = ctx.createRadialGradient(
                  pixelRounded[0], pixelRounded[1], scaledRadius,
                  pixelRounded[0], pixelRounded[1], 0
                );

            ctx.arc(pixelRounded[0], pixelRounded[1], scaledRadius, 0, Math.PI * 2);
            gradient.addColorStop(1, "rgba(0, 122, 135, 0.8)");
            gradient.addColorStop(0, "rgba(0, 122, 135, 0)");
            ctx.fillStyle = gradient;
            ctx.fill();

            if (this._isNumeric(clusterLabel)) {
              clusterLabel = clusterLabel >= 10000 ? Math.round(clusterLabel / 1000) + 'k' :
                             clusterLabel >= 1000 ? (Math.round(clusterLabel / 100) / 10) + 'k' : clusterLabel;
              this._drawText(ctx, pixelRounded, fontHeight, clusterLabel, scaledRadius);
            }
          } else {
            var radiusProperty = location.get("properties").get("radius"),
                pointRadius = radiusProperty === null ? radius / 6 : radiusProperty,
                pointLabel,
                pointMetric = location.get("properties").get("metric");

            if (radiusProperty !== null) {
              if (props.pointRadiusUnit === "Kilometers") {
                pointLabel = d3.round(pointRadius, 2) + "km";
                pointRadius = props.kmToPixels(pointRadius, props.latitude, props.zoom);
              } else if (props.pointRadiusUnit === "Miles") {
                pointLabel = d3.round(pointRadius, 2) + "mi";
                pointRadius = props.kmToPixels(pointRadius * milesToKm, props.latitude, props.zoom);
              }
            }

            if (pointMetric && !this._isNumeric(pointMetric)) {
              pointLabel = pointMetric;
            }

            ctx.arc(pixelRounded[0], pixelRounded[1], d3.round(pointRadius, 1), 0, Math.PI * 2);
            ctx.fillStyle = "rgb(0, 122, 135)";
            ctx.fill();

            if (radiusProperty !== null &&
               (props.pointRadiusUnit === "Kilometers" ||
                props.pointRadiusUnit === "Miles" ||
                pointMetric && !this._isNumeric(pointMetric))) {
              var fontHeight = d3.round(pointRadius * 0.5, 1);
              this._drawText(ctx, pixelRounded, fontHeight, pointLabel, pointRadius);
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
    this.state = {
      viewport: {
        longitude: -122.405293,
        latitude: 37.772123,
        zoom: 11,
        startDragLngLat: [37.7577, -89.4376]
      }
    };

    this.onChangeViewport = this.onChangeViewport.bind(this);
  }

  onChangeViewport(viewport) {
    this.setState({
      viewport: viewport
    });
  }

  render() {
    var mercator = ViewportMercator({
        zoom: this.state.viewport.zoom,
        width: this.props.sliceWidth,
        height: this.props.sliceHeight,
        longitude: this.state.viewport.longitude,
        latitude: this.state.viewport.latitude,
      }),
      topLeft = mercator.unproject([0, 0]),
      bottomRight = mercator.unproject([this.props.sliceWidth, this.props.sliceHeight]),
      bbox = [topLeft[0], bottomRight[1], bottomRight[0], topLeft[1]],
      clusters = this.props.clusterer.getClusters(bbox, Math.round(this.state.viewport.zoom));

    return (
      <MapGL
        {...this.state.viewport}
        mapStyle={this.props.mapStyle}
        width={this.props.sliceWidth}
        height={this.props.sliceHeight}
        mapboxApiAccessToken={""}
        onChangeViewport={this.onChangeViewport}>
        <ScatterPlotGlowOverlay
          {...this.state.viewport}
          isDragging={false}
          width={this.props.sliceWidth}
          height={this.props.sliceHeight}
          locations={Immutable.fromJS(clusters)}
          dotRadius={this.props.pointRadius}
          pointRadiusUnit={this.props.pointRadiusUnit}
          kmToPixels={this.props.kmToPixels}
          globalOpacity={1}
          compositeOperation={"screen"}
          renderWhileDragging={true}
          aggregatorName={this.props.aggregatorName}
          lngLatAccessor={function (location) {
            const coordinates = location.get("geometry").get("coordinates");
            return [coordinates.get(0), coordinates.get(1)];
          }}/>
      </MapGL>
    );
  }
}

function kmToPixels(kilometers, latitude, zoomLevel) {
  // Algorithm from: http://wiki.openstreetmap.org/wiki/Zoom_levels
  var latitudeRad = latitude * (Math.PI / 180);
  var kmPerPixel = earthCircumferenceKm * Math.cos(latitudeRad) / Math.pow(2, zoomLevel + 8);
  return d3.round(kilometers / kmPerPixel, 2);
};

function mapbox(slice) {
  const defaultPointRadius = 60;
  var div = d3.select(slice.selector);
  var clusterer;

  var render = function () {

    d3.json(slice.jsonEndpoint(), function (error, json) {

      if (error !== null) {
        slice.error(error.responseText);
        return "";
      }

      var reducer,
          aggName = json.data.aggregatorName;

      if (aggName === "sum" || !json.data.customMetric) {
        reducer = function (a, b) {
          return a + b;
        };
      } else if (aggName === "min") {
        reducer = Math.min;
      } else if (aggName === "max") {
        reducer = Math.max;
      } else {
        reducer = function (a, b) {
          if (a instanceof Array) {
            if (b instanceof Array) {
              return a.concat(b)
            }
            a.push(b);
            return a;
          } else {
            if (b instanceof Array) {
              b.push(a);
              return b
            }
            return [a, b];
          }
        }
      }

      clusterer = supercluster({
        radius: json.data.clusteringRadius,
        maxZoom: 16,
        metricKey: "metric",
        metricReducer: reducer
      });

      clusterer.load(json.data.geoJSON.features);

      div.selectAll("*").remove();
      ReactDOM.render(
        <MapboxViz
          sliceHeight={slice.height()}
          sliceWidth={slice.width()}
          clusterer={clusterer}
          mapStyle={json.data.mapStyle}
          pointRadius={defaultPointRadius}
          pointRadiusUnit={json.data.pointRadiusUnit}
          aggregatorName={aggName}
          kmToPixels={kmToPixels}/>,
        div.node()
      );

      slice.done(json);
    });
  };

  return {
    render: render,
    resize: function () {}
  };
}

module.exports = mapbox;