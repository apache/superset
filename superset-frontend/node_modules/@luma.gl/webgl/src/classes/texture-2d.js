import GL from '@luma.gl/constants';
import Texture from './texture';
import {assertWebGLContext} from '../webgl-utils';
import {loadImage} from '../utils/load-file';

export default class Texture2D extends Texture {
  static isSupported(gl, opts) {
    return Texture.isSupported(gl, opts);
  }

  constructor(gl, props = {}) {
    assertWebGLContext(gl);

    // Signature: new Texture2D(gl, url | Promise)
    if (props instanceof Promise || typeof props === 'string') {
      props = {data: props};
    }

    // Signature: new Texture2D(gl, {data: url})
    if (typeof props.data === 'string') {
      props = Object.assign({}, props, {data: loadImage(props.data)});
    }

    super(gl, Object.assign({}, props, {target: GL.TEXTURE_2D}));

    this.initialize(props);

    Object.seal(this);
  }
}
