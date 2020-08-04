
# deck.gl

A WebGL2-powered, highly performant framework for large-scale data visualization.

[API Documentation](http://deck.gl/#/documentation)

[![docs](http://i.imgur.com/mvfvgf0.jpg)](https://uber.github.io/deck.gl)

## Installation

```
npm install deck.gl
```

## Using deck.gl

deck.gl offers an extensive catalog of pre-packaged visualization "layers", including [ScatterplotLayer](http://deck.gl/#/documentation/deckgl-api-reference/layers/scatterplot-layer), [ArcLayer](http://deck.gl/#/documentation/deckgl-api-reference/layers/arc-layer), [TextLayer](http://deck.gl/#/documentation/deckgl-api-reference/layers/text-layer), [GeoJsonLayer](http://deck.gl/#/documentation/deckgl-api-reference/layers/geojson-layer), etc. The input to a layer is usually an array of JSON objects. Each layer offers highly-flexible API to customize how the data should be rendered.

Example constructing a deck.gl ScatterplotLayer: 

```js
import {ScatterplotLayer} from '@deck.gl/layers';

/**
 * data is an array of object in the shape of:
 * {
 *   "name":"Montgomery St. (MONT)",
 *   "address":"598 Market Street, San Francisco CA 94104",
 *   "entries":"43430",
 *   "exits":"45128",
 *   "coordinates":[-122.401407,37.789256]
 * }
 */
const scatterplotLayer = new ScatterplotLayer({
  id: 'bart-stations',
  data: 'https://github.com/uber-common/deck.gl-data/blob/master/website/bart-stations.json',
  getRadius: d => Math.sqrt(d.entries) / 100,
  getPosition: d => d.coordinates,
  getColor: [255, 228, 0],
});
```

## Using deck.gl with React

```js
import DeckGL from 'deck.gl';

<DeckGL width="100%" height="100%" longitude={-122.4} latitude={37.78} zoom={8} controller={true} layers={[scatterplotLayer]} />
```

## Using deck.gl with Pure JS

```js
import {Deck} from '@deck.gl/core';

const deck = new Deck({
  container: document.body,
  width: '100vw',
  height: '100vh',
  longitude: -122.4,
  latitude: 37.78,
  zoom: 8,
  controller: true,
  layers: [scatterplotLayer]
});
```


Questions? Submit an issue on our [GitHub page](https://www.github.com/uber/deck.gl/issues).
