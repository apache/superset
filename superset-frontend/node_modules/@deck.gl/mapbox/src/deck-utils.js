import {Deck, WebMercatorViewport} from '@deck.gl/core';

export function getDeckInstance({map, gl, deck}) {
  // Only create one deck instance per context
  if (map.__deck) {
    return map.__deck;
  }

  const customRender = deck && deck.props._customRender;

  const deckProps = {
    useDevicePixels: true,
    _customRender: () => {
      map.triggerRepaint();
      if (customRender) {
        // customRender may be subscribed by DeckGL React component to update child props
        // make sure it is still called
        customRender();
      }
    },
    // TODO: import these defaults from a single source of truth
    parameters: {
      depthMask: true,
      depthTest: true,
      blendFunc: [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA],
      blendEquation: gl.FUNC_ADD
    },
    userData: {
      isExternal: false,
      mapboxLayers: new Set()
    }
  };

  if (deck) {
    deck.setProps(deckProps);
    deck.props.userData.isExternal = true;
  } else {
    // Using external gl context - do not set css size
    Object.assign(deckProps, {
      gl,
      width: false,
      height: false,
      viewState: getViewState(map)
    });
    deck = new Deck(deckProps);

    // If deck is externally provided (React use case), we use deck's viewState to
    // drive the map.
    // Otherwise (pure JS use case), we use the map's viewState to drive deck.
    map.on('move', () => onMapMove(deck, map));
    map.on('remove', () => {
      deck.finalize();
      map.__deck = null;
    });
  }
  map.__deck = deck;
  map.on('render', () => afterRender(deck, map));

  return deck;
}

export function addLayer(deck, layer) {
  deck.props.userData.mapboxLayers.add(layer);
  updateLayers(deck);
}

export function removeLayer(deck, layer) {
  deck.props.userData.mapboxLayers.delete(layer);
  updateLayers(deck);
}

export function updateLayer(deck, layer) {
  updateLayers(deck);
}

export function drawLayer(deck, map, layer) {
  let {currentViewport} = deck.props.userData;
  if (!currentViewport) {
    // This is the first layer drawn in this render cycle.
    // Generate viewport from the current map state.
    currentViewport = getViewport(deck, map, true);
    deck.props.userData.currentViewport = currentViewport;
  }

  deck._drawLayers('mapbox-repaint', {
    viewports: [currentViewport],
    // TODO - accept layerFilter in drawLayers' renderOptions
    layers: getLayers(deck, deckLayer => shouldDrawLayer(layer.id, deckLayer)),
    clearCanvas: false
  });
}

function getViewState(map) {
  const {lng, lat} = map.getCenter();
  return {
    longitude: lng,
    latitude: lat,
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch()
  };
}

function getViewport(deck, map, useMapboxProjection = true) {
  return new WebMercatorViewport(
    Object.assign(
      {
        x: 0,
        y: 0,
        width: deck.width,
        height: deck.height
      },
      getViewState(map),
      // https://github.com/mapbox/mapbox-gl-js/issues/7573
      useMapboxProjection
        ? {
            // match mapbox's projection matrix
            nearZMultiplier: deck.height ? 1 / deck.height : 1,
            farZMultiplier: 1
          }
        : {
            // use deck.gl's projection matrix
            nearZMultiplier: 0.1,
            farZMultiplier: 10
          }
    )
  );
}

function afterRender(deck, map) {
  const {mapboxLayers, isExternal} = deck.props.userData;

  if (isExternal) {
    // Draw non-Mapbox layers
    const mapboxLayerIds = Array.from(mapboxLayers, layer => layer.id);
    const layers = getLayers(deck, deckLayer => {
      for (const id of mapboxLayerIds) {
        if (shouldDrawLayer(id, deckLayer)) {
          return false;
        }
      }
      return true;
    });
    if (layers.length > 0) {
      deck._drawLayers('mapbox-repaint', {
        viewports: [getViewport(deck, map, false)],
        layers,
        clearCanvas: false
      });
    }
  }

  // End of render cycle, clear generated viewport
  deck.props.userData.currentViewport = null;
}

function onMapMove(deck, map) {
  deck.setProps({
    viewState: getViewState(map)
  });
  // Camera changed, will trigger a map repaint right after this
  // Clear any change flag triggered by setting viewState so that deck does not request
  // a second repaint
  deck.needsRedraw({clearRedrawFlags: true});
}

function getLayers(deck, layerFilter) {
  const layers = deck.layerManager.getLayers();
  return layers.filter(layerFilter);
}

function shouldDrawLayer(id, layer) {
  let layerInstance = layer;
  while (layerInstance) {
    if (layerInstance.id === id) {
      return true;
    }
    layerInstance = layerInstance.parent;
  }
  return false;
}

function updateLayers(deck) {
  if (deck.props.userData.isExternal) {
    return;
  }

  const layers = [];
  deck.props.userData.mapboxLayers.forEach(deckLayer => {
    const LayerType = deckLayer.props.type;
    const layer = new LayerType(deckLayer.props);
    layers.push(layer);
  });
  deck.setProps({layers});
}
