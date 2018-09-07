import CategoricalColorScale from './CategoricalColorScale';
import ColorSchemeManager from './ColorSchemeManager';

class CategoricalColorNamespace {
  constructor() {
    this.scales = {};
    this.forcedItems = {};
  }

  getScale(schemeName) {
    const name = schemeName || ColorSchemeManager.getDefaultSchemeName();
    const scale = this.scales[name];
    if (scale) {
      return scale;
    }
    const newScale = new CategoricalColorScale(
      ColorSchemeManager.getScheme(name),
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
const DEFAULT_NAMESPACE = 'DEFAULT';

function getNamespace(namespace = DEFAULT_NAMESPACE) {
  const instance = namespaces[namespace];
  if (instance) {
    return instance;
  }
  const newInstance = new CategoricalColorNamespace();
  namespaces[namespace] = newInstance;
  return newInstance;
}

CategoricalColorNamespace.getNamespace = getNamespace;

export default CategoricalColorNamespace;
