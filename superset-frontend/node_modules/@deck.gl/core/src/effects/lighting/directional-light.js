import {DirectionalLight as BaseDirectionalLight} from '@luma.gl/core';

export default class DirectionalLight extends BaseDirectionalLight {
  getProjectedLight() {
    return this;
  }
}
