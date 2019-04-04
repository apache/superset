import GL from '../constants';
import Texture from './texture';
import assert from '../utils/assert';

const FACES = [
  GL.TEXTURE_CUBE_MAP_POSITIVE_X,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_X,
  GL.TEXTURE_CUBE_MAP_POSITIVE_Y,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_Y,
  GL.TEXTURE_CUBE_MAP_POSITIVE_Z,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_Z
];

export default class TextureCube extends Texture {
  constructor(gl, opts = {}) {
    super(gl, Object.assign({}, opts, {target: GL.TEXTURE_CUBE_MAP}));
    this.initialize(opts);
    Object.seal(this);
  }

  /* eslint-disable max-len, max-statements */
  initialize(opts = {}) {
    const {
      format = GL.RGBA,
      mipmaps = true
    } = opts;

    let {
      width = 1,
      height = 1,
      type = GL.UNSIGNED_BYTE,
      dataFormat
    } = opts;

    // Deduce width and height based on one of the faces
    ({type, dataFormat} = this._deduceParameters({format, type, dataFormat}));
    ({width, height} = this._deduceImageSize({
      data: opts[GL.TEXTURE_CUBE_MAP_POSITIVE_X], width, height
    }));

    // Enforce cube
    assert(width === height);

    // Temporarily apply any pixel store paramaters and build textures
    // withParameters(this.gl, opts, () => {
    //   for (const face of CUBE_MAP_FACES) {
    //     this.setImageData({
    //       target: face,
    //       data: opts[face],
    //       width, height, format, type, dataFormat, border, mipmaps
    //     });
    //   }
    // });

    this.setCubeMapImageData(opts);

    // Called here so that GL.
    // TODO - should genMipmap() be called on the cubemap or on the faces?
    if (mipmaps) {
      this.generateMipmap(opts);
    }

    // Store opts for accessors
    this.opts = opts;
  }

  subImage({face, data, x = 0, y = 0, mipmapLevel = 0}) {
    return this._subImage({target: face, data, x, y, mipmapLevel});
  }

  /* eslint-disable max-statements, max-len */
  setCubeMapImageData({
    width,
    height,
    pixels,
    data,
    border = 0,
    format = GL.RGBA,
    type = GL.UNSIGNED_BYTE,
    generateMipmap = false
  }) {
    const {gl} = this;
    pixels = pixels || data;
    this.bind();
    if (this.width || this.height) {
      for (const face of FACES) {
        gl.texImage2D(face, 0, format, width, height, border, format, type, pixels[face]);
      }
    } else {
      for (const face of FACES) {
        gl.texImage2D(face, 0, format, format, type, pixels[face]);
      }
    }
  }

  bind({index} = {}) {
    if (index !== undefined) {
      this.gl.activeTexture(GL.TEXTURE0 + index);
    }
    this.gl.bindTexture(GL.TEXTURE_CUBE_MAP, this.handle);
    return index;
  }

  unbind() {
    this.gl.bindTexture(GL.TEXTURE_CUBE_MAP, null);
    return this;
  }
}

TextureCube.FACES = FACES;
