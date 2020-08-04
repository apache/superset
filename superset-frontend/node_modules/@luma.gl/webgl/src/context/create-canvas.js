// Resizing a webgl canvas

/* global window, document */
import {isBrowser} from '../utils';

const isPage = isBrowser && typeof document !== 'undefined';
let isPageLoaded = isPage && document.readyState === 'complete';

let pageLoadPromise;

/**
 * Returns a promise that resolves when the page is loaded
 * at this point the DOM can be manipulated, and e.g. a new canvas can be inserted
 * @return {Promise} - resolves when the page is loaded
 */
export function getPageLoadPromise() {
  if (!pageLoadPromise) {
    pageLoadPromise = isPage
      ? new Promise((resolve, reject) => {
          if (isPage && document.readyState === 'complete') {
            isPageLoaded = true;
            resolve(document);
            return;
          }
          window.onload = () => {
            isPageLoaded = true;
            resolve(document);
          };
        })
      : Promise.resolve({});
  }
  return pageLoadPromise;
}

/**
 * Create a canvas
 * @param {Number} width - set to 100%
 * @param {Number} height - set to 100%
 */
export function createCanvas({width = 800, height = 600, id = 'gl-canvas', insert = true}) {
  const canvas = document.createElement('canvas');
  canvas.id = id;
  canvas.style.width = Number.isFinite(width) ? `${width}px` : '100%';
  canvas.style.height = Number.isFinite(height) ? `${height}px` : '100%';
  // add the canvas to the body element once the page has loaded
  if (insert) {
    const body = document.body;
    body.insertBefore(canvas, body.firstChild);
    // getPageLoadPromise().then(document => {});
  }
  return canvas;
}

export function getCanvas({canvas, width, height, onError = () => {}}) {
  let targetCanvas;
  if (typeof canvas === 'string') {
    if (!isPageLoaded) {
      onError(`createGLContext called on canvas '${canvas}' before page was loaded`);
    }
    targetCanvas = document.getElementById(canvas);
  } else if (canvas) {
    targetCanvas = canvas;
  } else {
    targetCanvas = createCanvas({id: 'lumagl-canvas', width, height, onError});
  }

  return targetCanvas;
}
