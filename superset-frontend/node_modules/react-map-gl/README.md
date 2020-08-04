<p align="right">
  <a href="https://npmjs.org/package/react-map-gl">
    <img src="https://img.shields.io/npm/v/react-map-gl.svg?style=flat-square" alt="version" />
  </a>
  <a href="https://travis-ci.org/uber/react-map-gl">
    <img src="https://img.shields.io/travis/uber/react-map-gl/master.svg?style=flat-square" alt="build" />
  </a>
  <a href="https://npmjs.org/package/react-map-gl">
    <img src="https://img.shields.io/npm/dm/react-map-gl.svg?style=flat-square" alt="downloads" />
  </a>
</p>

<h1 align="center">react-map-gl | <a href="https://uber.github.io/react-map-gl">Docs</a></h1>

<h5 align="center">
React Components Suite for <a href="https://github.com/mapbox/mapbox-gl-js">Mapbox GL JS</a>.
</h5>

In addition to exposing MapboxGL functionality to React apps, react-map-gl also integrates seamlessly with [deck.gl](https://uber.github.io/deck.gl).

### Before You Begin
This library provides convenient wrappers around initializing and (to some degree) tracking the state of a Mapbox WebGL map. Because most of the functionality of Mapbox's JS API depends on the use of HTML5 canvases and WebGL, which React is not built to manipulate, the React component does not mirror all the functionality of Mapbox GL JS's Map class. You may access the native Mapbox API exposed by the `getMap()` function in this library. However, proceed with caution as calling the native APIs may break the connection between the React layer props and the underlying map state.

### Installation

Using `react-map-gl` requires `react >= 16.3`.

```sh
npm install --save react-map-gl
```

### Example

```js
import {Component} from 'react';
import ReactMapGL from 'react-map-gl';

class Map extends Component {

  state = {
    viewport: {
      width: 400,
      height: 400,
      latitude: 37.7577,
      longitude: -122.4376,
      zoom: 8
    }
  };

  render() {
    return (
      <ReactMapGL
        {...this.state.viewport}
        onViewportChange={(viewport) => this.setState({viewport})}
      />
    );
  }
}
```

### About Mapbox Tokens

To show maps from a service such as Mapbox you will need to register on their website in order to retrieve an access token required by the map component, which will be used to identify you and start serving up map tiles. The service will be free until a certain level of traffic is exceeded.

There are several ways to provide a token to your app, as showcased in some of the example folders:

* Provide a `mapboxApiAccessToken` prop to the map component
* Set the `MapboxAccessToken` environment variable (or set `REACT_APP_MAPBOX_ACCESS_TOKEN` if you are using Create React App)
* Provide it in the URL, e.g `?access_token=TOKEN`
* Provide `mapboxApiUrl` prop to the map component to override the default mapbox API URL

But we would recommend using something like [dotenv](https://github.com/motdotla/dotenv) and put your key in an untracked `.env` file, that will then expose it as a `process.env` variable, with much less leaking risks.

### Contribute

See [developer guide](docs/developer-guide.md).
