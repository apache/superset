// Prepare a map style object for diffing
// If immutable - convert to plain object
// Work around some issues in the styles that would fail Mapbox's diffing
export function normalizeStyle(style) {
  if (!style) {
    return null;
  }

  if (typeof style === 'string') {
    return style;
  }

  if (style.toJS) {
    style = style.toJS();
  }

  const layerIndex = style.layers.reduce((accum, current) => Object.assign(accum, {
    [current.id]: current
  }), {});
  style.layers = style.layers.map(layer => {
    layer = Object.assign({}, layer); // Breaks style diffing :(

    delete layer.interactive;
    const layerRef = layerIndex[layer.ref]; // Style diffing doesn't work with refs so expand them out manually before diffing.

    if (layerRef) {
      delete layer.ref;

      if (layerRef.type !== undefined) {
        layer.type = layerRef.type;
      }

      if (layerRef.source !== undefined) {
        layer.source = layerRef.source;
      }

      if (layerRef['source-layer'] !== undefined) {
        layer['source-layer'] = layerRef['source-layer'];
      }

      if (layerRef.minzoom !== undefined) {
        layer.minzoom = layerRef.minzoom;
      }

      if (layerRef.maxzoom !== undefined) {
        layer.maxzoom = layerRef.maxzoom;
      }

      if (layerRef.filter !== undefined) {
        layer.filter = layerRef.filter;
      }

      if (layerRef.layout !== undefined) {
        layer.layout = layer.layout || {};
        layer.layout = Object.assign({}, layer.layout, layerRef.layout);
      }
    }

    return layer;
  });
  return style;
}
//# sourceMappingURL=style-utils.js.map