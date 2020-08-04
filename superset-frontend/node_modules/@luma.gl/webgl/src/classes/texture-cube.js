import GL from '@luma.gl/constants';
import Texture from './texture';
import {assertWebGLContext} from '../webgl-utils';
import {log} from '../utils';

const FACES = [
  GL.TEXTURE_CUBE_MAP_POSITIVE_X,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_X,
  GL.TEXTURE_CUBE_MAP_POSITIVE_Y,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_Y,
  GL.TEXTURE_CUBE_MAP_POSITIVE_Z,
  GL.TEXTURE_CUBE_MAP_NEGATIVE_Z
];

export default class TextureCube extends Texture {
  constructor(gl, props = {}) {
    assertWebGLContext(gl);

    super(gl, Object.assign({}, props, {target: GL.TEXTURE_CUBE_MAP}));

    this.initialize(props);

    Object.seal(this);
  }

  /* eslint-disable max-len, max-statements */
  initialize(props = {}) {
    const {mipmaps = true, parameters = {}} = props;

    // Store props for accessors
    this.opts = props;

    this.setCubeMapImageData(props).then(() => {
      this.loaded = true;

      // TODO - should genMipmap() be called on the cubemap or on the faces?
      // TODO - without generateMipmap() cube textures do not work at all!!! Why?
      if (mipmaps) {
        this.generateMipmap(props);
      }

      this.setParameters(parameters);
    });
  }

  subImage({face, data, x = 0, y = 0, mipmapLevel = 0}) {
    return this._subImage({target: face, data, x, y, mipmapLevel});
  }

  /* eslint-disable max-statements, max-len */
  async setCubeMapImageData({
    width,
    height,
    pixels,
    data,
    border = 0,
    format = GL.RGBA,
    type = GL.UNSIGNED_BYTE
  }) {
    const {gl} = this;
    const imageDataMap = pixels || data;

    // pixel data (imageDataMap) is an Object from Face to Image or Promise.
    // For example:
    // {
    // GL.TEXTURE_CUBE_MAP_POSITIVE_X : Image-or-Promise,
    // GL.TEXTURE_CUBE_MAP_NEGATIVE_X : Image-or-Promise,
    // ... }
    // To provide multiple level-of-details (LODs) this can be Face to Array
    // of Image or Promise, like this
    // {
    // GL.TEXTURE_CUBE_MAP_POSITIVE_X : [Image-or-Promise-LOD-0, Image-or-Promise-LOD-1],
    // GL.TEXTURE_CUBE_MAP_NEGATIVE_X : [Image-or-Promise-LOD-0, Image-or-Promise-LOD-1],
    // ... }

    const resolvedFaces = await Promise.all(
      FACES.map(face => {
        const facePixels = imageDataMap[face];
        return Promise.all(Array.isArray(facePixels) ? facePixels : [facePixels]);
      })
    );

    this.bind();

    FACES.forEach((face, index) => {
      if (resolvedFaces[index].length > 1 && this.opts.mipmaps !== false) {
        // If the user provides multiple LODs, then automatic mipmap
        // generation generateMipmap() should be disabled to avoid overwritting them.
        log.warn(`${this.id} has mipmap and multiple LODs.`)();
      }
      resolvedFaces[index].forEach((image, lodLevel) => {
        // TODO: adjust width & height for LOD!
        if (width && height) {
          gl.texImage2D(face, lodLevel, format, width, height, border, format, type, image);
        } else {
          gl.texImage2D(face, lodLevel, format, format, type, image);
        }
      });
    });

    this.unbind();
  }

  // TODO: update this method to accept LODs
  setImageDataForFace(options) {
    const {
      face,
      width,
      height,
      pixels,
      data,
      border = 0,
      format = GL.RGBA,
      type = GL.UNSIGNED_BYTE
      // generateMipmap = false // TODO
    } = options;

    const {gl} = this;

    const imageData = pixels || data;

    this.bind();
    if (imageData instanceof Promise) {
      imageData.then(resolvedImageData =>
        this.setImageDataForFace(
          Object.assign({}, options, {
            face,
            data: resolvedImageData,
            pixels: resolvedImageData
          })
        )
      );
    } else if (this.width || this.height) {
      gl.texImage2D(face, 0, format, width, height, border, format, type, imageData);
    } else {
      gl.texImage2D(face, 0, format, format, type, imageData);
    }

    return this;
  }
}

TextureCube.FACES = FACES;
