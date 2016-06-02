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

  _drawText(ctx, pixel, fontHeight, label, radius, rgb, shadow) {
    var maxWidth = radius * 2 * 0.9;
    // Formula: https://en.wikipedia.org/wiki/Relative_luminance
    var luminance = 0.2126*rgb[1] + 0.7152*rgb[2] + 0.0722*rgb[3];

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = luminance <= 110 ? "white" : "black";
    ctx.font = fontHeight + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (shadow) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = luminance <= 110 ? "black" : "";
    }

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
    ctx.shadowBlur = 0;
    ctx.shadowColor = "";
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
          if (props.aggregatorName === "mean") {
            clusterLabel = d3.mean(clusterLabel);
          } else if (props.aggregatorName === "median") {
            clusterLabel = d3.median(clusterLabel);
          } else if (props.aggregatorName === "stdev") {
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
    var rgb = props.rgb;

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
                ),
                fontHeight = d3.round(scaledRadius * 0.5, 1),
                gradient = ctx.createRadialGradient(
                  pixelRounded[0], pixelRounded[1], scaledRadius,
                  pixelRounded[0], pixelRounded[1], 0
                );

            ctx.arc(pixelRounded[0], pixelRounded[1], scaledRadius, 0, Math.PI * 2);
            gradient.addColorStop(1, "rgba(" + rgb[1] + ", " + rgb[2] + ", " + rgb[3] + ", 0.8)");
            gradient.addColorStop(0, "rgba(" + rgb[1] + ", " + rgb[2] + ", " + rgb[3] + ", 0)");
            ctx.fillStyle = gradient;
            ctx.fill();

            if (this._isNumeric(clusterLabel)) {
              clusterLabel = clusterLabel >= 10000 ? Math.round(clusterLabel / 1000) + 'k' :
                             clusterLabel >= 1000 ? (Math.round(clusterLabel / 100) / 10) + 'k' : clusterLabel;
              this._drawText(ctx, pixelRounded, fontHeight, clusterLabel, scaledRadius, rgb, true);
            }
          } else {
            var defaultRadius = radius / 6,
                radiusProperty = location.get("properties").get("radius"),
                pointRadius = radiusProperty === null ? defaultRadius : radiusProperty,
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

            if (pointMetric !== null) {
              pointLabel = this._isNumeric(pointMetric) ? d3.round(pointMetric, 2) : pointMetric;
            }

            // Fall back to default points if pointRadius wasn't a numerical column
            if (!pointRadius) {
              pointRadius = defaultRadius;
            }

            ctx.arc(pixelRounded[0], pixelRounded[1], d3.round(pointRadius, 1), 0, Math.PI * 2);
            ctx.fillStyle = "rgb(" + rgb[1] + ", " + rgb[2] + ", " + rgb[3] + ")";
            ctx.fill();

            if (pointLabel !== undefined) {
              var fontHeight = d3.round(pointRadius, 1);
              this._drawText(ctx, pixelRounded, fontHeight, pointLabel, pointRadius, rgb, false);
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

    var longitude = this.props.viewportLongitude || -122.405293,
        latitude = this.props.viewportLatitude || 37.772123;

    this.state = {
      viewport: {
        longitude: longitude,
        latitude: latitude,
        zoom: this.props.viewportZoom || 11,
        startDragLngLat: [longitude, latitude]
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

    d3.select("#viewport_longitude").attr("value", this.state.viewport.longitude);
    d3.select("#viewport_latitude").attr("value", this.state.viewport.latitude);
    d3.select("#viewport_zoom").attr("value", this.state.viewport.zoom);

    return (
      <MapGL
        {...this.state.viewport}
        mapStyle={this.props.mapStyle}
        width={this.props.sliceWidth}
        height={this.props.sliceHeight}
        mapboxApiAccessToken={this.props.mapboxApiKey}
        onChangeViewport={this.onChangeViewport}>
        <ScatterPlotGlowOverlay
          {...this.state.viewport}
          isDragging={this.state.viewport.isDragging !== undefined ? this.state.viewport.isDragging : false}
          width={this.props.sliceWidth}
          height={this.props.sliceHeight}
          locations={Immutable.fromJS(clusters)}
          dotRadius={this.props.pointRadius}
          pointRadiusUnit={this.props.pointRadiusUnit}
          kmToPixels={this.props.kmToPixels}
          rgb={this.props.rgb}
          globalOpacity={this.props.globalOpacity}
          compositeOperation={"screen"}
          renderWhileDragging={this.props.renderWhileDragging}
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
  // Seems like the zoomLevel is off by one
  var kmPerPixel = earthCircumferenceKm * Math.cos(latitudeRad) / Math.pow(2, zoomLevel + 8 + 1);
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

      // Validate mapbox color
      var rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(json.data.color);
      if (rgb === null) {
        slice.error("Color field must be of form 'rgb(%d, %d, %d)'");
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
          {...json.data}
          rgb={rgb}
          sliceHeight={slice.height()}
          sliceWidth={slice.width()}
          clusterer={clusterer}
          pointRadius={defaultPointRadius}
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
};

module.exports = mapbox;