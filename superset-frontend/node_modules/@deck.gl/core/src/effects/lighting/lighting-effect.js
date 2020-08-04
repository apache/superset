import {AmbientLight} from '@luma.gl/core';
import DirectionalLight from './directional-light';
import Effect from '../../lib/effect';

const DefaultAmbientLightProps = {color: [255, 255, 255], intensity: 1.0};
const DefaultDirectionalLightProps = [
  {
    color: [255, 255, 255],
    intensity: 1.0,
    direction: [-1, -3, -1]
  },
  {
    color: [255, 255, 255],
    intensity: 0.9,
    direction: [1, 8, -2.5]
  }
];

// Class to manage ambient, point and directional light sources in deck
export default class LightingEffect extends Effect {
  constructor(props) {
    super(props);
    this.ambientLight = null;
    this.directionalLights = [];
    this.pointLights = [];

    for (const key in props) {
      const lightSource = props[key];

      switch (lightSource.type) {
        case 'ambient':
          this.ambientLight = lightSource;
          break;

        case 'directional':
          this.directionalLights.push(lightSource);
          break;

        case 'point':
          this.pointLights.push(lightSource);
          break;
        default:
      }
    }
    this.applyDefaultLights();
  }

  getParameters(layer) {
    const {ambientLight} = this;
    const pointLights = this.getProjectedPointLights(layer);
    const directionalLights = this.getProjectedDirectionalLights(layer);
    return {
      lightSources: {ambientLight, directionalLights, pointLights}
    };
  }

  // Private
  applyDefaultLights() {
    const {ambientLight, pointLights, directionalLights} = this;
    if (!ambientLight && pointLights.length === 0 && directionalLights.length === 0) {
      this.ambientLight = new AmbientLight(DefaultAmbientLightProps);
      this.directionalLights.push(new DirectionalLight(DefaultDirectionalLightProps[0]));
      this.directionalLights.push(new DirectionalLight(DefaultDirectionalLightProps[1]));
    }
  }

  getProjectedPointLights(layer) {
    const projectedPointLights = [];

    for (let i = 0; i < this.pointLights.length; i++) {
      const pointLight = this.pointLights[i];
      projectedPointLights.push(pointLight.getProjectedLight({layer}));
    }
    return projectedPointLights;
  }

  getProjectedDirectionalLights(layer) {
    const projectedDirectionalLights = [];

    for (let i = 0; i < this.directionalLights.length; i++) {
      const directionalLight = this.directionalLights[i];
      projectedDirectionalLights.push(directionalLight.getProjectedLight({layer}));
    }
    return projectedDirectionalLights;
  }
}
