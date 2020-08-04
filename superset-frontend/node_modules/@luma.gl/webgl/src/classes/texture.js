import GL from '@luma.gl/constants';

import Resource from './resource';
import Buffer from './buffer';
import {
  TEXTURE_FORMATS,
  DATA_FORMAT_CHANNELS,
  TYPE_SIZES,
  isFormatSupported,
  isLinearFilteringSupported
} from './texture-formats';

import {withParameters} from '../context';
import {isWebGL2, assertWebGL2Context, WebGLBuffer} from '../webgl-utils';
import {log, uid, isPowerOfTwo, assert} from '../utils';

// Supported min filters for NPOT texture.
const NPOT_MIN_FILTERS = [GL.LINEAR, GL.NEAREST];

export default class Texture extends Resource {
  static isSupported(gl, {format, linearFiltering} = {}) {
    let supported = true;
    if (format) {
      supported = supported && isFormatSupported(gl, format);
      supported = supported && (!linearFiltering || isLinearFilteringSupported(gl, format));
    }
    return supported;
  }

  // target cannot be modified by bind:
  // textures are special because when you first bind them to a target,
  // they get special information. When you first bind a texture as a
  // GL_TEXTURE_2D, you are actually setting special state in the texture.
  // You are saying that this texture is a 2D texture.
  // And it will always be a 2D texture; this state cannot be changed ever.
  // If you have a texture that was first bound as a GL_TEXTURE_2D,
  // you must always bind it as a GL_TEXTURE_2D;
  // attempting to bind it as GL_TEXTURE_1D will give rise to an error
  // (while run-time).
  constructor(gl, props) {
    const {
      id = uid('texture'),
      handle,
      target
      // , magFilter, minFilter, wrapS, wrapT
    } = props;

    super(gl, {id, handle});

    this.target = target;
    this.textureUnit = undefined;

    // Program.draw() checks the loaded flag of all textures to avoid
    // Textures that are still loading from promises
    // Set to true as soon as texture has been initialized with valid data
    this.loaded = false;

    this.width = undefined;
    this.height = undefined;
    this.depth = undefined;
    this.format = undefined;
    this.type = undefined;
    this.dataFormat = undefined;
    this.border = undefined;
    this.textureUnit = undefined;
    this.mipmaps = undefined;
  }

  toString() {
    return `Texture(${this.id},${this.width}x${this.height})`;
  }

  /* eslint-disable max-len, max-statements */
  initialize(props = {}) {
    let data = props.data;

    if (data instanceof Promise) {
      data.then(resolvedImageData =>
        this.initialize(
          Object.assign({}, props, {
            pixels: resolvedImageData,
            data: resolvedImageData
          })
        )
      );
      return this;
    }

    const {
      pixels = null,
      format = GL.RGBA,
      border = 0,
      recreate = false,
      parameters = {},
      pixelStore = {},
      textureUnit = undefined,
      // Deprecated parameters
      unpackFlipY = true
    } = props;

    let {mipmaps = true} = props;

    // pixels variable is for API compatibility purpose
    if (!data) {
      // TODO - This looks backwards? Commenting out for now until we decide
      // which prop to use
      // log.deprecated('data', 'pixels')();
      data = pixels;
    }

    let {width, height, dataFormat, type} = props;
    const {depth = 0} = props;

    // Deduce width and height
    ({width, height, dataFormat, type} = this._deduceParameters({
      format,
      type,
      dataFormat,
      compressed: false,
      data,
      width,
      height
    }));

    // Store opts for accessors
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.format = format;
    this.type = type;
    this.dataFormat = dataFormat;
    this.border = border;
    this.textureUnit = textureUnit;

    if (Number.isFinite(this.textureUnit)) {
      this.gl.activeTexture(GL.TEXTURE0 + this.textureUnit);
      this.gl.bindTexture(this.target, this.handle);
    }

    // Note: luma.gl defaults to GL.UNPACK_FLIP_Y_WEBGL = true;
    // TODO - compare v4 and v3
    const DEFAULT_TEXTURE_SETTINGS = {
      // Pixel store
      [GL.UNPACK_FLIP_Y_WEBGL]: unpackFlipY
    };
    const glSettings = Object.assign({}, DEFAULT_TEXTURE_SETTINGS, pixelStore);

    if (mipmaps && this._isNPOT()) {
      log.warn(`texture: ${this} is Non-Power-Of-Two, disabling mipmaping`)();
      mipmaps = false;

      this._updateForNPOT(parameters);
    }

    this.mipmaps = mipmaps;

    this.setImageData({
      data,
      width,
      height,
      depth,
      format,
      type,
      dataFormat,
      border,
      mipmaps,
      parameters: glSettings
    });

    if (mipmaps) {
      this.generateMipmap();
    }

    // Set texture sampler parameters
    this.setParameters(parameters);

    // TODO - Store data to enable auto recreate on context loss
    if (recreate) {
      this.data = data;
    }

    return this;
  }

  // If size has changed, reinitializes with current format
  // note clears image and mipmaps
  resize({height, width, mipmaps = false}) {
    if (width !== this.width || height !== this.height) {
      return this.initialize({
        width,
        height,
        format: this.format,
        type: this.type,
        dataFormat: this.dataFormat,
        border: this.border,
        mipmaps
      });
    }
    return this;
  }

  // Call to regenerate mipmaps after modifying texture(s)
  generateMipmap(params = {}) {
    if (this._isNPOT()) {
      log.warn(`texture: ${this} is Non-Power-Of-Two, disabling mipmaping`)();
      return this;
    }

    this.mipmaps = true;

    this.gl.bindTexture(this.target, this.handle);
    withParameters(this.gl, params, () => {
      this.gl.generateMipmap(this.target);
    });
    this.gl.bindTexture(this.target, null);
    return this;
  }

  /*
   * Allocates storage
   * @param {*} pixels -
   *  null - create empty texture of specified format
   *  Typed array - init from image data in typed array
   *  Buffer|WebGLBuffer - (WEBGL2) init from image data in WebGLBuffer
   *  HTMLImageElement|Image - Inits with content of image. Auto width/height
   *  HTMLCanvasElement - Inits with contents of canvas. Auto width/height
   *  HTMLVideoElement - Creates video texture. Auto width/height
   *
   * @param {GLint} width -
   * @param {GLint} height -
   * @param {GLint} mipMapLevel -
   * @param {GLenum} format - format of image data.
   * @param {GLenum} type
   *  - format of array (autodetect from type) or
   *  - (WEBGL2) format of buffer
   * @param {Number} offset - (WEBGL2) offset from start of buffer
   * @param {GLint} border - must be 0.
   * @parameters - temporary settings to be applied, can be used to supply pixel store settings.
   */
  /* eslint-disable max-len, max-statements, complexity */
  setImageData(options) {
    this._trackDeallocatedMemory('Texture');

    const {
      target = this.target,
      pixels = null,
      level = 0,
      format = this.format,
      border = this.border,
      offset = 0,
      parameters = {}
    } = options;

    let {
      data = null,
      type = this.type,
      width = this.width,
      height = this.height,
      dataFormat = this.dataFormat,
      compressed = false
    } = options;

    // pixels variable is  for API compatibility purpose
    if (!data) {
      data = pixels;
    }

    ({type, dataFormat, compressed, width, height} = this._deduceParameters({
      format,
      type,
      dataFormat,
      compressed,
      data,
      width,
      height
    }));

    const {gl} = this;
    gl.bindTexture(this.target, this.handle);

    let dataType = null;
    ({data, dataType} = this._getDataType({data, compressed}));

    withParameters(this.gl, parameters, () => {
      switch (dataType) {
        case 'null':
          gl.texImage2D(target, level, format, width, height, border, dataFormat, type, data);
          break;
        case 'typed-array':
          // Looks like this assert is not necessary, as offset is ignored under WebGL1
          // assert((offset === 0 || isWebGL2(gl)), 'offset supported in WebGL2 only');
          gl.texImage2D(
            target,
            level,
            format,
            width,
            height,
            border,
            dataFormat,
            type,
            data,
            offset
          );
          break;
        case 'buffer':
          // WebGL2 enables creating textures directly from a WebGL buffer
          assertWebGL2Context(gl);
          gl.bindBuffer(GL.PIXEL_UNPACK_BUFFER, data.handle || data);
          gl.texImage2D(target, level, format, width, height, border, dataFormat, type, offset);
          gl.bindBuffer(GL.PIXEL_UNPACK_BUFFER, null);
          break;
        case 'browser-object':
          if (isWebGL2(gl)) {
            gl.texImage2D(target, level, format, width, height, border, dataFormat, type, data);
          } else {
            gl.texImage2D(target, level, format, dataFormat, type, data);
          }
          break;
        case 'compressed':
          gl.compressedTexImage2D(target, level, format, width, height, border, data);
          break;
        default:
          assert(false, 'Unknown image data type');
      }
    });

    if (data && data.byteLength) {
      this._trackAllocatedMemory(data.byteLength, 'Texture');
    } else {
      // NOTE(Tarek): Default to RGBA bytes
      const channels = DATA_FORMAT_CHANNELS[this.dataFormat] || 4;
      const channelSize = TYPE_SIZES[this.type] || 1;

      this._trackAllocatedMemory(this.width * this.height * channels * channelSize, 'Texture');
    }

    this.loaded = true;

    return this;
  }
  /* eslint-enable max-len, max-statements, complexity */

  /**
   * Redefines an area of an existing texture
   * Note: does not allocate storage
   */
  /*
   * Redefines an area of an existing texture
   * @param {*} pixels, data -
   *  null - create empty texture of specified format
   *  Typed array - init from image data in typed array
   *  Buffer|WebGLBuffer - (WEBGL2) init from image data in WebGLBuffer
   *  HTMLImageElement|Image - Inits with content of image. Auto width/height
   *  HTMLCanvasElement - Inits with contents of canvas. Auto width/height
   *  HTMLVideoElement - Creates video texture. Auto width/height
   *
   * @param {GLint} x - xOffset from where texture to be updated
   * @param {GLint} y - yOffset from where texture to be updated
   * @param {GLint} width - width of the sub image to be updated
   * @param {GLint} height - height of the sub image to be updated
   * @param {GLint} level - mip level to be updated
   * @param {GLenum} format - internal format of image data.
   * @param {GLenum} type
   *  - format of array (autodetect from type) or
   *  - (WEBGL2) format of buffer or ArrayBufferView
   * @param {GLenum} dataFormat - format of image data.
   * @param {Number} offset - (WEBGL2) offset from start of buffer
   * @param {GLint} border - must be 0.
   * @parameters - temporary settings to be applied, can be used to supply pixel store settings.
   */
  setSubImageData({
    target = this.target,
    pixels = null,
    data = null,
    x = 0,
    y = 0,
    width = this.width,
    height = this.height,
    level = 0,
    format = this.format,
    type = this.type,
    dataFormat = this.dataFormat,
    compressed = false,
    offset = 0,
    border = this.border,
    parameters = {}
  }) {
    ({type, dataFormat, compressed, width, height} = this._deduceParameters({
      format,
      type,
      dataFormat,
      compressed,
      data,
      width,
      height
    }));

    assert(this.depth === 0, 'texSubImage not supported for 3D textures');

    // pixels variable is  for API compatibility purpose
    if (!data) {
      data = pixels;
    }

    // Support ndarrays
    if (data && data.data) {
      const ndarray = data;
      data = ndarray.data;
      width = ndarray.shape[0];
      height = ndarray.shape[1];
    }

    // Support buffers
    if (data instanceof Buffer) {
      data = data.handle;
    }

    this.gl.bindTexture(this.target, this.handle);

    withParameters(this.gl, parameters, () => {
      // TODO - x,y parameters
      if (compressed) {
        this.gl.compressedTexSubImage2D(target, level, x, y, width, height, format, data);
      } else if (data === null) {
        this.gl.texSubImage2D(target, level, x, y, width, height, dataFormat, type, null);
      } else if (ArrayBuffer.isView(data)) {
        this.gl.texSubImage2D(target, level, x, y, width, height, dataFormat, type, data, offset);
      } else if (data instanceof WebGLBuffer) {
        // WebGL2 allows us to create texture directly from a WebGL buffer
        assertWebGL2Context(this.gl);
        // This texImage2D signature uses currently bound GL.PIXEL_UNPACK_BUFFER
        this.gl.bindBuffer(GL.PIXEL_UNPACK_BUFFER, data);
        this.gl.texSubImage2D(target, level, x, y, width, height, dataFormat, type, offset);
        this.gl.bindBuffer(GL.PIXEL_UNPACK_BUFFER, null);
      } else if (isWebGL2(this.gl)) {
        // Assume data is a browser supported object (ImageData, Canvas, ...)
        this.gl.texSubImage2D(target, level, x, y, width, height, dataFormat, type, data);
      } else {
        this.gl.texSubImage2D(target, level, x, y, dataFormat, type, data);
      }
    });

    this.gl.bindTexture(this.target, null);
  }
  /* eslint-enable max-len, max-statements, complexity */

  /**
   * Defines a two-dimensional texture image or cube-map texture image with
   * pixels from the current framebuffer (rather than from client memory).
   * (gl.copyTexImage2D wrapper)
   *
   * Note that binding a texture into a Framebuffer's color buffer and
   * rendering can be faster.
   */
  copyFramebuffer(opts = {}) {
    log.error(
      'Texture.copyFramebuffer({...}) is no logner supported, use copyToTexture(source, target, opts})'
    )();
    return null;
  }

  getActiveUnit() {
    return this.gl.getParameter(GL.ACTIVE_TEXTURE) - GL.TEXTURE0;
  }

  // target cannot be modified by bind:
  // textures are special because when you first bind them to a target,
  // they get special information. When you first bind a texture as a
  // GL_TEXTURE_2D, you are actually setting special state in the texture.
  // You are saying that this texture is a 2D texture.
  // And it will always be a 2D texture; this state cannot be changed ever.
  // If you have a texture that was first bound as a GL_TEXTURE_2D,
  // you must always bind it as a GL_TEXTURE_2D;
  // attempting to bind it as GL_TEXTURE_1D will give rise to an error
  // (while run-time).

  bind(textureUnit = this.textureUnit) {
    const {gl} = this;

    if (textureUnit !== undefined) {
      this.textureUnit = textureUnit;
      gl.activeTexture(gl.TEXTURE0 + textureUnit);
    }

    gl.bindTexture(this.target, this.handle);
    return textureUnit;
  }

  unbind(textureUnit = this.textureUnit) {
    const {gl} = this;

    if (textureUnit !== undefined) {
      this.textureUnit = textureUnit;
      gl.activeTexture(gl.TEXTURE0 + textureUnit);
    }

    gl.bindTexture(this.target, null);
    return textureUnit;
  }

  // PRIVATE METHODS

  _getDataType({data, compressed = false}) {
    if (compressed) {
      return {data, dataType: 'compressed'};
    }
    if (data === null) {
      return {data, dataType: 'null'};
    }
    if (ArrayBuffer.isView(data)) {
      return {data, dataType: 'typed-array'};
    }
    if (data instanceof Buffer) {
      return {data: data.handle, dataType: 'buffer'};
    }
    if (data instanceof WebGLBuffer) {
      return {data, dataType: 'buffer'};
    }
    // Assume data is a browser supported object (ImageData, Canvas, ...)
    return {data, dataType: 'browser-object'};
  }

  /* Copied from texture-2d.js
  // WebGL2
  setPixels(opts = {}) {
    const {
      buffer,
      width = null,
      height = null,
      mipmapLevel = 0,
      format = GL.RGBA,
      type = GL.UNSIGNED_BYTE,
      border = 0
    } = opts;

    const {gl} = this;

    // This signature of texImage2D uses currently bound GL.PIXEL_UNPACK_BUFFER
    gl.bindBuffer(GL.PIXEL_UNPACK_BUFFER, buffer.target);
    // And as always, we must also bind the texture itself
    this.bind();

    gl.texImage2D(gl.TEXTURE_2D,
      mipmapLevel, format, width, height, border, format, type, buffer.target);

    this.unbind();
    gl.bindBuffer(GL.GL.PIXEL_UNPACK_BUFFER, null);
    return this;
  }

  setImageDataFromCompressedBuffer(opts) {
    const {
      buffer,
      // offset = 0,
      width = null,
      height = null,
      mipmapLevel = 0,
      internalFormat = GL.RGBA,
      // format = GL.RGBA,
      // type = GL.UNSIGNED_BYTE,
      border = 0
    } = opts;

    const {gl} = this;
    gl.compressedTexImage2D(this.target,
      mipmapLevel, internalFormat, width, height, border, buffer);
    // gl.compressedTexSubImage2D(target,
    //   level, xoffset, yoffset, width, height, format, ArrayBufferView? pixels);
    return this;
  }

  copySubImage(opts) {
    const {
      // pixels,
      // offset = 0,
      // x,
      // y,
      // width,
      // height,
      // mipmapLevel = 0,
      // internalFormat = GL.RGBA,
      // type = GL.UNSIGNED_BYTE,
      // border = 0
    } = opts;

    // if (pixels instanceof ArrayBufferView) {
    //   gl.texSubImage2D(target, level, x, y, width, height, format, type, pixels);
    // }
    // gl.texSubImage2D(target, level, x, y, format, type, ? pixels);
    // gl.texSubImage2D(target, level, x, y, format, type, HTMLImageElement pixels);
    // gl.texSubImage2D(target, level, x, y, format, type, HTMLCanvasElement pixels);
    // gl.texSubImage2D(target, level, x, y, format, type, HTMLVideoElement pixels);
    // // Additional signature in a WebGL 2 context:
    // gl.texSubImage2D(target, level, x, y, format, type, GLintptr offset);
  }
  */

  // HELPER METHODS

  _deduceParameters(opts) {
    const {format, data} = opts;
    let {width, height, dataFormat, type, compressed} = opts;

    // Deduce format and type from format
    const textureFormat = TEXTURE_FORMATS[format];
    dataFormat = dataFormat || (textureFormat && textureFormat.dataFormat);
    type = type || (textureFormat && textureFormat.types[0]);

    // Deduce compression from format
    compressed = compressed || (textureFormat && textureFormat.compressed);

    ({width, height} = this._deduceImageSize(data, width, height));

    return {dataFormat, type, compressed, width, height, format, data};
  }

  /* global ImageData, HTMLImageElement, HTMLCanvasElement, HTMLVideoElement, ImageBitmap */
  // eslint-disable-next-line complexity
  _deduceImageSize(data, width, height) {
    let size;

    if (typeof ImageData !== 'undefined' && data instanceof ImageData) {
      size = {width: data.width, height: data.height};
    } else if (typeof HTMLImageElement !== 'undefined' && data instanceof HTMLImageElement) {
      size = {width: data.naturalWidth, height: data.naturalHeight};
    } else if (typeof HTMLCanvasElement !== 'undefined' && data instanceof HTMLCanvasElement) {
      size = {width: data.width, height: data.height};
    } else if (typeof ImageBitmap !== 'undefined' && data instanceof ImageBitmap) {
      size = {width: data.width, height: data.height};
    } else if (typeof HTMLVideoElement !== 'undefined' && data instanceof HTMLVideoElement) {
      size = {width: data.videoWidth, height: data.videoHeight};
    } else if (!data) {
      size = {width: width >= 0 ? width : 1, height: height >= 0 ? height : 1};
    } else {
      size = {width, height};
    }

    assert(size, 'Could not deduced texture size');
    assert(
      width === undefined || size.width === width,
      'Deduced texture width does not match supplied width'
    );
    assert(
      height === undefined || size.height === height,
      'Deduced texture height does not match supplied height'
    );

    return size;
  }

  // RESOURCE METHODS

  _createHandle() {
    return this.gl.createTexture();
  }

  _deleteHandle() {
    this.gl.deleteTexture(this.handle);
    this._trackDeallocatedMemory('Texture');
  }

  _getParameter(pname) {
    switch (pname) {
      case GL.TEXTURE_WIDTH:
        return this.width;
      case GL.TEXTURE_HEIGHT:
        return this.height;
      default:
        this.gl.bindTexture(this.target, this.handle);
        const value = this.gl.getTexParameter(this.target, pname);
        this.gl.bindTexture(this.target, null);
        return value;
    }
  }

  _setParameter(pname, param) {
    this.gl.bindTexture(this.target, this.handle);

    // NOTE: Apply NPOT workaround
    param = this._getNPOTParam(pname, param);

    // Apparently there are some integer/float conversion rules that made
    // the WebGL committe expose two parameter setting functions in JavaScript.
    // For now, pick the float version for parameters specified as GLfloat.
    switch (pname) {
      case GL.TEXTURE_MIN_LOD:
      case GL.TEXTURE_MAX_LOD:
        this.gl.texParameterf(this.handle, pname, param);
        break;

      case GL.TEXTURE_WIDTH:
      case GL.TEXTURE_HEIGHT:
        assert(false);
        break;

      default:
        this.gl.texParameteri(this.target, pname, param);
        break;
    }

    this.gl.bindTexture(this.target, null);
    return this;
  }

  _isNPOT() {
    if (isWebGL2(this.gl)) {
      // NPOT restriction is only for WebGL1
      return false;
    }
    // Width and height not available, consider it is not NPOT texture
    if (!this.width || !this.height) {
      return false;
    }
    return !isPowerOfTwo(this.width) || !isPowerOfTwo(this.height);
  }

  // Update default settings which are not supported by NPOT textures.
  _updateForNPOT(parameters) {
    if (parameters[this.gl.TEXTURE_MIN_FILTER] === undefined) {
      // log.warn(`texture: ${this} is Non-Power-Of-Two, forcing TEXTURE_MIN_FILTER to LINEAR`)();
      parameters[this.gl.TEXTURE_MIN_FILTER] = this.gl.LINEAR;
    }
    if (parameters[this.gl.TEXTURE_WRAP_S] === undefined) {
      // log.warn(`texture: ${this} is Non-Power-Of-Two, forcing TEXTURE_WRAP_S to CLAMP_TO_EDGE`)();
      parameters[this.gl.TEXTURE_WRAP_S] = this.gl.CLAMP_TO_EDGE;
    }
    if (parameters[this.gl.TEXTURE_WRAP_T] === undefined) {
      // log.warn(`texture: ${this} is Non-Power-Of-Two, forcing TEXTURE_WRAP_T to CLAMP_TO_EDGE`)();
      parameters[this.gl.TEXTURE_WRAP_T] = this.gl.CLAMP_TO_EDGE;
    }
  }

  _getNPOTParam(pname, param) {
    if (this._isNPOT()) {
      switch (pname) {
        case GL.TEXTURE_MIN_FILTER:
          if (NPOT_MIN_FILTERS.indexOf(param) === -1) {
            // log.warn(`texture: ${this} is Non-Power-Of-Two, forcing TEXTURE_MIN_FILTER to LINEAR`)();
            param = GL.LINEAR;
          }
          break;
        case GL.TEXTURE_WRAP_S:
        case GL.TEXTURE_WRAP_T:
          if (param !== GL.CLAMP_TO_EDGE) {
            // log.warn(`texture: ${this} is Non-Power-Of-Two, ${getKey(this.gl, pname)} to CLAMP_TO_EDGE`)();
            param = GL.CLAMP_TO_EDGE;
          }
          break;
        default:
          break;
      }
    }
    return param;
  }
}
