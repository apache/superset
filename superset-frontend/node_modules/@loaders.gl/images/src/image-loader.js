/* global Image */
import {canParseImage, parseImage, parseToImageBitmap, loadToHTMLImage} from './lib/parse-image';

const EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg'];
const MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/vndmicrosofticon',
  'image/svg+xml'
];

// Loads a platform-specific image type that can be used as input data to WebGL textures
export default {
  name: 'Images',
  mimeTypes: MIME_TYPES,
  extensions: EXTENSIONS,
  parse: canParseImage && parseImage,
  loadAndParse: typeof Image !== 'undefined' && loadToHTMLImage
};

// EXPERIMENTAL

// Specifically loads an ImageBitmap (works on newer browsers, on both main and worker threads)
export const ImageBitmapLoader = {
  mimeTypes: MIME_TYPES,
  extensions: EXTENSIONS,
  parse: parseToImageBitmap
};

// Specifically loads an HTMLImage (works on all browsers' main thread but not on worker threads)
export const HTMLImageLoader = {
  mimeTypes: MIME_TYPES,
  extensions: EXTENSIONS,
  loadAndParse: loadToHTMLImage
};
