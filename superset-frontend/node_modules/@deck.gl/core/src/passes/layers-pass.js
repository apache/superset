import GL from '@luma.gl/constants';
import Pass from './pass';
import {clear, setParameters, withParameters} from '@luma.gl/core';

export default class LayersPass extends Pass {
  render(params) {
    const gl = this.gl;

    return withParameters(gl, {framebuffer: params.outputBuffer}, () => this.drawLayers(params));
  }

  // PRIVATE
  // Draw a list of layers in a list of viewports
  drawLayers({
    layers,
    viewports,
    views,
    onViewportActive,
    deviceRect = null,
    parameters = {},
    pass = 'draw',
    redrawReason = '',
    clearCanvas = true,
    effects,
    effectProps
  }) {
    const gl = this.gl;
    if (clearCanvas) {
      this.clearCanvas(gl);
    }

    const renderStats = [];

    viewports.forEach((viewportOrDescriptor, i) => {
      const viewport = this.getViewportFromDescriptor(viewportOrDescriptor);
      const view = views && views[viewport.id];

      // Update context to point to this viewport
      onViewportActive(viewport);

      // render this viewport
      const stats = this.drawLayersInViewport(gl, {
        layers,
        viewport,
        view,
        deviceRect,
        parameters,
        pass,
        redrawReason,
        effects,
        effectProps
      });
      renderStats.push(stats);
    });
    return renderStats;
  }

  // Draws a list of layers in one viewport
  // TODO - when picking we could completely skip rendering viewports that dont
  // intersect with the picking rect
  drawLayersInViewport(
    gl,
    {
      layers,
      viewport,
      view,
      deviceRect = null,
      parameters = {},
      pass = 'draw',
      redrawReason = '',
      effects,
      effectProps
    }
  ) {
    const glViewport = this.getGLViewport(gl, {viewport});

    if (view && view.props.clear) {
      const clearOpts = view.props.clear === true ? {color: true, depth: true} : view.props.clear;
      withParameters(
        gl,
        {
          scissorTest: true,
          scissor: glViewport
        },
        () => clear(gl, clearOpts)
      );
    }

    // render layers in normal colors
    const renderStatus = {
      totalCount: layers.length,
      visibleCount: 0,
      compositeCount: 0,
      pickableCount: 0
    };

    setParameters(gl, parameters || {});

    // render layers in normal colors
    layers.forEach((layer, layerIndex) => {
      // Check if we should draw layer
      const shouldDrawLayer = this.shouldDrawLayer(layer, viewport);

      // Calculate stats
      if (shouldDrawLayer && layer.props.pickable) {
        renderStatus.pickableCount++;
      }
      if (layer.isComposite) {
        renderStatus.compositeCount++;
      }

      // Draw the layer
      if (shouldDrawLayer) {
        renderStatus.visibleCount++;

        this.drawLayerInViewport({
          gl,
          layer,
          layerIndex,
          glViewport,
          parameters,
          effects,
          effectProps
        });
      }
    });

    return renderStatus;
  }

  drawLayerInViewport({gl, layer, layerIndex, glViewport, parameters, effects, effectProps}) {
    const moduleParameters = this.getModuleParameters(layer, effects, effectProps);
    const uniforms = Object.assign({}, layer.context.uniforms, {layerIndex});
    const layerParameters = this.getLayerParameters(layer, layerIndex, glViewport, parameters);

    layer.drawLayer({
      moduleParameters,
      uniforms,
      parameters: layerParameters
    });
  }

  // Get a viewport from a viewport descriptor (which can be a plain viewport)
  getViewportFromDescriptor(viewportOrDescriptor) {
    return viewportOrDescriptor.viewport ? viewportOrDescriptor.viewport : viewportOrDescriptor;
  }

  shouldDrawLayer(layer, viewport) {
    const layerFilter = this.props.layerFilter;
    let shouldDrawLayer = !layer.isComposite && layer.props.visible;

    if (shouldDrawLayer && layerFilter) {
      shouldDrawLayer = layerFilter({layer, viewport, isPicking: false});
    }
    return shouldDrawLayer;
  }

  getModuleParameters(layer) {
    const moduleParameters = Object.assign(Object.create(layer.props), {
      viewport: layer.context.viewport,
      pickingActive: 0,
      devicePixelRatio: this.props.pixelRatio
    });
    return moduleParameters;
  }

  getLayerParameters(layer, layerIndex, glViewport, parameters) {
    // All parameter resolving is done here instead of the layer
    // Blend parameters must not be overridden
    const layerParameters = Object.assign({}, layer.props.parameters || {}, parameters);

    Object.assign(layerParameters, {
      viewport: glViewport
    });
    return layerParameters;
  }

  // Convert viewport top-left CSS coordinates to bottom up WebGL coordinates
  getGLViewport(gl, {viewport}) {
    // TODO - dummy default for node
    // Fallback to width/height when clientWidth/clientHeight are 0 or undefined.
    const height = gl.canvas ? gl.canvas.clientHeight || gl.canvas.height : 100;
    // Convert viewport top-left CSS coordinates to bottom up WebGL coordinates
    const dimensions = viewport;
    const pixelRatio = this.props.pixelRatio;
    return [
      dimensions.x * pixelRatio,
      (height - dimensions.y - dimensions.height) * pixelRatio,
      dimensions.width * pixelRatio,
      dimensions.height * pixelRatio
    ];
  }

  clearCanvas(gl) {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    // clear depth and color buffers, restoring transparency
    withParameters(gl, {viewport: [0, 0, width, height]}, () => {
      gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
    });
  }
}
