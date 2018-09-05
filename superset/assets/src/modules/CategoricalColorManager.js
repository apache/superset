import CategoricalColorScale from './CategoricalColorScale';

const schemes = {};

class CategoricalColorManager {
  constructor() {
    this.scales = {};
  }

  getScale(schemeName) {
    const scale = this.scales[schemeName];
    if (scale) {
      return scale;
    }
    const colors = schemes[schemeName] || schemes.default;
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

CategoricalColorManager.getInstance = getInstance;
CategoricalColorManager.getScale = function (schemeName) {
  return getInstance().getScale(schemeName);
};
CategoricalColorManager.getColor = function (schemeName, value) {
  return getInstance().getScale(schemeName).getColor(value);
};
CategoricalColorManager.setColor = function (schemeName, value, forcedColor) {
  return getInstance().getScale(schemeName).setColor(value, forcedColor);
};
CategoricalColorManager.registerScheme = function (schemeName, colors) {
  schemes[schemeName] = colors;
};
CategoricalColorManager.registerSchemes = function (multipleSchemes) {
  Object.assign(schemes, multipleSchemes);
};
CategoricalColorManager.getScheme = function (schemeName) {
  return schemes[schemeName];
};
CategoricalColorManager.getSchemes = function () {
  return schemes;
};

export default CategoricalColorManager;
