// Helper methods used by GPUGridAggregator.
import GL from '@luma.gl/constants';
import {Framebuffer, Texture2D} from '@luma.gl/core';

export function getFloatTexture(gl, opts) {
  const {width = 1, height = 1} = opts;
  const texture = new Texture2D(gl, {
    data: null,
    format: GL.RGBA32F,
    type: GL.FLOAT,
    border: 0,
    mipmaps: false,
    parameters: {
      [GL.TEXTURE_MAG_FILTER]: GL.NEAREST,
      [GL.TEXTURE_MIN_FILTER]: GL.NEAREST
    },
    dataFormat: GL.RGBA,
    width,
    height
  });
  return texture;
}

export function getFramebuffer(gl, opts) {
  const {id, width = 1, height = 1, texture} = opts;
  const fb = new Framebuffer(gl, {
    id,
    width,
    height,
    attachments: {
      [GL.COLOR_ATTACHMENT0]: texture
    }
  });

  return fb;
}

export function getFloatArray(array, size, fillValue = 0) {
  if (!array || array.length < size) {
    return new Float32Array(size).fill(fillValue);
  }
  return array;
}
