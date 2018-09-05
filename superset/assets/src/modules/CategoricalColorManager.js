import CategoricalColorScale from './CategoricalColorScale';
import categoricalSchemes from './colorSchemes/categorical';
import airbnb from './colorSchemes/airbnb';
import lyft from './colorSchemes/lyft';

const schemes = {};

function getScheme(schemeName = 'default') {
  return schemes[schemeName];
}

function getSchemes() {
  return schemes;
}

function registerScheme(schemeName, colors) {
  schemes[schemeName] = colors;
}

function registerSchemes(multipleSchemes) {
  Object.assign(schemes, multipleSchemes);
}

class CategoricalColorManager {
  constructor() {
    this.scales = {};
  }

  getScale(schemeName = 'default') {
    const scale = this.scales[schemeName];
    if (scale) {
      return scale;
    }
    const colors = getScheme(schemeName);
    const newScale = new CategoricalColorScale(colors);
    this.scales[schemeName] = newScale;
    return newScale;
  }
}

let singleton;

function getInstance() {
  if (!singleton) {
    singleton = new CategoricalColorManager();
  }
  return singleton;
}

function getScale(schemeName) {
  return getInstance().getScale(schemeName);
}

Object.assign(CategoricalColorManager, {
  getInstance,
  getScale,
  registerScheme,
  registerSchemes,
  getScheme,
  getSchemes,
});

CategoricalColorManager.registerSchemes({ bnbColors: airbnb.bnbColors });
CategoricalColorManager.registerSchemes(categoricalSchemes);
CategoricalColorManager.registerSchemes({ lyftColors: lyft.lyftColors });
CategoricalColorManager.registerScheme('default', airbnb.bnbColors);

export default CategoricalColorManager;
