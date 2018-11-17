import CategoricalColorScale from './CategoricalColorScale';
import getCategoricalSchemeRegistry from './CategoricalSchemeRegistrySingleton';
import stringifyAndTrim from './stringifyAndTrim';

export default class CategoricalColorNamespace {
  constructor(name) {
    this.name = name;
    this.scales = {};
    this.forcedItems = {};
  }

  getScale(schemeId) {
    const id = schemeId || getCategoricalSchemeRegistry().getDefaultKey();
    const scale = this.scales[id];
    if (scale) {
      return scale;
    }
    const newScale = new CategoricalColorScale(
      getCategoricalSchemeRegistry().get(id).colors,
      this.forcedItems,
    );
    this.scales[id] = newScale;

    return newScale;
  }

  /**
   * Enforce specific color for given value
   * This will apply across all color scales
   * in this namespace.
   * @param {*} value value
   * @param {*} forcedColor color
   */
  setColor(value, forcedColor) {
    this.forcedItems[stringifyAndTrim(value)] = forcedColor;

    return this;
  }
}

const namespaces = {};
export const DEFAULT_NAMESPACE = 'GLOBAL';

export function getNamespace(name = DEFAULT_NAMESPACE) {
  const instance = namespaces[name];
  if (instance) {
    return instance;
  }
  const newInstance = new CategoricalColorNamespace(name);
  namespaces[name] = newInstance;

  return newInstance;
}

export function getColor(value, schemeId, namespace) {
  return getNamespace(namespace)
    .getScale(schemeId)
    .getColor(value);
}

export function getScale(scheme, namespace) {
  return getNamespace(namespace).getScale(scheme);
}
