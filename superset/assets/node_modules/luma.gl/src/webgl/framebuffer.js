import GL from '../constants';

import Resource from './resource';
import Texture2D from './texture-2d';
import Renderbuffer from './renderbuffer';
import Buffer from './buffer';
import {clear, clearBuffer} from './clear';

import {withParameters} from '../webgl-context';
import {getFeatures} from '../webgl-context/context-features';

import {getTypedArrayFromGLType, getGLTypeFromTypedArray} from '../webgl-utils/typed-array-utils';
import {glFormatToComponents, glTypeToBytes} from '../webgl-utils/format-utils';
import {isWebGL2, assertWebGL2Context} from '../webgl-utils';
import {flipRows, scalePixels} from '../webgl-utils';

import {log} from '../utils';
import assert from '../utils/assert';

// Local constants - will collapse during minification
const GL_FRAMEBUFFER = 0x8D40;
const GL_DRAW_FRAMEBUFFER = 0x8CA8;
const GL_READ_FRAMEBUFFER = 0x8CA9;

const GL_COLOR_ATTACHMENT0 = 0x8CE0;
const GL_DEPTH_ATTACHMENT = 0x8D00;
const GL_STENCIL_ATTACHMENT = 0x8D20;
// const GL_DEPTH_STENCIL_ATTACHMENT = 0x821A;

const GL_RENDERBUFFER = 0x8D41;

const GL_TEXTURE_3D = 0x806F;
const GL_TEXTURE_2D_ARRAY = 0x8C1A;
const GL_TEXTURE_2D = 0x0DE1;
const GL_TEXTURE_CUBE_MAP = 0x8513;

const GL_TEXTURE_CUBE_MAP_POSITIVE_X = 0x8515;

const GL_DEPTH_BUFFER_BIT = 0x00000100;
const GL_STENCIL_BUFFER_BIT = 0x00000400;
const GL_COLOR_BUFFER_BIT = 0x00004000;

const ERR_MULTIPLE_RENDERTARGETS = 'Multiple render targets not supported';

export default class Framebuffer extends Resource {

  static isSupported(gl, {
    colorBufferFloat,    // Whether floating point textures can be rendered and read
    colorBufferHalfFloat // Whether half float textures can be rendered and read
  } = {}) {
    let supported = true;
    supported = colorBufferFloat &&
      gl.getExtension(isWebGL2(gl) ? 'EXT_color_buffer_float' : 'WEBGL_color_buffer_float');
    supported = colorBufferHalfFloat &&
      gl.getExtension(isWebGL2(gl) ? 'EXT_color_buffer_float' : 'EXT_color_buffer_half_float');
    return supported;
  }

  // Create a Framebuffer wrapper for the default framebuffer (target === null)
  static getDefaultFramebuffer(gl) {
    gl.luma = gl.luma || {};
    if (!gl.luma.defaultFramebuffer) {
      gl.luma.defaultFramebuffer = new Framebuffer(gl, {handle: null, attachments: {}});
    }
    // TODO - can we query for and get a handle to the GL.FRONT renderbuffer?
    return gl.luma.defaultFramebuffer;
  }

  get MAX_COLOR_ATTACHMENTS() {
    return this.gl.getParameter(this.gl.MAX_COLOR_ATTACHMENTS);
  }

  get MAX_DRAW_BUFFERS() {
    return this.gl.getParameter(this.gl.MAX_DRAW_BUFFERS);
  }

  constructor(gl, opts = {}) {
    super(gl, opts);

    // Public members
    this.width = null;
    this.height = null;
    this.attachments = {};
    this.readBuffer = GL_COLOR_ATTACHMENT0;
    this.drawBuffers = [GL_COLOR_ATTACHMENT0];
    this.initialize(opts);

    Object.seal(this);
  }

  get color() {
    return this.attachments[GL_COLOR_ATTACHMENT0] || null;
  }

  get texture() {
    return this.attachments[GL_COLOR_ATTACHMENT0] || null;
  }

  get depth() {
    return this.attachments[GL_DEPTH_ATTACHMENT] || null;
  }

  get stencil() {
    return this.attachments[GL_STENCIL_ATTACHMENT] || null;
  }

  initialize({
    width = 1,
    height = 1,
    attachments = null,
    color = true,
    depth = true,
    stencil = false,
    check = true,
    readBuffer,
    drawBuffers
  }) {
    assert(width >= 0 && height >= 0, 'Width and height need to be integers');

    // Store actual width and height for diffing
    this.width = width;
    this.height = height;

    // Resize any provided attachments - note that resize only resizes if needed
    // Note: A framebuffer has no separate size, it is defined by its attachments (which must agree)
    if (attachments) {
      for (const attachment in attachments) {
        const target = attachments[attachment];
        const object = Array.isArray(target) ? target[0] : target;
        object.resize({width, height});
      }
    } else {
      // Create any requested default attachments
      attachments = this._createDefaultAttachments({color, depth, stencil, width, height});
    }

    this.update({clearAttachments: true, attachments, readBuffer, drawBuffers});

    // Checks that framebuffer was properly set up, if not, throws an explanatory error
    if (attachments && check) {
      this.checkStatus();
    }
  }

  update({
    attachments = {},
    readBuffer,
    drawBuffers,
    clearAttachments = false
  }) {
    this.attach(attachments, {clearAttachments});

    const {gl} = this;
    // Multiple render target support, set read buffer and draw buffers
    const prevHandle = gl.bindFramebuffer(GL_FRAMEBUFFER, this.handle);
    if (readBuffer) {
      this._setReadBuffer(readBuffer);
    }
    if (drawBuffers) {
      this._setDrawBuffers(drawBuffers);
    }
    gl.bindFramebuffer(GL_FRAMEBUFFER, prevHandle || null);

    return this;
  }

  // Attachment resize is expected to be a noop if size is same
  resize({width, height} = {}) {
    // for default framebuffer, just update the stored size
    if (this.handle === null) {
      assert(width === undefined && height === undefined);
      this.width = this.gl.drawingBufferWidth;
      this.height = this.gl.drawingBufferHeight;
      return this;
    }

    if (width === undefined) {
      width = this.gl.drawingBufferWidth;
    }
    if (height === undefined) {
      height = this.gl.drawingBufferHeight;
    }

    if (width !== this.width && height !== this.height) {
      log.log(2, `Resizing framebuffer ${this.id} to ${width}x${height}`);
    }
    for (const attachmentPoint in this.attachments) {
      this.attachments[attachmentPoint].resize({width, height});
    }
    this.width = width;
    this.height = height;
    return this;
  }

  // Attach from a map of attachments
  attach(attachments, {
    clearAttachments = false
  } = {}) {
    const newAttachments = {};

    // Any current attachments need to be removed, add null values to map
    if (clearAttachments) {
      Object.keys(this.attachments).forEach(key => {
        newAttachments[key] = null;
      });
    }

    // Overlay the new attachments
    Object.assign(newAttachments, attachments);

    const prevHandle = this.gl.bindFramebuffer(GL_FRAMEBUFFER, this.handle);

    // Walk the attachments
    for (const attachment in newAttachments) {
      // Ensure key is not undefined
      assert(attachment !== 'undefined', 'Misspelled framebuffer binding point?');

      const descriptor = newAttachments[attachment];
      let object = descriptor;
      if (!object) {
        this._unattach({attachment});
      } else if (object instanceof Renderbuffer) {
        this._attachRenderbuffer({attachment, renderbuffer: object});
      } else if (Array.isArray(descriptor)) {
        const [texture, layer = 0, level = 0] = descriptor;
        object = texture;
        this._attachTexture({attachment, texture, layer, level});
      } else {
        this._attachTexture({attachment, texture: object, layer: 0, level: 0});
      }

      // Resize objects
      if (object) {
        object.resize({width: this.width, height: this.height});
      }
    }

    this.gl.bindFramebuffer(GL_FRAMEBUFFER, prevHandle || null);

    // Assign to attachments and remove any nulls to get a clean attachment map
    Object.assign(this.attachments, attachments);
    Object.keys(this.attachments).filter(key => !this.attachments[key]).forEach(key => {
      delete this.attachments[key];
    });
  }

  checkStatus() {
    const {gl} = this;
    const prevHandle = gl.bindFramebuffer(GL_FRAMEBUFFER, this.handle);
    const status = gl.checkFramebufferStatus(GL_FRAMEBUFFER);
    gl.bindFramebuffer(GL_FRAMEBUFFER, prevHandle || null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(_getFrameBufferStatus(status));
    }
    return this;
  }

  clear({
    color,
    depth,
    stencil,
    drawBuffers = []
  } = {}) {
    // Bind framebuffer and delegate to global clear functions
    const prevHandle = this.gl.bindFramebuffer(GL_FRAMEBUFFER, this.handle);

    if (color || depth || stencil) {
      clear(this.gl, {color, depth, stencil});
    }

    drawBuffers.forEach((value, drawBuffer) => {
      clearBuffer({drawBuffer, value});
    });

    this.gl.bindFramebuffer(GL_FRAMEBUFFER, prevHandle || null);

    return this;
  }

  // NOTE: Slow requires roundtrip to GPU
  // App can provide pixelArray or have it auto allocated by this method
  // @returns {Uint8Array|Uint16Array|FloatArray} - pixel array,
  //  newly allocated by this method unless provided by app.
  readPixels({
    x = 0,
    y = 0,
    width = this.width,
    height = this.height,
    format = GL.RGBA,
    type, // Auto deduced from pixelArray or gl.UNSIGNED_BYTE
    pixelArray = null,
    attachment = GL_COLOR_ATTACHMENT0 // TODO - support gl.readBuffer
  }) {
    const {gl} = this;

    // TODO - Set and unset gl.readBuffer
    if (attachment === GL.COLOR_ATTACHMENT0 && this.handle === null) {
      attachment = GL.FRONT;
    }

    // Deduce type and allocated pixelArray if needed
    if (!pixelArray) {
      // Allocate pixel array if not already available, using supplied type
      type = type || gl.UNSIGNED_BYTE;
      const ArrayType = getTypedArrayFromGLType(type, {clamped: false});
      const components = glFormatToComponents(format);
      // TODO - check for composite type (components = 1).
      pixelArray = pixelArray || new ArrayType(width * height * components);
    }

    // Pixel array available, if necessary, deduce type from it.
    type = type || getGLTypeFromTypedArray(pixelArray);

    const prevHandle = this.gl.bindFramebuffer(GL_FRAMEBUFFER, this.handle);
    this.gl.readPixels(x, y, width, height, format, type, pixelArray);
    this.gl.bindFramebuffer(GL_FRAMEBUFFER, prevHandle || null);

    return pixelArray;
  }

  // Reads data into provided buffer object asynchronously
  // This function doesn't wait for copy to be complete, it programs GPU to perform a DMA transffer.
  readPixelsToBuffer({
    x = 0,
    y = 0,
    width = this.width,
    height = this.height,
    format = GL.RGBA,
    type, // When not provided, auto deduced from buffer or GL.UNSIGNED_BYTE
    buffer = null, // A new Buffer object is created when not provided.
    byteOffset = 0 // byte offset in buffer object
  }) {
    const {gl} = this;

    // Asynchronus read (PIXEL_PACK_BUFFER) is WebGL2 only feature
    assertWebGL2Context(gl);

    // deduce type if not available.
    type = type || (buffer ? buffer.type : GL.UNSIGNED_BYTE);

    if (!buffer) {
      // Create new buffer with enough size
      const components = glFormatToComponents(format);
      const byteCount = glTypeToBytes(type);
      const bytes = byteOffset + (width * height * components * byteCount);
      buffer = new Buffer(gl, {
        bytes,
        type,
        size: components
      });
    }

    buffer.bind({target: GL.PIXEL_PACK_BUFFER});
    withParameters(gl, {framebuffer: this}, () => {
      gl.readPixels(x, y, width, height, format, type, byteOffset);
    });
    buffer.unbind({target: GL.PIXEL_PACK_BUFFER});

    return buffer;
  }

  // Reads pixels as a dataUrl
  copyToDataUrl({
    attachment = GL_COLOR_ATTACHMENT0, // TODO - support gl.readBuffer
    maxHeight = Number.MAX_SAFE_INTEGER
  } = {}) {
    let data = this.readPixels({attachment});

    // Scale down
    let {width, height} = this;
    while (height > maxHeight) {
      ({data, width, height} = scalePixels({data, width, height}));
    }

    // Flip to top down coordinate system
    flipRows({data, width, height});

    /* global document */
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    // Copy the pixels to a 2D canvas
    const imageData = context.createImageData(width, height);
    imageData.data.set(data);
    context.putImageData(imageData, 0, 0);

    return canvas.toDataURL();
  }

  // Reads pixels into an HTML Image
  copyToImage({
    image = null,
    attachment = GL_COLOR_ATTACHMENT0, // TODO - support gl.readBuffer
    maxHeight = Number.MAX_SAFE_INTEGER
  } = {}) {
    /* global Image */
    const dataUrl = this.readDataUrl({attachment});
    image = image || new Image();
    image.src = dataUrl;
    return image;
  }

  // copyToFramebuffer({width, height}) {
  //   const scaleX = width / this.width;
  //   const scaleY = height / this.height;
  //   const scale = Math.min(scaleX, scaleY);
  //   width = width * scale;
  //   height = height * scale;
  //   const scaledFramebuffer = new Framebuffer(this.gl, {width, height});
  //   this.blit();
  // }

  // Copy a rectangle from a framebuffer attachment into a texture (at an offset)
  copyToTexture({
    // Target
    texture,
    target, // for cubemaps
    xoffset = 0,
    yoffset = 0,
    zoffset = 0,
    mipmapLevel = 0,

    // Source
    attachment = GL_COLOR_ATTACHMENT0, // TODO - support gl.readBuffer
    x = 0,
    y = 0,
    width, // defaults to texture width
    height // defaults to texture height
  }) {
    const {gl} = this;
    const prevHandle = gl.bindFramebuffer(GL_FRAMEBUFFER, this.handle);
    const prevBuffer = gl.readBuffer(attachment);

    width = Number.isFinite(width) ? width : texture.width;
    height = Number.isFinite(height) ? height : texture.height;

    // target
    switch (texture.target) {
    case GL_TEXTURE_2D:
    case GL_TEXTURE_CUBE_MAP:
      gl.copyTexSubImage2D(
        target || texture.target,
        mipmapLevel,
        xoffset,
        yoffset,
        x,
        y,
        width,
        height
      );
      break;
    case GL_TEXTURE_2D_ARRAY:
    case GL_TEXTURE_3D:
      gl.copyTexSubImage3D(
        target || texture.target,
        mipmapLevel,
        xoffset,
        yoffset,
        zoffset,
        x,
        y,
        width,
        height
      );
      break;
    default:
    }

    gl.readBuffer(prevBuffer);
    gl.bindFramebuffer(GL_FRAMEBUFFER, prevHandle || null);
    return texture;
  }

  // WEBGL2 INTERFACE

  // Copies a rectangle of pixels between framebuffers
  blit({
    srcFramebuffer,
    attachment = GL_COLOR_ATTACHMENT0,
    srcX0 = 0, srcY0 = 0, srcX1, srcY1,
    dstX0 = 0, dstY0 = 0, dstX1, dstY1,
    color = true,
    depth = false,
    stencil = false,
    mask = 0,
    filter = GL.NEAREST
  }) {
    const {gl} = this;
    assertWebGL2Context(gl);

    if (!srcFramebuffer.handle && attachment === GL_COLOR_ATTACHMENT0) {
      attachment = GL.FRONT;
    }

    if (color) {
      mask |= GL_COLOR_BUFFER_BIT;
    }
    if (depth) {
      mask |= GL_DEPTH_BUFFER_BIT;
    }
    if (stencil) {
      mask |= GL_STENCIL_BUFFER_BIT;
    }
    assert(mask);

    srcX1 = srcX1 === undefined ? srcFramebuffer.width : srcX1;
    srcY1 = srcY1 === undefined ? srcFramebuffer.height : srcY1;
    dstX1 = dstX1 === undefined ? this.width : dstX1;
    dstY1 = dstY1 === undefined ? this.height : dstY1;

    const prevDrawHandle = gl.bindFramebuffer(GL_DRAW_FRAMEBUFFER, this.handle);
    const prevReadHandle = gl.bindFramebuffer(GL_READ_FRAMEBUFFER, srcFramebuffer.handle);
    gl.readBuffer(attachment);
    gl.blitFramebuffer(srcX0, srcY0, srcX1, srcY1, dstX0, dstY0, dstX1, dstY1, mask, filter);
    gl.readBuffer(this.readBuffer);
    gl.bindFramebuffer(GL_READ_FRAMEBUFFER, prevReadHandle || null);
    gl.bindFramebuffer(GL_DRAW_FRAMEBUFFER, prevDrawHandle || null);

    return this;
  }

  // signals to the GL that it need not preserve all pixels of a specified region
  // of the framebuffer
  invalidate({
    attachments = [],
    x = 0,
    y = 0,
    width,
    height
  }) {
    const {gl} = this;
    assertWebGL2Context(gl);
    const prevHandle = gl.bindFramebuffer(GL_READ_FRAMEBUFFER, this.handle);
    const invalidateAll = x === 0 && y === 0 && width === undefined && height === undefined;
    if (invalidateAll) {
      gl.invalidateFramebuffer(GL_READ_FRAMEBUFFER, attachments);
    } else {
      gl.invalidateFramebuffer(GL_READ_FRAMEBUFFER, attachments, x, y, width, height);
    }
    gl.bindFramebuffer(GL_READ_FRAMEBUFFER, prevHandle);
    return this;
  }

  // Return the value for `pname` of the specified attachment.
  // The type returned is the type of the requested pname
  getAttachmentParameter({
    attachment = GL_COLOR_ATTACHMENT0,
    pname
  } = {}) {
    let value = this._getAttachmentParameterFallback(pname);
    if (value === null) {
      this.gl.bindTexture(GL_FRAMEBUFFER, this.handle);
      value = this.gl.getFramebufferAttachmentParameter(GL_FRAMEBUFFER, attachment, pname);
      this.gl.bindTexture(GL_FRAMEBUFFER, null);
    }
    return value;
  }

  getAttachmentParameters(
    attachment = GL_COLOR_ATTACHMENT0,
    parameters = this.constructor.ATTACHMENT_PARAMETERS || {}
  ) {
    const values = {};
    for (const pname in parameters) {
      values[pname] = this.getAttachmentParameter(pname);
    }
    return this;
  }

  // DEBUG

  // Note: Will only work when called in an event handler
  show() {
    /* global window */
    if (typeof window !== 'undefined') {
      window.open(this.copyToDataUrl(), 'luma-debug-texture');
    }
    return this;
  }

  log({priority = 0, message = ''} = {}) {
    if (priority > log.priority || typeof window === 'undefined') {
      return this;
    }
    message = message || `Framebuffer ${this.id}`;
    const image = this.copyToDataUrl({maxHeight: 100});
    log.image({priority, message, image}, message)();
    return this;
  }

  // WEBGL INTERFACE
  bind({target = GL_FRAMEBUFFER} = {}) {
    this.gl.bindFramebuffer(target, this.handle);
    return this;
  }

  unbind({target = GL_FRAMEBUFFER} = {}) {
    this.gl.bindFramebuffer(target, null);
    return this;
  }

  // PRIVATE METHODS

  _createDefaultAttachments({color, depth, stencil, width, height}) {
    let defaultAttachments = null;

    // Add a color buffer if requested and not supplied
    if (color) {
      defaultAttachments = defaultAttachments || {};
      defaultAttachments[GL_COLOR_ATTACHMENT0] = new Texture2D(this.gl, {
        pixels: null, // reserves texture memory, but texels are undefined
        format: GL.RGBA,
        type: GL.UNSIGNED_BYTE,
        width,
        height,
        // Note: Mipmapping can be disabled by texture resource when we resize the texture
        // to a non-power-of-two dimenstion (NPOT texture) under WebGL1. To have consistant
        // behavior we always disable mipmaps.
        mipmaps: false,
        // Set MIN and MAG filtering parameters so mipmaps are not used in sampling.
        // Set WRAP modes that support NPOT textures too.
        parameters: {
          [GL.TEXTURE_MIN_FILTER]: GL.NEAREST,
          [GL.TEXTURE_MAG_FILTER]: GL.NEAREST,
          [GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
          [GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE
        }
      });
    }

    // Add a depth buffer if requested and not supplied
    if (depth) {
      defaultAttachments = defaultAttachments || {};
      defaultAttachments[GL_DEPTH_ATTACHMENT] =
        new Renderbuffer(this.gl, {format: GL.DEPTH_COMPONENT16, width, height});
    }

    // TODO - handle stencil and combined depth and stencil

    return defaultAttachments;
  }

  _unattach({attachment}) {
    this.gl.bindRenderbuffer(GL_RENDERBUFFER, this.handle);
    this.gl.framebufferRenderbuffer(GL_FRAMEBUFFER, attachment, GL_RENDERBUFFER, null);
    delete this.attachments[attachment];
  }

  _attachRenderbuffer({attachment = GL_COLOR_ATTACHMENT0, renderbuffer}) {
    const {gl} = this;
    // TODO - is the bind needed?
    // gl.bindRenderbuffer(GL_RENDERBUFFER, renderbuffer.handle);
    gl.framebufferRenderbuffer(GL_FRAMEBUFFER, attachment, GL_RENDERBUFFER, renderbuffer.handle);
    // TODO - is the unbind needed?
    // gl.bindRenderbuffer(GL_RENDERBUFFER, null);

    this.attachments[attachment] = renderbuffer;
  }

  // layer = 0 - index into Texture2DArray and Texture3D or face for `TextureCubeMap`
  // level = 0 - mipmapLevel (must be 0 in WebGL1)
  _attachTexture({attachment = GL_COLOR_ATTACHMENT0, texture, layer, level}) {
    const {gl} = this;
    gl.bindTexture(texture.target, texture.handle);

    switch (texture.target) {
    case GL_TEXTURE_2D_ARRAY:
    case GL_TEXTURE_3D:
      gl.framebufferTextureLayer(GL_FRAMEBUFFER, attachment, texture.target, level, layer);
      break;

    case GL_TEXTURE_CUBE_MAP:
      // layer must be a cubemap face (or if index, converted to cube map face)
      const face = mapIndexToCubeMapFace(layer);
      gl.framebufferTexture2D(GL_FRAMEBUFFER, attachment, face, texture.handle, level);
      break;

    case GL_TEXTURE_2D:
      gl.framebufferTexture2D(GL_FRAMEBUFFER, attachment, GL_TEXTURE_2D, texture.handle, level);
      break;

    default:
      assert(false, 'Illegal texture type');
    }

    gl.bindTexture(texture.target, null);
    this.attachments[attachment] = texture;
  }

  // Expects framebuffer to be bound
  _setReadBuffer(gl, readBuffer) {
    if (isWebGL2(gl)) {
      gl.readBuffer(readBuffer);
    } else {
      // Setting to color attachment 0 is a noop, so allow it in WebGL1
      assert(readBuffer === GL_COLOR_ATTACHMENT0 || readBuffer === GL.BACK,
        ERR_MULTIPLE_RENDERTARGETS);
    }
    this.readBuffer = readBuffer;
  }

  // Expects framebuffer to be bound
  _setDrawBuffers(gl, drawBuffers) {
    if (isWebGL2(gl)) {
      gl.drawBuffers(drawBuffers);
    } else {
      const ext = gl.getExtension('WEBGL_draw_buffers');
      if (ext) {
        ext.drawBuffersWEBGL(drawBuffers);
      } else {
        // Setting a single draw buffer to color attachment 0 is a noop, allow in WebGL1
        assert(drawBuffers.length === 1 &&
          (drawBuffers[0] === GL_COLOR_ATTACHMENT0 || drawBuffers[0] === GL.BACK),
          ERR_MULTIPLE_RENDERTARGETS);
      }
    }
    this.drawBuffers = drawBuffers;
  }

  // Attempt to provide workable defaults for WebGL2 symbols under WebGL1
  // null means OK to query
  /* eslint-disable complexity */
  _getAttachmentParameterFallback(pname) {
    const caps = getFeatures(this.gl);

    switch (pname) {
    case GL.FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER: // GLint
      return !caps.webgl2 ? 0 : null;
    case GL.FRAMEBUFFER_ATTACHMENT_RED_SIZE: // GLint
    case GL.FRAMEBUFFER_ATTACHMENT_GREEN_SIZE: // GLint
    case GL.FRAMEBUFFER_ATTACHMENT_BLUE_SIZE: // GLint
    case GL.FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE: // GLint
    case GL.FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE: // GLint
    case GL.FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE: // GLint
      return !caps.webgl2 ? 8 : null;
    case GL.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE: // GLenum
      return !caps.webgl2 ? GL.UNSIGNED_INT : null;
    case GL.FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING:
      return !caps.webgl2 && !caps.EXT_sRGB ? GL.LINEAR : null;
    default:
      return null;
    }
  }
  /* eslint-enable complexity */

  // RESOURCE METHODS

  _createHandle() {
    return this.gl.createFramebuffer();
  }

  _deleteHandle() {
    this.gl.deleteFramebuffer(this.handle);
  }
}

// PUBLIC METHODS

// Map an index to a cube map face constant
function mapIndexToCubeMapFace(layer) {
  // TEXTURE_CUBE_MAP_POSITIVE_X is a big value (0x8515)
  // if smaller assume layer is index, otherwise assume it is already a cube map face constant
  return layer < GL_TEXTURE_CUBE_MAP_POSITIVE_X ?
    layer + GL_TEXTURE_CUBE_MAP_POSITIVE_X :
    layer;
}

// Helper METHODS
// Get a string describing the framebuffer error if installed
function _getFrameBufferStatus(status) {
  // Use error mapping if installed
  const STATUS = Framebuffer.STATUS || {};
  return STATUS[status] || `Framebuffer error ${status}`;
}
