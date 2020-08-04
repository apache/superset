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
import {Layer, createIterable} from '@deck.gl/core';
import GL from '@luma.gl/constants';
import {Model, Geometry, fp64} from '@luma.gl/core';

const {fp64LowPart} = fp64;

import vs from './icon-layer-vertex.glsl';
import fs from './icon-layer-fragment.glsl';
import IconManager from './icon-manager';

const DEFAULT_COLOR = [0, 0, 0, 255];
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
  iconMapping: {type: 'object', value: {}, async: true},
  sizeScale: {type: 'number', value: 1, min: 0},
  fp64: false,
  billboard: true,
  sizeUnits: 'pixels',
  sizeMinPixels: {type: 'number', min: 0, value: 0}, //  min point radius in pixels
  sizeMaxPixels: {type: 'number', min: 0, value: Number.MAX_SAFE_INTEGER}, // max point radius in pixels

  getPosition: {type: 'accessor', value: x => x.position},
  getIcon: {type: 'accessor', value: x => x.icon},
  getColor: {type: 'accessor', value: DEFAULT_COLOR},
  getSize: {type: 'accessor', value: 1},
  getAngle: {type: 'accessor', value: 0}
};

export default class IconLayer extends Layer {
  getShaders() {
    const projectModule = this.use64bitProjection() ? 'project64' : 'project32';
    return {vs, fs, modules: [projectModule, 'picking']};
  }

  initializeState() {
    this.state = {
      iconManager: new IconManager(this.context.gl, {onUpdate: () => this._onUpdate()})
    };

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

  /* eslint-disable max-statements, complexity */
  updateState({oldProps, props, changeFlags}) {
    super.updateState({props, oldProps, changeFlags});

    const attributeManager = this.getAttributeManager();
    const {iconManager} = this.state;
    const {iconAtlas, iconMapping, data, getIcon} = props;

    let iconMappingChanged = false;

    // prepacked iconAtlas from user
    if (iconAtlas) {
      if (oldProps.iconAtlas !== props.iconAtlas) {
        iconManager.setProps({iconAtlas, autoPacking: false});
      }

      if (oldProps.iconMapping !== props.iconMapping) {
        iconManager.setProps({iconMapping});
        iconMappingChanged = true;
      }
    } else {
      // otherwise, use autoPacking
      iconManager.setProps({autoPacking: true});
    }

    if (
      changeFlags.dataChanged ||
      (changeFlags.updateTriggersChanged &&
        (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getIcon))
    ) {
      iconManager.setProps({data, getIcon});
      iconMappingChanged = true;
    }

    if (iconMappingChanged) {
      attributeManager.invalidate('instanceOffsets');
      attributeManager.invalidate('instanceIconFrames');
      attributeManager.invalidate('instanceColorModes');
    }

    if (props.fp64 !== oldProps.fp64) {
      const {gl} = this.context;
      if (this.state.model) {
        this.state.model.delete();
      }
      this.setState({model: this._getModel(gl)});
      attributeManager.invalidateAll();
    }
  }
  /* eslint-enable max-statements, complexity */

  finalizeState() {
    super.finalizeState();
    // Release resources held by the icon manager
    this.state.iconManager.finalize();
  }

  draw({uniforms}) {
    const {sizeScale, sizeMinPixels, sizeMaxPixels, sizeUnits, billboard} = this.props;
    const {iconManager} = this.state;
    const {viewport} = this.context;

    const iconsTexture = iconManager.getTexture();
    if (iconsTexture) {
      this.state.model
        .setUniforms(
          Object.assign({}, uniforms, {
            iconsTexture,
            iconsTextureDim: [iconsTexture.width, iconsTexture.height],
            sizeScale:
              sizeScale * (sizeUnits === 'pixels' ? viewport.distanceScales.metersPerPixel[2] : 1),
            sizeMinPixels,
            sizeMaxPixels,
            billboard
          })
        )
        .draw();
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

  _onUpdate() {
    this.setNeedsRedraw();
  }

  calculateInstancePositions64xyLow(attribute) {
    const isFP64 = this.use64bitPositions();
    attribute.constant = !isFP64;

    if (!isFP64) {
      attribute.value = new Float32Array(2);
      return;
    }

    const {data, getPosition} = this.props;
    const {value} = attribute;
    let i = 0;
    const {iterable, objectInfo} = createIterable(data);
    for (const object of iterable) {
      objectInfo.index++;
      const position = getPosition(object, objectInfo);
      value[i++] = fp64LowPart(position[0]);
      value[i++] = fp64LowPart(position[1]);
    }
  }

  calculateInstanceOffsets(attribute, {startRow, endRow}) {
    const {data} = this.props;
    const {iconManager} = this.state;
    const {value, size} = attribute;
    let i = startRow * size;
    const {iterable, objectInfo} = createIterable(data, startRow, endRow);
    for (const object of iterable) {
      objectInfo.index++;
      const rect = iconManager.getIconMapping(object, objectInfo);
      value[i++] = rect.width / 2 - rect.anchorX || 0;
      value[i++] = rect.height / 2 - rect.anchorY || 0;
    }
  }

  calculateInstanceColorMode(attribute, {startRow, endRow}) {
    const {data} = this.props;
    const {iconManager} = this.state;
    const {value, size} = attribute;
    let i = startRow * size;
    const {iterable, objectInfo} = createIterable(data, startRow, endRow);
    for (const object of iterable) {
      objectInfo.index++;
      const mapping = iconManager.getIconMapping(object, objectInfo);
      const colorMode = mapping.mask;
      value[i++] = colorMode ? 1 : 0;
    }
  }

  calculateInstanceIconFrames(attribute, {startRow, endRow}) {
    const {data} = this.props;
    const {iconManager} = this.state;
    const {value, size} = attribute;
    let i = startRow * size;
    const {iterable, objectInfo} = createIterable(data, startRow, endRow);
    for (const object of iterable) {
      objectInfo.index++;
      const rect = iconManager.getIconMapping(object, objectInfo);
      value[i++] = rect.x || 0;
      value[i++] = rect.y || 0;
      value[i++] = rect.width || 0;
      value[i++] = rect.height || 0;
    }
  }
}

IconLayer.layerName = 'IconLayer';
IconLayer.defaultProps = defaultProps;
