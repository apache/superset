import GL from '@luma.gl/constants';

import Resource from './resource';
import Texture2D from './texture-2d';
import Renderbuffer from './renderbuffer';
import {clear, clearBuffer} from './clear';
import {copyToDataUrl} from './copy-and-blit.js';

import {getFeatures} from '../features';

import {isWebGL2, assertWebGL2Context, getKey} from '../webgl-utils';

import {log, assert} from '../utils';

const ERR_MULTIPLE_RENDERTARGETS = 'Multiple render targets not supported';

export default class Framebuffer extends Resource {
  static isSupported(
    gl,
    {
      colorBufferFloat, // Whether floating point textures can be rendered and read
      colorBufferHalfFloat // Whether half float textures can be rendered and read
    } = {}
  ) {
    let supported = true;

    if (colorBufferFloat) {
      supported = Boolean(
        // WebGL 2
        gl.getExtension('EXT_color_buffer_float') ||
          // WebGL 1, not exposed on all platforms
          gl.getExtension('WEBGL_color_buffer_float') ||
          // WebGL 1, implicitly enables float render targets https://www.khronos.org/registry/webgl/extensions/OES_texture_float/
          gl.getExtension('OES_texture_float')
      );
    }

    if (colorBufferHalfFloat) {
      supported =
        supported &&
        Boolean(
          // WebGL 2
          gl.getExtension('EXT_color_buffer_float') ||
            // WebGL 1
            gl.getExtension('EXT_color_buffer_half_float')
        );
    }

    return supported;
  }

  // Create a Framebuffer wrapper for the default framebuffer (target === null)
  static getDefaultFramebuffer(gl) {
    gl.luma = gl.luma || {};
    gl.luma.defaultFramebuffer =
      gl.luma.defaultFramebuffer ||
      new Framebuffer(gl, {
        id: 'default-framebuffer',
        handle: null,
        attachments: {}
      });
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
    this.readBuffer = GL.COLOR_ATTACHMENT0;
    this.drawBuffers = [GL.COLOR_ATTACHMENT0];
    this.ownResources = [];
    this.initialize(opts);

    Object.seal(this);
  }

  get color() {
    return this.attachments[GL.COLOR_ATTACHMENT0] || null;
  }

  get texture() {
    return this.attachments[GL.COLOR_ATTACHMENT0] || null;
  }

  get depth() {
    return (
      this.attachments[GL.DEPTH_ATTACHMENT] || this.attachments[GL.DEPTH_STENCIL_ATTACHMENT] || null
    );
  }

  get stencil() {
    return (
      this.attachments[GL.STENCIL_ATTACHMENT] ||
      this.attachments[GL.DEPTH_STENCIL_ATTACHMENT] ||
      null
    );
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
      attachments = this._createDefaultAttachments(color, depth, stencil, width, height);
    }

    this.update({clearAttachments: true, attachments, readBuffer, drawBuffers});

    // Checks that framebuffer was properly set up, if not, throws an explanatory error
    if (attachments && check) {
      this.checkStatus();
    }
  }

  delete() {
    for (const resource of this.ownResources) {
      resource.delete();
    }
    super.delete();
  }
  update({
    attachments = {},
    readBuffer,
    drawBuffers,
    clearAttachments = false,
    resizeAttachments = true
  }) {
    this.attach(attachments, {clearAttachments, resizeAttachments});

    const {gl} = this;
    // Multiple render target support, set read buffer and draw buffers
    const prevHandle = gl.bindFramebuffer(GL.FRAMEBUFFER, this.handle);
    if (readBuffer) {
      this._setReadBuffer(readBuffer);
    }
    if (drawBuffers) {
      this._setDrawBuffers(drawBuffers);
    }
    gl.bindFramebuffer(GL.FRAMEBUFFER, prevHandle || null);

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
      log.log(2, `Resizing framebuffer ${this.id} to ${width}x${height}`)();
    }
    for (const attachmentPoint in this.attachments) {
      this.attachments[attachmentPoint].resize({width, height});
    }
    this.width = width;
    this.height = height;
    return this;
  }

  // Attach from a map of attachments
  attach(attachments, {clearAttachments = false, resizeAttachments = true} = {}) {
    const newAttachments = {};

    // Any current attachments need to be removed, add null values to map
    if (clearAttachments) {
      Object.keys(this.attachments).forEach(key => {
        newAttachments[key] = null;
      });
    }

    // Overlay the new attachments
    Object.assign(newAttachments, attachments);

    const prevHandle = this.gl.bindFramebuffer(GL.FRAMEBUFFER, this.handle);

    // Walk the attachments
    for (const key in newAttachments) {
      // Ensure key is not undefined
      assert(key !== undefined, 'Misspelled framebuffer binding point?');

      const attachment = Number(key);

      const descriptor = newAttachments[attachment];
      let object = descriptor;
      if (!object) {
        this._unattach(attachment);
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
      if (resizeAttachments && object) {
        object.resize({width: this.width, height: this.height});
      }
    }

    this.gl.bindFramebuffer(GL.FRAMEBUFFER, prevHandle || null);

    // Assign to attachments and remove any nulls to get a clean attachment map
    Object.assign(this.attachments, attachments);
    Object.keys(this.attachments)
      .filter(key => !this.attachments[key])
      .forEach(key => {
        delete this.attachments[key];
      });
  }

  checkStatus() {
    const {gl} = this;
    const status = this.getStatus();
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(_getFrameBufferStatus(status));
    }
    return this;
  }

  getStatus() {
    const {gl} = this;
    const prevHandle = gl.bindFramebuffer(GL.FRAMEBUFFER, this.handle);
    const status = gl.checkFramebufferStatus(GL.FRAMEBUFFER);
    gl.bindFramebuffer(GL.FRAMEBUFFER, prevHandle || null);
    return status;
  }

  clear({color, depth, stencil, drawBuffers = []} = {}) {
    // Bind framebuffer and delegate to global clear functions
    const prevHandle = this.gl.bindFramebuffer(GL.FRAMEBUFFER, this.handle);

    if (color || depth || stencil) {
      clear(this.gl, {color, depth, stencil});
    }

    drawBuffers.forEach((value, drawBuffer) => {
      clearBuffer({drawBuffer, value});
    });

    this.gl.bindFramebuffer(GL.FRAMEBUFFER, prevHandle || null);

    return this;
  }

  // NOTE: Slow requires roundtrip to GPU
  // App can provide pixelArray or have it auto allocated by this method
  // @returns {Uint8Array|Uint16Array|FloatArray} - pixel array,
  //  newly allocated by this method unless provided by app.
  readPixels(opts = {}) {
    log.error(
      'Framebuffer.readPixels() is no logner supported, use readPixelsToArray(framebuffer)'
    )();
    return null;
  }

  // Reads data into provided buffer object asynchronously
  // This function doesn't wait for copy to be complete, it programs GPU to perform a DMA transffer.
  readPixelsToBuffer(opts = {}) {
    log.error(
      'Framebuffer.readPixelsToBuffer()is no logner supported, use readPixelsToBuffer(framebuffer)'
    )();
    return null;
  }

  // Reads pixels as a dataUrl
  copyToDataUrl(opts = {}) {
    log.error(
      'Framebuffer.copyToDataUrl() is no logner supported, use copyToDataUrl(framebuffer)'
    )();
    return null;
  }

  // Reads pixels into an HTML Image
  copyToImage(opts = {}) {
    log.error('Framebuffer.copyToImage() is no logner supported, use copyToImage(framebuffer)')();
    return null;
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
  // NOTE: assumes texture has enough storage allocated
  // eslint-disable-next-line complexity
  copyToTexture(opts = {}) {
    log.error(
      'Framebuffer.copyToTexture({...}) is no logner supported, use copyToTexture(source, target, opts})'
    )();
    return null;
  }

  // WEBGL2 INTERFACE

  // Copies a rectangle of pixels between framebuffers
  // eslint-disable-next-line complexity
  blit(opts = {}) {
    log.error('Framebuffer.blit({...}) is no logner supported, use blit(source, target, opts)')();
    return null;
  }

  // signals to the GL that it need not preserve all pixels of a specified region of the framebuffer
  invalidate({attachments = [], x = 0, y = 0, width, height}) {
    const {gl} = this;
    assertWebGL2Context(gl);
    const prevHandle = gl.bindFramebuffer(GL.READ_FRAMEBUFFER, this.handle);
    const invalidateAll = x === 0 && y === 0 && width === undefined && height === undefined;
    if (invalidateAll) {
      gl.invalidateFramebuffer(GL.READ_FRAMEBUFFER, attachments);
    } else {
      gl.invalidateFramebuffer(GL.READ_FRAMEBUFFER, attachments, x, y, width, height);
    }
    gl.bindFramebuffer(GL.READ_FRAMEBUFFER, prevHandle);
    return this;
  }

  // Return the value for `pname` of the specified attachment.
  // The type returned is the type of the requested pname
  getAttachmentParameter(attachment, pname, keys) {
    let value = this._getAttachmentParameterFallback(pname);
    if (value === null) {
      this.gl.bindFramebuffer(GL.FRAMEBUFFER, this.handle);
      value = this.gl.getFramebufferAttachmentParameter(GL.FRAMEBUFFER, attachment, pname);
      this.gl.bindFramebuffer(GL.FRAMEBUFFER, null);
    }
    if (keys && value > 1000) {
      value = getKey(this.gl, value);
    }
    return value;
  }

  getAttachmentParameters(
    attachment = GL.COLOR_ATTACHMENT0,
    keys,
    parameters = this.constructor.ATTACHMENT_PARAMETERS || []
  ) {
    const values = {};
    for (const pname of parameters) {
      const key = keys ? getKey(this.gl, pname) : pname;
      values[key] = this.getAttachmentParameter(attachment, pname, keys);
    }
    return values;
  }

  getParameters(keys = true) {
    const attachments = Object.keys(this.attachments);
    // if (this === this.gl.luma.defaultFramebuffer) {
    //   attachments = [GL.COLOR_ATTACHMENT0, GL.DEPTH_STENCIL_ATTACHMENT];
    // }
    const parameters = {};
    for (const attachmentName of attachments) {
      const attachment = Number(attachmentName);
      const key = keys ? getKey(this.gl, attachment) : attachment;
      parameters[key] = this.getAttachmentParameters(attachment, keys);
    }
    return parameters;
  }

  // DEBUG

  // Note: Will only work when called in an event handler
  show() {
    /* global window */
    if (typeof window !== 'undefined') {
      window.open(copyToDataUrl(this), 'luma-debug-texture');
    }
    return this;
  }

  log(priority = 0, message = '') {
    if (priority > log.priority || typeof window === 'undefined') {
      return this;
    }
    message = message || `Framebuffer ${this.id}`;
    const image = copyToDataUrl(this, {maxHeight: 100});
    log.image({priority, message, image}, message)();
    return this;
  }

  // WEBGL INTERFACE
  bind({target = GL.FRAMEBUFFER} = {}) {
    this.gl.bindFramebuffer(target, this.handle);
    return this;
  }

  unbind({target = GL.FRAMEBUFFER} = {}) {
    this.gl.bindFramebuffer(target, null);
    return this;
  }

  // PRIVATE METHODS

  _createDefaultAttachments(color, depth, stencil, width, height) {
    let defaultAttachments = null;

    // Add a color buffer if requested and not supplied
    if (color) {
      defaultAttachments = defaultAttachments || {};
      defaultAttachments[GL.COLOR_ATTACHMENT0] = new Texture2D(this.gl, {
        id: `${this.id}-color0`,
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
        // Use LINEAR so subpixel algos like fxaa work.
        // Set WRAP modes that support NPOT textures too.
        parameters: {
          [GL.TEXTURE_MIN_FILTER]: GL.LINEAR,
          [GL.TEXTURE_MAG_FILTER]: GL.LINEAR,
          [GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
          [GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE
        }
      });
      // track to delete later
      this.ownResources.push(defaultAttachments[GL.COLOR_ATTACHMENT0]);
    }

    if (depth && stencil) {
      // TODO - handle separate stencil
      defaultAttachments = defaultAttachments || {};
      defaultAttachments[GL.DEPTH_STENCIL_ATTACHMENT] = new Renderbuffer(this.gl, {
        id: `${this.id}-depth-stencil`,
        format: GL.DEPTH24_STENCIL8,
        width,
        height: 111
      });
      // track to delete later
      this.ownResources.push(defaultAttachments[GL.DEPTH_STENCIL_ATTACHMENT]);
      // TODO - optional texture
      // new Texture2D(this.gl, {
      //   id: `${this.id}-depth-stencil`,
      //   format: GL.DEPTH24_STENCIL8,
      //   dataFormat: GL.DEPTH_STENCIL,
      //   type: GL.UNSIGNED_INT_24_8,
      //   width,
      //   height,
      //   mipmaps: false
      // });
    } else if (depth) {
      // Add a depth buffer if requested and not supplied
      defaultAttachments = defaultAttachments || {};
      defaultAttachments[GL.DEPTH_ATTACHMENT] = new Renderbuffer(this.gl, {
        id: `${this.id}-depth`,
        format: GL.DEPTH_COMPONENT16,
        width,
        height
      });
      // track to delete later
      this.ownResources.push(defaultAttachments[GL.DEPTH_ATTACHMENT]);
    } else if (stencil) {
      // TODO - handle separate stencil
      assert(false);
    }

    return defaultAttachments;
  }

  _unattach(attachment) {
    const oldAttachment = this.attachments[attachment];
    if (!oldAttachment) {
      return;
    }
    if (oldAttachment instanceof Renderbuffer) {
      // render buffer
      this.gl.framebufferRenderbuffer(GL.FRAMEBUFFER, attachment, GL.RENDERBUFFER, null);
    } else {
      // Must be a texture attachment
      this.gl.framebufferTexture2D(GL.FRAMEBUFFER, attachment, GL.TEXTURE_2D, null, 0);
    }
    delete this.attachments[attachment];
  }

  _attachRenderbuffer({attachment = GL.COLOR_ATTACHMENT0, renderbuffer}) {
    const {gl} = this;
    // TODO - is the bind needed?
    // gl.bindRenderbuffer(GL.RENDERBUFFER, renderbuffer.handle);
    gl.framebufferRenderbuffer(GL.FRAMEBUFFER, attachment, GL.RENDERBUFFER, renderbuffer.handle);
    // TODO - is the unbind needed?
    // gl.bindRenderbuffer(GL.RENDERBUFFER, null);

    this.attachments[attachment] = renderbuffer;
  }

  // layer = 0 - index into Texture2DArray and Texture3D or face for `TextureCubeMap`
  // level = 0 - mipmapLevel (must be 0 in WebGL1)
  _attachTexture({attachment = GL.COLOR_ATTACHMENT0, texture, layer, level}) {
    const {gl} = this;
    gl.bindTexture(texture.target, texture.handle);

    switch (texture.target) {
      case GL.TEXTURE_2D_ARRAY:
      case GL.TEXTURE_3D:
        gl.framebufferTextureLayer(GL.FRAMEBUFFER, attachment, texture.target, level, layer);
        break;

      case GL.TEXTURE_CUBE_MAP:
        // layer must be a cubemap face (or if index, converted to cube map face)
        const face = mapIndexToCubeMapFace(layer);
        gl.framebufferTexture2D(GL.FRAMEBUFFER, attachment, face, texture.handle, level);
        break;

      case GL.TEXTURE_2D:
        gl.framebufferTexture2D(GL.FRAMEBUFFER, attachment, GL.TEXTURE_2D, texture.handle, level);
        break;

      default:
        assert(false, 'Illegal texture type');
    }

    gl.bindTexture(texture.target, null);
    this.attachments[attachment] = texture;
  }

  // Expects framebuffer to be bound
  _setReadBuffer(readBuffer) {
    const {gl} = this;
    if (isWebGL2(gl)) {
      gl.readBuffer(readBuffer);
    } else {
      // Setting to color attachment 0 is a noop, so allow it in WebGL1
      assert(
        readBuffer === GL.COLOR_ATTACHMENT0 || readBuffer === GL.BACK,
        ERR_MULTIPLE_RENDERTARGETS
      );
    }
    this.readBuffer = readBuffer;
  }

  // Expects framebuffer to be bound
  _setDrawBuffers(drawBuffers) {
    const {gl} = this;
    if (isWebGL2(gl)) {
      gl.drawBuffers(drawBuffers);
    } else {
      const ext = gl.getExtension('WEBGL.draw_buffers');
      if (ext) {
        ext.drawBuffersWEBGL(drawBuffers);
      } else {
        // Setting a single draw buffer to color attachment 0 is a noop, allow in WebGL1
        assert(
          drawBuffers.length === 1 &&
            (drawBuffers[0] === GL.COLOR_ATTACHMENT0 || drawBuffers[0] === GL.BACK),
          ERR_MULTIPLE_RENDERTARGETS
        );
      }
    }
    this.drawBuffers = drawBuffers;
  }

  // Attempt to provide workable defaults for WebGL2 symbols under WebGL1
  // null means OK to query
  // TODO - move to webgl1 polyfills
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

  _bindHandle(handle) {
    return this.gl.bindFramebuffer(GL.FRAMEBUFFER, handle);
  }
}

// PUBLIC METHODS

// Map an index to a cube map face constant
function mapIndexToCubeMapFace(layer) {
  // TEXTURE_CUBE_MAP_POSITIVE_X is a big value (0x8515)
  // if smaller assume layer is index, otherwise assume it is already a cube map face constant
  return layer < GL.TEXTURE_CUBE_MAP_POSITIVE_X ? layer + GL.TEXTURE_CUBE_MAP_POSITIVE_X : layer;
}

// Helper METHODS
// Get a string describing the framebuffer error if installed
function _getFrameBufferStatus(status) {
  // Use error mapping if installed
  const STATUS = Framebuffer.STATUS || {};
  return STATUS[status] || `Framebuffer error ${status}`;
}

export const FRAMEBUFFER_ATTACHMENT_PARAMETERS = [
  GL.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME, // WebGLRenderbuffer or WebGLTexture
  GL.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE, // GL.RENDERBUFFER, GL.TEXTURE, GL.NONE
  // GL.FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE, // GL.TEXTURE_CUBE_MAP_POSITIVE_X, etc.
  // GL.FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL, // GLint
  // EXT_sRGB or WebGL2
  GL.FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING, // GL.LINEAR, GL.SRBG
  // WebGL2
  // GL.FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER, // GLint
  GL.FRAMEBUFFER_ATTACHMENT_RED_SIZE, // GLint
  GL.FRAMEBUFFER_ATTACHMENT_GREEN_SIZE, // GLint
  GL.FRAMEBUFFER_ATTACHMENT_BLUE_SIZE, // GLint
  GL.FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE, // GLint
  GL.FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE, // GLint
  GL.FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE // GLint
  // GL.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE
  // GL.FLOAT, GL.INT, GL.UNSIGNED_INT, GL.SIGNED_NORMALIZED, OR GL.UNSIGNED_NORMALIZED.
];

Framebuffer.ATTACHMENT_PARAMETERS = FRAMEBUFFER_ATTACHMENT_PARAMETERS;
