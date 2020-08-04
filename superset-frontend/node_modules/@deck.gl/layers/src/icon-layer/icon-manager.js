/* global document */
import GL from '@luma.gl/constants';
import {Texture2D, readPixelsToBuffer} from '@luma.gl/core';
import {loadImage} from '@loaders.gl/images';
import {createIterable} from '@deck.gl/core';

const DEFAULT_CANVAS_WIDTH = 1024;
const DEFAULT_BUFFER = 4;

const noop = () => {};

const DEFAULT_TEXTURE_PARAMETERS = {
  [GL.TEXTURE_MIN_FILTER]: GL.LINEAR_MIPMAP_LINEAR,
  // GL.LINEAR is the default value but explicitly set it here
  [GL.TEXTURE_MAG_FILTER]: GL.LINEAR
};

function nextPowOfTwo(number) {
  return Math.pow(2, Math.ceil(Math.log2(number)));
}

// resize image to given width and height
function resizeImage(ctx, imageData, width, height) {
  const {naturalWidth, naturalHeight} = imageData;
  if (width === naturalWidth && height === naturalHeight) {
    return imageData;
  }

  ctx.canvas.height = height;
  ctx.canvas.width = width;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
  ctx.drawImage(imageData, 0, 0, naturalWidth, naturalHeight, 0, 0, width, height);

  return ctx.canvas;
}

function getIconId(icon) {
  return icon && (icon.id || icon.url);
}

// traverse icons in a row of icon atlas
// extend each icon with left-top coordinates
function buildRowMapping(mapping, columns, yOffset) {
  for (let i = 0; i < columns.length; i++) {
    const {icon, xOffset} = columns[i];
    const id = getIconId(icon);
    mapping[id] = Object.assign({}, icon, {
      x: xOffset,
      y: yOffset
    });
  }
}

// resize texture without losing original data
function resizeTexture(texture, width, height) {
  const oldWidth = texture.width;
  const oldHeight = texture.height;
  const oldPixels = readPixelsToBuffer(texture, {});

  texture.resize({width, height});

  texture.setSubImageData({
    data: oldPixels,
    x: 0,
    y: height - oldHeight,
    width: oldWidth,
    height: oldHeight,
    parameters: DEFAULT_TEXTURE_PARAMETERS
  });

  texture.generateMipmap();

  oldPixels.delete();
  return texture;
}

/**
 * Generate coordinate mapping to retrieve icon left-top position from an icon atlas
 * @param icons {Array<Object>} list of icons, each icon requires url, width, height
 * @param buffer {Number} add buffer to the right and bottom side of the image
 * @param xOffset {Number} right position of last icon in old mapping
 * @param yOffset {Number} top position in last icon in old mapping
 * @param canvasWidth {Number} max width of canvas
 * @param mapping {object} old mapping
 * @returns {{mapping: {'/icon/1': {url, width, height, ...}},, canvasHeight: {Number}}}
 */
export function buildMapping({icons, buffer, mapping = {}, xOffset = 0, yOffset = 0, canvasWidth}) {
  // height of current row
  let rowHeight = 0;

  let columns = [];
  // Strategy to layout all the icons into a texture:
  // traverse the icons sequentially, layout the icons from left to right, top to bottom
  // when the sum of the icons width is equal or larger than canvasWidth,
  // move to next row starting from total height so far plus max height of the icons in previous row
  // row width is equal to canvasWidth
  // row height is decided by the max height of the icons in that row
  // mapping coordinates of each icon is its left-top position in the texture
  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i];
    const id = getIconId(icon);

    if (!mapping[id]) {
      const {height, width} = icon;

      // fill one row
      if (xOffset + width + buffer > canvasWidth) {
        buildRowMapping(mapping, columns, yOffset);

        xOffset = 0;
        yOffset = rowHeight + yOffset + buffer;
        rowHeight = 0;
        columns = [];
      }

      columns.push({
        icon,
        xOffset
      });

      xOffset = xOffset + width + buffer;
      rowHeight = Math.max(rowHeight, height);
    }
  }

  if (columns.length > 0) {
    buildRowMapping(mapping, columns, yOffset);
  }

  return {
    mapping,
    xOffset,
    yOffset,
    canvasWidth,
    canvasHeight: nextPowOfTwo(rowHeight + yOffset + buffer)
  };
}

// extract icons from data
// return icons should be unique, and not cached or cached but url changed
export function getDiffIcons(data, getIcon, cachedIcons) {
  if (!data || !getIcon) {
    return null;
  }

  cachedIcons = cachedIcons || {};
  const icons = {};
  const {iterable, objectInfo} = createIterable(data);
  for (const object of iterable) {
    objectInfo.index++;
    const icon = getIcon(object, objectInfo);
    const id = getIconId(icon);

    if (!icon) {
      throw new Error('Icon is missing.');
    }

    if (!icon.url) {
      throw new Error('Icon url is missing.');
    }

    if (!icons[id] && (!cachedIcons[id] || icon.url !== cachedIcons[id].url)) {
      icons[id] = icon;
    }
  }
  return icons;
}

export default class IconManager {
  constructor(
    gl,
    {
      onUpdate = noop // notify IconLayer when icon texture update
    }
  ) {
    this.gl = gl;
    this.onUpdate = onUpdate;

    this._getIcon = null;

    this._texture = null;
    this._externalTexture = null;
    this._mapping = {};

    this._autoPacking = false;

    // internal props used when autoPacking applied
    // right position of last icon
    this._xOffset = 0;
    // top position of last icon
    this._yOffset = 0;
    this._buffer = DEFAULT_BUFFER;
    this._canvasWidth = DEFAULT_CANVAS_WIDTH;
    this._canvasHeight = 0;
    this._canvas = null;
  }

  finalize() {
    if (this._texture) {
      this._texture.delete();
    }
  }

  getTexture() {
    return this._texture || this._externalTexture;
  }

  getIconMapping(object, objectInfo) {
    const icon = this._getIcon(object, objectInfo);
    const id = this._autoPacking ? getIconId(icon) : icon;
    return this._mapping[id] || {};
  }

  setProps({autoPacking, iconAtlas, iconMapping, data, getIcon}) {
    if (autoPacking !== undefined) {
      this._autoPacking = autoPacking;
    }

    if (getIcon) {
      this._getIcon = getIcon;
    }

    if (iconMapping) {
      this._mapping = iconMapping;
    }

    if (iconAtlas) {
      this._updateIconAtlas(iconAtlas);
    }

    if (this._autoPacking && (data || getIcon) && typeof document !== 'undefined') {
      this._canvas = this._canvas || document.createElement('canvas');

      this._updateAutoPacking(data);
    }
  }

  _updateIconAtlas(iconAtlas) {
    if (this._texture) {
      this._texture.delete();
      this._texture = null;
    }
    if (iconAtlas instanceof Texture2D) {
      iconAtlas.setParameters(DEFAULT_TEXTURE_PARAMETERS);

      this._externalTexture = iconAtlas;
      this.onUpdate();
    } else if (typeof iconAtlas === 'string') {
      loadImage(iconAtlas).then(data => {
        this._texture = new Texture2D(this.gl, {
          data,
          parameters: DEFAULT_TEXTURE_PARAMETERS
        });
        this.onUpdate();
      });
    }
  }

  _updateAutoPacking(data) {
    const icons = Object.values(getDiffIcons(data, this._getIcon, this._mapping) || {});

    if (icons.length > 0) {
      // generate icon mapping
      const {mapping, xOffset, yOffset, canvasHeight} = buildMapping({
        icons,
        buffer: this._buffer,
        canvasWidth: this._canvasWidth,
        mapping: this._mapping,
        xOffset: this._xOffset,
        yOffset: this._yOffset
      });

      this._mapping = mapping;
      this._xOffset = xOffset;
      this._yOffset = yOffset;
      this._canvasHeight = canvasHeight;

      // create new texture
      if (!this._texture) {
        this._texture = new Texture2D(this.gl, {
          width: this._canvasWidth,
          height: this._canvasHeight,
          parameters: DEFAULT_TEXTURE_PARAMETERS
        });
      }

      if (this._texture.height !== this._canvasHeight) {
        resizeTexture(this._texture, this._canvasWidth, this._canvasHeight);
      }

      this.onUpdate();

      // load images
      this._loadIcons(icons);
    }
  }

  _loadIcons(icons) {
    const ctx = this._canvas.getContext('2d');
    const canvasHeight = this._texture.height;

    for (const icon of icons) {
      loadImage(icon.url).then(imageData => {
        const id = getIconId(icon);
        const {x, y, width, height} = this._mapping[id];

        const data = resizeImage(ctx, imageData, width, height);

        this._texture.setSubImageData({
          data,
          x,
          y: canvasHeight - y - height, // flip Y as texture stored as reversed Y
          width,
          height,
          parameters: Object.assign({}, DEFAULT_TEXTURE_PARAMETERS, {
            [GL.UNPACK_FLIP_Y_WEBGL]: true
          })
        });

        // Call to regenerate mipmaps after modifying texture(s)
        this._texture.generateMipmap();

        this.onUpdate();
      });
    }
  }
}
