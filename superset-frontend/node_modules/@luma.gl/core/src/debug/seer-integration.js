import seer from 'seer';

import {window} from '../utils';

const models = {};

/**
 * Add a model to our cache indexed by id
 */
export const addModel = model => {
  if (models[model.id]) {
    return;
  }
  models[model.id] = model;

  seer.listItem('luma.gl', model.id);
};

/**
 * Log a model uniforms and attributes.
 */
export const logModel = (model, uniforms) => {
  if (!seer.isReady() || seer.throttle(`luma.gl:${model.id}`, 1e3)) {
    return;
  }

  const attributesObject = model.geometry
    ? Object.assign({}, model.geometry.attributes, model.attributes)
    : model.attributes;
  const uniformsObject = Object.assign({}, model.uniforms, uniforms);

  seer.multiUpdate('luma.gl', model.id, [
    {path: 'objects.uniforms', data: uniformsObject},
    {path: 'objects.attributes', data: attributesObject}
  ]);
};

/**
 * Remove a previously set model from the cache
 */
export const removeModel = id => {
  delete models[id];
  seer.deleteItem('luma.gl', id);
};

/**
 * Recursively traverse an object given a path of properties and set the given value
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
export const setOverride = (id, valuePath, value) => {
  if (!window.__SEER_INITIALIZED__) {
    return;
  }

  if (!overrides.has(id)) {
    overrides.set(id, new Map());
  }

  const uniforms = overrides.get(id);
  uniforms.set(valuePath, value);
};

/**
 * Apply overrides to a specific model's uniforms
 */
export const getOverrides = (id, uniforms) => {
  if (!window.__SEER_INITIALIZED__ || !id) {
    return;
  }

  const overs = overrides.get(id);
  if (!overs) {
    return;
  }

  overs.forEach((value, valuePath) => {
    recursiveSet(uniforms, valuePath, value);
  });
};

/**
 * Listen for luma.gl edit events
 */
seer.listenFor('luma.gl', payload => {
  const model = models[payload.itemKey];
  if (!model || payload.type !== 'edit' || payload.valuePath[0] !== 'uniforms') {
    return;
  }

  const valuePath = payload.valuePath.slice(1);
  setOverride(payload.itemKey, valuePath, payload.value);

  const uniforms = model.getUniforms();
  recursiveSet(uniforms, valuePath, payload.value);
  model.setUniforms(uniforms);
});
