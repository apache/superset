export {makeSpy} from './make-spy';

export {default as BrowserDriver} from './browser-automation/browser-driver';
export {default as BrowserTestDriver} from './browser-automation/browser-test-driver';
export {callExposedFunction} from './browser-automation/call-exposed-function';

// EXPERIMENTAL TEST UTILS

// Image tools
import {loadImage} from './image-utils/load-image';
import {createImage, getImageFromContext, getImagePixelData} from './image-utils/image-tools';
import {diffImagePixels} from './image-utils/diff-images';

export const experimental = {
  loadImage,
  createImage,
  getImageFromContext,
  getImagePixelData,
  diffImagePixels
};
