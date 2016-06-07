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

class ScatterPlotGlowOverlay extends ScatterPlotOverlay {
  // Modified from https://github.com/uber/react-map-gl/blob/master/src/overlays/scatterplot.react.js
  _redraw() {
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
    if ((this.props.renderWhileDragging || !this.props.isDragging) && this.props.locations) {
      this.props.locations.forEach(function _forEach(location) {
        var pixel = mercator.project(this.props.lngLatAccessor(location));
        var pixelRounded = [d3.round(pixel[0], 1), d3.round(pixel[1], 1)];
        if (pixelRounded[0] + radius >= 0 &&
            pixelRounded[0] - radius < props.width &&
            pixelRounded[1] + radius >= 0 &&
            pixelRounded[1] - radius < props.height) {
          ctx.beginPath();
          ctx.arc(pixelRounded[0], pixelRounded[1], radius, 0, Math.PI * 2);
          var gradient = ctx.createRadialGradient(
            pixelRounded[0], pixelRounded[1], radius,
            pixelRounded[0], pixelRounded[1], 0
          );
          gradient.addColorStop(1, 'rgba(255,0,0,1)');
          gradient.addColorStop(0, 'rgba(255,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.fill();
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
      bbox = [topLeft[0], bottomRight[0], bottomRight[1], topLeft[1]],
      clusters = this.props.clusterer.getClusters(bbox, Math.round(this.state.viewport.zoom)),
      locations = clusters.map(function (cluster) {
        return cluster.geometry.coordinates;
      });

    return (
      <MapGL
        {...this.state.viewport}
        mapStyle={"mapbox://styles/mapbox/streets-v8"}
        width={this.props.sliceWidth}
        height={this.props.sliceHeight}
        mapboxApiAccessToken={""}
        onChangeViewport={this.onChangeViewport}>
        <ScatterPlotGlowOverlay
          {...this.state.viewport}
          isDragging={false}
          width={this.props.sliceWidth}
          height={this.props.sliceHeight}
          locations={Immutable.fromJS(locations)}
          dotRadius={15}
          globalOpacity={1}
          compositeOperation="screen"
          dotFill="#1FBAD6"
          renderWhileDragging={true}/>
      </MapGL>
    );
  }
}

function mapbox(slice) {
  var div = d3.select(slice.selector),
      clusterer = supercluster({
        radius: 40,
        maxZoom: 16
      });

  var render = function () {
    d3.json(slice.jsonEndpoint(), function (error, json) {
      if (error !== null) {
        slice.error(error.responseText);
        return "";
      }

      clusterer.load(json.data.features);

      div.selectAll("*").remove();
      ReactDOM.render(
        <MapboxViz
          sliceHeight={slice.height()}
          sliceWidth={slice.width()}
          clusterer={clusterer}/>,
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