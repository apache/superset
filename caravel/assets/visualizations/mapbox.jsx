// JS
var d3 = window.d3 || require('d3');

// CSS
require('./mapbox.css');

import React from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl';
import MapGL from 'react-map-gl';

class MapboxViz extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      viewport: {
        latitude: 37.772123,
        longitude: -122.405293,
        zoom: 8,
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
    return (
      <MapGL
        mapStyle={'mapbox://styles/mapbox/streets-v8'}
        width={this.props.sliceWidth}
        height={this.props.sliceHeight}
        startDragLngLat={this.state.viewport.startDragLngLat}
        latitude={this.state.viewport.latitude}
        longitude={this.state.viewport.longitude}
        zoom={this.state.viewport.zoom} 
        mapboxApiAccessToken={''}
        onChangeViewport={this.onChangeViewport}/>
    );
  }
}

function mapbox(slice) {
  var div = d3.select(slice.selector);

  var render = function () {
    d3.json(slice.jsonEndpoint(), function (error, json) {

      if (error !== null) {
        slice.error(error.responseText);
        return '';
      }

      div.selectAll("*").remove();

      ReactDOM.render(
        <MapboxViz sliceHeight={slice.height()} sliceWidth={slice.width()}/>,
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