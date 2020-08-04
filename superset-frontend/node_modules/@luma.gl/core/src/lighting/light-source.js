import {Vector3} from 'math.gl';
import {uid} from '../utils';

// default light source parameters
const DEFAULT_LIGHT_COLOR = [255, 255, 255];
const DEFAULT_LIGHT_INTENSITY = 1.0;
const DEFAULT_ATTENUATION = [0, 0, 1];

const DEFAULT_LIGHT_DIRECTION = [0.0, 0.0, -1.0];

const DEFAULT_LIGHT_POSITION = [0.0, 0.0, 1.0];

// glTF lights reference:
// https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_lights_punctual

class Light {
  constructor(props = {}) {
    this.id = props.id || uid('light');
    const {color = DEFAULT_LIGHT_COLOR} = props;
    this.color = color;
    const {intensity = DEFAULT_LIGHT_INTENSITY} = props;
    this.intensity = intensity;
  }
}

export class AmbientLight extends Light {
  constructor(props = {}) {
    super(props);
    this.type = 'ambient';
  }
}

export class DirectionalLight extends Light {
  constructor(props = {}) {
    super(props);
    this.type = 'directional';
    const {direction = DEFAULT_LIGHT_DIRECTION} = props;
    this.direction = new Vector3(direction).normalize().toArray();
  }
}

export class PointLight extends Light {
  constructor(props = {}) {
    super(props);
    this.type = 'point';
    const {position = DEFAULT_LIGHT_POSITION} = props;
    this.position = position;
    this.attenuation = this._getAttenuation(props);
  }

  // PRIVATE

  // Helper: Extracts attenuation from either `props.attenuation`` or `props.intensity``
  // Supports both sophisticated light model and the classic intensity prop
  _getAttenuation(props) {
    if ('attenuation' in props) {
      return props.attenuation;
    }
    if ('intensity' in props) {
      return [0, 0, props.intensity];
    }
    return DEFAULT_ATTENUATION;
  }
}
