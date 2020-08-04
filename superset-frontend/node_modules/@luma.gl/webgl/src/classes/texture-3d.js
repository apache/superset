import GL from '@luma.gl/constants';
import {withParameters} from '../context';
import {isWebGL2, assertWebGL2Context} from '../webgl-utils';
import Texture from './texture';
import {DATA_FORMAT_CHANNELS, TYPE_SIZES} from './texture-formats';
import Buffer from './buffer';

export default class Texture3D extends Texture {
  static isSupported(gl) {
    return isWebGL2(gl);
  }

  constructor(gl, props = {}) {
    assertWebGL2Context(gl);
    props = Object.assign({depth: 1}, props, {target: GL.TEXTURE_3D, unpackFlipY: false});
    super(gl, props);
    this.initialize(props);

    Object.seal(this);
  }

  // Image 3D copies from Typed Array or WebGLBuffer
  setImageData({
    level = 0,
    dataFormat = GL.RGBA,
    width,
    height,
    depth = 1,
    border = 0,
    format,
    type = GL.UNSIGNED_BYTE,
    offset = 0,
    data,
    parameters = {}
  }) {
    this._trackDeallocatedMemory('Texture');

    this.gl.bindTexture(this.target, this.handle);

    withParameters(this.gl, parameters, () => {
      if (ArrayBuffer.isView(data)) {
        this.gl.texImage3D(
          this.target,
          level,
          dataFormat,
          width,
          height,
          depth,
          border,
          format,
          type,
          data
        );
      }

      if (data instanceof Buffer) {
        this.gl.bindBuffer(GL.PIXEL_UNPACK_BUFFER, data.handle);
        this.gl.texImage3D(
          this.target,
          level,
          dataFormat,
          width,
          height,
          depth,
          border,
          format,
          type,
          offset
        );
      }
    });

    if (data && data.byteLength) {
      this._trackAllocatedMemory(data.byteLength, 'Texture');
    } else {
      // NOTE(Tarek): Default to RGBA bytes
      const channels = DATA_FORMAT_CHANNELS[this.dataFormat] || 4;
      const channelSize = TYPE_SIZES[this.type] || 1;

      this._trackAllocatedMemory(
        this.width * this.height * this.depth * channels * channelSize,
        'Texture'
      );
    }

    this.loaded = true;

    return this;
  }
}
