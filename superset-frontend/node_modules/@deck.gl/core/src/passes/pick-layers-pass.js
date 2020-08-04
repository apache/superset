import LayersPass from './layers-pass';
import {withParameters} from '@luma.gl/core';

export default class PickLayersPass extends LayersPass {
  render(props) {
    if (props.pickingFBO) {
      this.drawPickingBuffer(props);
    } else {
      super.render(props);
    }
  }

  // Private
  // Draws list of layers and viewports into the picking buffer
  // Note: does not sample the buffer, that has to be done by the caller
  drawPickingBuffer({
    layers,
    viewports,
    onViewportActive,
    pickingFBO,
    effectProps,
    deviceRect: {x, y, width, height},
    redrawReason = ''
  }) {
    const gl = this.gl;
    // Make sure we clear scissor test and fbo bindings in case of exceptions
    // We are only interested in one pixel, no need to render anything else
    // Note that the callback here is called synchronously.
    // Set blend mode for picking
    // always overwrite existing pixel with [r,g,b,layerIndex]
    return withParameters(
      gl,
      {
        framebuffer: pickingFBO,
        scissorTest: true,
        scissor: [x, y, width, height],
        clearColor: [0, 0, 0, 0]
      },
      () => {
        this.drawLayers({
          layers,
          viewports,
          onViewportActive,
          pass: 'picking',
          redrawReason,
          effectProps,
          parameters: {
            blend: true,
            blendFunc: [gl.ONE, gl.ZERO, gl.CONSTANT_ALPHA, gl.ZERO],
            blendEquation: gl.FUNC_ADD,
            blendColor: [0, 0, 0, 0],

            // When used as Mapbox custom layer, the context state may be dirty
            // TODO - Remove when mapbox fixes this issue
            // https://github.com/mapbox/mapbox-gl-js/issues/7801
            depthMask: true,
            depthTest: true,
            depthRange: [0, 1],
            colorMask: [true, true, true, true]
          }
        });
      }
    );
  }

  // PRIVATE
  shouldDrawLayer(layer, viewport) {
    const layerFilter = this.props.layerFilter;
    let shouldDrawLayer = !layer.isComposite && layer.props.visible && layer.props.pickable;

    if (shouldDrawLayer && layerFilter) {
      shouldDrawLayer = layerFilter({layer, viewport, isPicking: true});
    }
    return shouldDrawLayer;
  }

  getModuleParameters(layer, effects, effectProps) {
    const moduleParameters = Object.assign(Object.create(layer.props), {
      viewport: layer.context.viewport,
      pickingActive: 1,
      devicePixelRatio: this.props.pixelRatio
    });

    Object.assign(moduleParameters, effectProps);
    return moduleParameters;
  }

  getLayerParameters(layer, layerIndex, glViewport, parameters) {
    // All parameter resolving is done here instead of the layer
    // Blend parameters must not be overridden
    const layerParameters = Object.assign({}, layer.props.parameters || {}, parameters);

    Object.assign(layerParameters, {
      viewport: glViewport,
      blendColor: [0, 0, 0, (layerIndex + 1) / 255]
    });

    return layerParameters;
  }
}
