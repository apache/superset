import {DirectionalLight} from '@luma.gl/core';
import {getSunlightDirection} from './suncalc';

export default class SunLight extends DirectionalLight {
  constructor({timestamp, ...others}) {
    super(others);

    this.timestamp = timestamp;
  }

  getProjectedLight({layer}) {
    const {latitude, longitude} = layer.context.viewport;
    this.direction = getSunlightDirection(this.timestamp, latitude, longitude);

    return this;
  }
}
