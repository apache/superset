// Converts a JSON payload to a deck.gl props object
// Lightly processes `json` props, transform string values, and extract `views` and `layers`
// See: https://github.com/uber/deck.gl/blob/master/dev-docs/RFCs/v6.1/json-layers-rfc.md
//
// NOTES:
// * This is intended to provide minimal necessary processing required to support
//   existing deck.gl props via JSON. This is not an implementation of alternate JSON schemas.
// * Optionally, error checking could be applied, but ideally should leverage
//   non-JSON specific mechanisms like prop types.

import {MapView, FirstPersonView, OrbitView, OrthographicView} from '@deck.gl/core';
import JSONLayer from '../json-layer/json-layer';
import {get} from '../utils/get';
import {csvParseRows} from 'd3-dsv';

// Support all `@deck.gl/core` Views by default
const DEFAULT_VIEW_CATALOG = {MapView, FirstPersonView, OrbitView, OrthographicView};

const DEFAULT_MAP_PROPS = {
  style: 'mapbox://styles/mapbox/light-v9'
};

// Converts JSON to props ("hydrating" classes, resolving enums and functions etc).
export function convertTopLevelJSON(json, configuration) {
  // TODO - Currently converts "in place", might be clearer to convert to separate structure
  const jsonProps = json;

  // Convert "JSON layers" in `json.layers` into class instances
  if (jsonProps.layers) {
    jsonProps.layers = convertJSONLayers(json.layers, configuration);
  }

  // Convert "JSON views" in `json.views` into class instances
  if (jsonProps.views) {
    jsonProps.views = convertJSONViews(json.views, configuration);
  }

  if ('initialViewState' in jsonProps) {
    jsonProps.viewState = jsonProps.viewState || jsonProps.initialViewState;
  }

  convertJSONMapProps(jsonProps, configuration);

  return jsonProps;
}

// Normalizes map/mapStyle etc props to a `map: {style}` object-valued prop
function convertJSONMapProps(jsonProps, configuration) {
  if (jsonProps.map || jsonProps.mapStyle) {
    jsonProps.map = Object.assign({}, DEFAULT_MAP_PROPS, jsonProps.map);
  }

  if (!jsonProps.map) {
    return;
  }

  if ('mapStyle' in jsonProps) {
    jsonProps.map.style = jsonProps.mapStyle;
    jsonProps.map.mapStyle = jsonProps.mapStyle;
    delete jsonProps.mapStyle;
  }

  // TODO - better map handling
  if ('viewState' in jsonProps) {
    jsonProps.map.viewState = jsonProps.viewState;
  }
}

// Use the composite JSONLayer to render any JSON layers
function convertJSONLayers(jsonLayers, configuration) {
  return [
    new JSONLayer({
      data: jsonLayers,
      configuration
    })
  ];
}

// Instantiates views: `{type: MapView, ...props}` to `MapView(...props)`
function convertJSONViews(jsonViews, configuration) {
  if (!jsonViews) {
    return jsonViews;
  }

  const viewCatalog = configuration.views || {};

  jsonViews = Array.isArray(jsonViews) ? jsonViews : [jsonViews];
  return jsonViews
    .map(jsonView => {
      // Try to find a view definition
      const View = viewCatalog[jsonView.type] || DEFAULT_VIEW_CATALOG[jsonView.type];
      // Instantiate it
      if (View) {
        const viewProps = Object.assign({}, jsonView);
        delete viewProps.type;
        return new View(viewProps);
      }
      return null;
    })
    .filter(Boolean);
}

// LAYERS

// Replaces accessor props
export function getJSONLayers(jsonLayers = [], configuration) {
  // assert(Array.isArray(jsonLayers));
  const layerCatalog = configuration.layers || {};
  return jsonLayers.map(jsonLayer => {
    const Layer = layerCatalog[jsonLayer.type];
    const props = getJSONLayerProps(jsonLayer, configuration);
    props.fetch = enhancedFetch;
    return Layer && new Layer(props);
  });
}

function getJSONLayerProps(jsonProps, configuration) {
  const replacedProps = {};
  for (const propName in jsonProps) {
    // eslint-disable-line guard-for-in
    const propValue = jsonProps[propName];
    // Handle accessors
    if (propName.startsWith('get')) {
      replacedProps[propName] = getJSONAccessor(propValue, configuration);
    } else {
      replacedProps[propName] = propValue;
    }
  }
  return replacedProps;
}

// Calculates an accessor function from a JSON string
// '-' : x => x
// 'a.b.c': x => x.a.b.c
function getJSONAccessor(propValue, configuration) {
  if (propValue === '-') {
    return object => object;
  }
  if (typeof propValue === 'string') {
    return object => {
      return get(object, propValue);
    };
  }
  return propValue;
}

// HELPERS

function enhancedFetch(url) {
  /* global fetch */
  return fetch(url)
    .then(response => response.text())
    .then(text => {
      try {
        return JSON.parse(text);
      } catch (error) {
        return parseCSV(text);
      }
    });
}

function parseCSV(text) {
  const csv = csvParseRows(text);

  // Remove header
  if (csv.length > 0) {
    csv.shift();
  }

  for (const row of csv) {
    for (const key in row) {
      const number = parseFloat(row[key]);
      if (!Number.isNaN(number)) {
        row[key] = number;
      }
    }
  }

  return csv;
}
