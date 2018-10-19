import CategoricalColorScale from './CategoricalColorScale';
import getCategoricalSchemeRegistry from './CategoricalSchemeRegistrySingleton';

class CategoricalColorNamespace {
  constructor(name) {
    this.name = name;
    this.scales = {};
    this.forcedItems = {};
  }

  getScale(schemeName) {
    const name = schemeName || getCategoricalSchemeRegistry().getDefaultSchemeName();
    const scale = this.scales[name];
    if (scale) {
      return scale;
    }
    const newScale = new CategoricalColorScale(
      getCategoricalSchemeRegistry().get(name).colors,
      this.forcedItems,
    );
    this.scales[name] = newScale;
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
    this.forcedItems[value] = forcedColor;
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

export function getColor(value, scheme, namespace) {
  return getNamespace(namespace)
    .getScale(scheme)
    .getColor(value);
}

export function getScale(scheme, namespace) {
  return getNamespace(namespace)
    .getScale(scheme);
}
