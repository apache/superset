// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
import {Layer} from '@deck.gl/core';
import {GL, Model, Geometry, Texture2D, loadTextures, fp64} from 'luma.gl';
const {fp64LowPart} = fp64;

import vs from './icon-layer-vertex.glsl';
import fs from './icon-layer-fragment.glsl';

const DEFAULT_COLOR = [0, 0, 0, 255];
const DEFAULT_TEXTURE_MIN_FILTER = GL.LINEAR_MIPMAP_LINEAR;
// GL.LINEAR is the default value but explicitly set it here
const DEFAULT_TEXTURE_MAG_FILTER = GL.LINEAR;

/*
 * @param {object} props
 * @param {Texture2D | string} props.iconAtlas - atlas image url or texture
 * @param {object} props.iconMapping - icon names mapped to icon definitions
 * @param {object} props.iconMapping[icon_name].x - x position of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].y - y position of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].width - width of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].height - height of icon on the atlas image
 * @param {object} props.iconMapping[icon_name].anchorX - x anchor of icon on the atlas image,
 *   default to width / 2
 * @param {object} props.iconMapping[icon_name].anchorY - y anchor of icon on the atlas image,
 *   default to height / 2
 * @param {object} props.iconMapping[icon_name].mask - whether icon is treated as a transparency
 *   mask. If true, user defined color is applied. If false, original color from the image is
 *   applied. Default to false.
 * @param {number} props.size - icon size in pixels
 * @param {func} props.getPosition - returns anchor position of the icon, in [lng, lat, z]
 * @param {func} props.getIcon - returns icon name as a string
 * @param {func} props.getSize - returns icon size multiplier as a number
 * @param {func} props.getColor - returns color of the icon in [r, g, b, a]. Only works on icons
 *   with mask: true.
 * @param {func} props.getAngle - returns rotating angle (in degree) of the icon.
 */
const defaultProps = {
  iconAtlas: null,
  iconMapping: {},
  sizeScale: 1,
  fp64: false,

  getPosition: x => x.position,
  getIcon: x => x.icon,
  getColor: x => x.color || DEFAULT_COLOR,
  getSize: x => x.size || 1,
  getAngle: x => x.angle || 0
};

export default class IconLayer extends Layer {
  getShaders() {
    const projectModule = this.is64bitEnabled() ? 'project64' : 'project32';
    return {vs, fs, modules: [projectModule, 'picking']};
  }

  initializeState() {
    const attributeManager = this.getAttributeManager();

    /* eslint-disable max-len */
    attributeManager.addInstanced({
      instancePositions: {
        size: 3,
        transition: true,
        accessor: 'getPosition'
      },
      instancePositions64xyLow: {
        size: 2,
        accessor: 'getPosition',
        update: this.calculateInstancePositions64xyLow
      },
      instanceSizes: {
        size: 1,
        transition: true,
        accessor: 'getSize',
        defaultValue: 1
      },
      instanceOffsets: {size: 2, accessor: 'getIcon', update: this.calculateInstanceOffsets},
      instanceIconFrames: {size: 4, accessor: 'getIcon', update: this.calculateInstanceIconFrames},
      instanceColorModes: {
        size: 1,
        type: GL.UNSIGNED_BYTE,
        accessor: 'getIcon',
        update: this.calculateInstanceColorMode
      },
      instanceColors: {
        size: 4,
        type: GL.UNSIGNED_BYTE,
        transition: true,
        accessor: 'getColor',
        defaultValue: DEFAULT_COLOR
      },
      instanceAngles: {
        size: 1,
        transition: true,
        accessor: 'getAngle',
        defaultValue: 0
      }
    });
    /* eslint-enable max-len */
  }

  updateState({oldProps, props, changeFlags}) {
    super.updateState({props, oldProps, changeFlags});

    const {iconAtlas, iconMapping} = props;

    if (oldProps.iconMapping !== iconMapping) {
      const attributeManager = this.getAttributeManager();
      attributeManager.invalidate('instanceOffsets');
      attributeManager.invalidate('instanceIconFrames');
      attributeManager.invalidate('instanceColorModes');
    }

    if (oldProps.iconAtlas !== iconAtlas) {
      if (iconAtlas instanceof Texture2D) {
        iconAtlas.setParameters({
          [GL.TEXTURE_MIN_FILTER]: DEFAULT_TEXTURE_MIN_FILTER,
          [GL.TEXTURE_MAG_FILTER]: DEFAULT_TEXTURE_MAG_FILTER
        });
        this.setState({iconsTexture: iconAtlas});
      } else if (typeof iconAtlas === 'string') {
        loadTextures(this.context.gl, {
          urls: [iconAtlas]
        }).then(([texture]) => {
          texture.setParameters({
            [GL.TEXTURE_MIN_FILTER]: DEFAULT_TEXTURE_MIN_FILTER,
            [GL.TEXTURE_MAG_FILTER]: DEFAULT_TEXTURE_MAG_FILTER
          });
          this.setState({iconsTexture: texture});
        });
      }
    }

    if (props.fp64 !== oldProps.fp64) {
      const {gl} = this.context;
      if (this.state.model) {
        this.state.model.delete();
      }
      this.setState({model: this._getModel(gl)});
      this.state.attributeManager.invalidateAll();
    }
  }

  draw({uniforms}) {
    const {sizeScale} = this.props;
    const {iconsTexture} = this.state;

    if (iconsTexture) {
      this.state.model.render(
        Object.assign({}, uniforms, {
          iconsTexture,
          iconsTextureDim: [iconsTexture.width, iconsTexture.height],
          sizeScale
        })
      );
    }
  }

  _getModel(gl) {
    const positions = [-1, -1, 0, -1, 1, 0, 1, 1, 0, 1, -1, 0];

    return new Model(
      gl,
      Object.assign({}, this.getShaders(), {
        id: this.props.id,
        geometry: new Geometry({
          drawMode: GL.TRIANGLE_FAN,
          attributes: {
            positions: new Float32Array(positions)
          }
        }),
        isInstanced: true,
        shaderCache: this.context.shaderCache
      })
    );
  }

  /*
  calculateInstancePositions(attribute) {
    const {data, getPosition} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const object of data) {
      const position = getPosition(object);
      value[i++] = position[0];
      value[i++] = position[1];
      value[i++] = position[2] || 0;
    }
  }

  calculateInstanceSizes(attribute) {
    const {data, getSize} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const object of data) {
      value[i++] = getSize(object);
    }
  }

  calculateInstanceAngles(attribute) {
    const {data, getAngle} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const object of data) {
      value[i++] = getAngle(object);
    }
  }

  calculateInstanceColors(attribute) {
    const {data, getColor} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const object of data) {
      const color = getColor(object);

      value[i++] = color[0];
      value[i++] = color[1];
      value[i++] = color[2];
      value[i++] = isNaN(color[3]) ? 255 : color[3];
    }
  }
  */

  calculateInstancePositions64xyLow(attribute) {
    const isFP64 = this.is64bitEnabled();
    attribute.isGeneric = !isFP64;

    if (!isFP64) {
      attribute.value = new Float32Array(2);
      return;
    }

    const {data, getPosition} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const point of data) {
      const position = getPosition(point);
      value[i++] = fp64LowPart(position[0]);
      value[i++] = fp64LowPart(position[1]);
    }
  }

  calculateInstanceOffsets(attribute) {
    const {data, iconMapping, getIcon} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const object of data) {
      const icon = getIcon(object);
      const rect = iconMapping[icon] || {};
      value[i++] = rect.width / 2 - rect.anchorX || 0;
      value[i++] = rect.height / 2 - rect.anchorY || 0;
    }
  }

  calculateInstanceColorMode(attribute) {
    const {data, iconMapping, getIcon} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const object of data) {
      const icon = getIcon(object);
      const colorMode = iconMapping[icon] && iconMapping[icon].mask;
      value[i++] = colorMode ? 1 : 0;
    }
  }

  calculateInstanceIconFrames(attribute) {
    const {data, iconMapping, getIcon} = this.props;
    const {value} = attribute;
    let i = 0;
    for (const object of data) {
      const icon = getIcon(object);
      const rect = iconMapping[icon] || {};
      value[i++] = rect.x || 0;
      value[i++] = rect.y || 0;
      value[i++] = rect.width || 0;
      value[i++] = rect.height || 0;
    }
  }
}

IconLayer.layerName = 'IconLayer';
IconLayer.defaultProps = defaultProps;
