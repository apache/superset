"use strict";

exports.__esModule = true;
exports.default = void 0;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class ChartMetadata {
  constructor(config) {
    _defineProperty(this, "name", void 0);

    _defineProperty(this, "canBeAnnotationTypes", void 0);

    _defineProperty(this, "canBeAnnotationTypesLookup", void 0);

    _defineProperty(this, "credits", void 0);

    _defineProperty(this, "description", void 0);

    _defineProperty(this, "show", void 0);

    _defineProperty(this, "supportedAnnotationTypes", void 0);

    _defineProperty(this, "thumbnail", void 0);

    _defineProperty(this, "useLegacyApi", void 0);

    const {
      name,
      canBeAnnotationTypes = [],
      credits = [],
      description = '',
      show = true,
      supportedAnnotationTypes = [],
      thumbnail,
      useLegacyApi = false
    } = config;
    this.name = name;
    this.credits = credits;
    this.description = description;
    this.show = show;
    this.canBeAnnotationTypes = canBeAnnotationTypes;
    this.canBeAnnotationTypesLookup = canBeAnnotationTypes.reduce((prev, type) => {
      const lookup = prev;
      lookup[type] = true;
      return lookup;
    }, {});
    this.supportedAnnotationTypes = supportedAnnotationTypes;
    this.thumbnail = thumbnail;
    this.useLegacyApi = useLegacyApi;
  }

  canBeAnnotationType(type) {
    return this.canBeAnnotationTypesLookup[type] || false;
  }

  clone() {
    return new ChartMetadata({
      canBeAnnotationTypes: this.canBeAnnotationTypes,
      credits: this.credits,
      description: this.description,
      name: this.name,
      show: this.show,
      supportedAnnotationTypes: this.supportedAnnotationTypes,
      thumbnail: this.thumbnail,
      useLegacyApi: this.useLegacyApi
    });
  }

}

exports.default = ChartMetadata;