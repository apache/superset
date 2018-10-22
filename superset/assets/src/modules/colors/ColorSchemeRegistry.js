import Registry from '../Registry';

class ColorSchemeRegistry extends Registry {
  getDefaultSchemeName() {
    return this.defaultSchemeName;
  }

  setDefaultSchemeName(schemeName) {
    this.defaultSchemeName = schemeName;
    return this;
  }

  get(schemeName) {
    return super.get(schemeName || this.defaultSchemeName);
  }

  registerValue(schemeName, colors) {
    super.registerValue(schemeName, colors);
    // If there is no default, set as default
    if (!this.defaultSchemeName) {
      this.defaultSchemeName = schemeName;
    }
    return this;
  }

  registerLoader(schemeName, loader) {
    super.registerLoader(schemeName, loader);
    // If there is no default, set as default
    if (!this.defaultSchemeName) {
      this.defaultSchemeName = schemeName;
    }
    return this;
  }
}

export default ColorSchemeRegistry;
