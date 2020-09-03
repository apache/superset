import CategoricalColorScale from './CategoricalColorScale';
import { ColorsLookup } from './types';
import getCategoricalSchemeRegistry from './CategoricalSchemeRegistrySingleton';
import stringifyAndTrim from './stringifyAndTrim';

export default class CategoricalColorNamespace {
  name: string;

  forcedItems: ColorsLookup;

  scales: {
    [key: string]: CategoricalColorScale;
  };

  constructor(name: string) {
    this.name = name;
    this.scales = {};
    this.forcedItems = {};
  }

  getScale(schemeId?: string) {
    const id = schemeId ?? getCategoricalSchemeRegistry().getDefaultKey() ?? '';
    const scale = this.scales[id];
    if (scale) {
      return scale;
    }
    const scheme = getCategoricalSchemeRegistry().get(id);

    const newScale = new CategoricalColorScale(scheme?.colors ?? [], this.forcedItems);
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
  setColor(value: string, forcedColor: string) {
    this.forcedItems[stringifyAndTrim(value)] = forcedColor;

    return this;
  }
}

const namespaces: {
  [key: string]: CategoricalColorNamespace;
} = {};

export const DEFAULT_NAMESPACE = 'GLOBAL';

export function getNamespace(name: string = DEFAULT_NAMESPACE) {
  const instance = namespaces[name];
  if (instance) {
    return instance;
  }
  const newInstance = new CategoricalColorNamespace(name);
  namespaces[name] = newInstance;

  return newInstance;
}

export function getColor(value?: string, schemeId?: string, namespace?: string) {
  return getNamespace(namespace).getScale(schemeId).getColor(value);
}

export function getScale(scheme?: string, namespace?: string) {
  return getNamespace(namespace).getScale(scheme);
}
