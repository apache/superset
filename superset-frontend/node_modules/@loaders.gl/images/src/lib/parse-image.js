/* global Image, Blob, createImageBitmap, btoa, fetch */
import {global} from '../utils/globals';
import {getImageMetadata} from './get-image-metadata';

export const canParseImage = global._parseImageNode || typeof ImageBitmap !== 'undefined';

// Parse to platform defined type (ndarray on node, ImageBitmap on browser)
export function parseImage(arrayBuffer, options) {
  if (global._parseImageNode) {
    const {mimeType} = getImageMetadata(arrayBuffer);
    return global._parseImageNode(arrayBuffer, mimeType, options);
  }

  return parseToImageBitmap(arrayBuffer, options);
}

// Fallback for older browsers
// TODO - investigate Image.decode()
// https://medium.com/dailyjs/image-loading-with-image-decode-b03652e7d2d2
export async function loadImage(url, options = {}) {
  if (typeof Image === 'undefined') {
    const response = await fetch(url, options);
    const arrayBuffer = await response.arrayBuffer();
    return parseImage(arrayBuffer, options);
  }
  return await loadToHTMLImage(url, options);
}

// Asynchronously parses an array buffer into an ImageBitmap - this contains the decoded data
// Supported on worker threads
// Not supported on Edge and Safari
// https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap#Browser_compatibility
export function parseToImageBitmap(arrayBuffer, options) {
  if (typeof createImageBitmap === 'undefined') {
    throw new Error('parseImage');
  }

  const blob = new Blob([new Uint8Array(arrayBuffer)]);
  return createImageBitmap(blob);
}

//
export async function loadToHTMLImage(url, options) {
  let src;
  if (/\.svg((\?|#).*)?$/.test(url)) {
    // is SVG
    const response = await fetch(url, options);
    const xml = await response.text();
    // base64 encoding is safer. utf-8 fails in some browsers
    src = `data:image/svg+xml;base64,${btoa(xml)}`;
  } else {
    src = await url;
  }

  return await new Promise((resolve, reject) => {
    try {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = err => reject(new Error(`Could not load image ${url}: ${err}`));
      image.crossOrigin = (options && options.crossOrigin) || 'anonymous';
      image.src = src;
    } catch (error) {
      reject(error);
    }
  });
}
