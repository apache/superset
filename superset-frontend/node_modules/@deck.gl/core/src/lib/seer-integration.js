import seer from 'seer';

/**
 * Recursively set a nested property of an object given a properties array and a value
 */
const recursiveSet = (obj, path, value) => {
  if (!obj) {
    return;
  }

  if (path.length > 1) {
    recursiveSet(obj[path[0]], path.slice(1), value);
  } else {
    obj[path[0]] = value;
  }
};

const overrides = new Map();

/**
 * Create an override on the specify layer, indexed by a valuePath array.
 * Do nothing in case Seer as not been initialized to prevent any preformance drawback.
 */
export const setPropOverrides = (id, valuePath, value) => {
  if (!seer.isReady()) {
    return;
  }

  if (!overrides.has(id)) {
    overrides.set(id, new Map());
  }

  const props = overrides.get(id);
  props.set(valuePath, value);
};

/**
 * Get the props overrides of a specific layer if Seer as been initialized
 * Invalidates the data to be sure new ones are always picked up.
 */
export const applyPropOverrides = props => {
  if (!seer.isReady() || !props.id) {
    return;
  }

  const overs = overrides.get(props.id);
  if (!overs) {
    return;
  }

  overs.forEach((value, valuePath) => {
    recursiveSet(props, valuePath, value);
    // Invalidate data array if we have a data override
    if (valuePath[0] === 'data') {
      props.data = [...props.data];
    }
  });
};

/**
 * Listen for deck.gl edit events
 */
export const layerEditListener = cb => {
  if (!seer.isReady()) {
    return;
  }

  seer.listenFor('deck.gl', cb);
};

/**
 * Listen for seer init events to resend data
 */
export const seerInitListener = cb => {
  if (!seer.isReady()) {
    return;
  }

  seer.listenFor('init', cb);
};

export const initLayerInSeer = layer => {
  if (!seer.isReady() || !layer) {
    return;
  }

  const badges = [layer.constructor.layerName];

  seer.listItem('deck.gl', layer.id, {
    badges,
    // TODO: Seer currently only handles single model layers
    links: layer.state && layer.state.model ? [`luma.gl:${layer.state.model.id}`] : undefined,
    parent: layer.parent ? layer.parent.id : undefined
  });
};

/**
 * Log layer's properties to Seer
 */
export const updateLayerInSeer = layer => {
  if (!seer.isReady() || seer.throttle(`deck.gl:${layer.id}`, 1e3)) {
    return;
  }

  const data = logPayload(layer);
  seer.multiUpdate('deck.gl', layer.id, data);
};

/**
 * On finalize of a specify layer, remove it from seer
 */
export const removeLayerInSeer = id => {
  if (!seer.isReady() || !id) {
    return;
  }

  seer.deleteItem('deck.gl', id);
};

function logPayload(layer) {
  const data = [{path: 'objects.props', data: layer.props}];

  const badges = [layer.constructor.layerName];

  if (layer.state) {
    if (layer.getAttributeManager()) {
      const attrs = layer.getAttributeManager().getAttributes();
      data.push({path: 'objects.attributes', data: attrs});
    }
    // TODO: Seer currently only handles single model layers
    if (layer.state.model) {
      layer.state.model.setProps({timerQueryEnabled: true});
      const {lastFrameTime} = layer.state.model.stats;
      if (lastFrameTime) {
        badges.push(`${(lastFrameTime * 1000).toFixed(0)}μs`);
      }
    }
  }

  data.push({path: 'badges', data: badges});

  return data;
}
