// Attributions
// * Based on binary-gltf-utils under MIT license: Copyright (c) 2016-17 Karl Cheng

// TODO: make these functions work for Node.js buffers?
// Quarantine references to Buffer to prevent bundler from adding big polyfills
// import {bufferToArrayBuffer} from '../node/buffer-to-array-buffer';
// TODO - this should be handled in @loaders.gl/polyfills

import {mimeTypeMap} from './image-parsers';

const ERR_INVALID_MIME_TYPE = `Invalid MIME type. Supported MIME types are: ${Array.from(
  mimeTypeMap.keys()
).join(', ')}`;

// Supported image types are PNG, JPEG, GIF and BMP.
export function isImage(arrayBuffer, mimeType) {
  if (mimeType) {
    const {test} = getImageTypeHandlers(mimeType);
    const dataView = toDataView(arrayBuffer);
    return test(dataView);
  }
  // check if known type
  return Boolean(getImageMIMEType(arrayBuffer));
}

// Sniffs the contents of a file to attempt to deduce the image type
export function getImageMIMEType(arrayBuffer) {
  const dataView = toDataView(arrayBuffer);

  // Loop through each file type and see if they work.
  for (const [mimeType, {test}] of mimeTypeMap.entries()) {
    if (test(dataView)) {
      return mimeType;
    }
  }

  return null;
}

export function getImageSize(arrayBuffer, mimeType = null) {
  mimeType = mimeType || getImageMIMEType(arrayBuffer);

  const {getSize} = getImageTypeHandlers(mimeType);

  const dataView = toDataView(arrayBuffer);
  const size = getSize(dataView);

  if (!size) {
    throw new Error(`invalid image data for type: ${mimeType}`);
  }

  return size;
}

// Sniffs the contents of a file to attempt to deduce the image type and size.
// Supported image types are PNG, JPEG, GIF and BMP.
export function getImageMetadata(arrayBuffer, mimeType = null) {
  mimeType = mimeType || getImageMIMEType(arrayBuffer);

  const metadata = getImageSize(arrayBuffer, mimeType);
  metadata.mimeType = mimeType;
  return metadata;
}

function getImageTypeHandlers(mimeType) {
  const handlers = mimeTypeMap.get(mimeType);
  if (!handlers) {
    throw new Error(ERR_INVALID_MIME_TYPE);
  }
  return handlers;
}

function toDataView(data) {
  // TODO: make these functions work for Node.js buffers?
  // if (bufferToArrayBuffer) {
  //   data = bufferToArrayBuffer(data);
  // }

  // Careful - Node Buffers will look like ArrayBuffers (keep after isBuffer)
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return new DataView(data.buffer || data);
  }

  throw new Error('toDataView');
}
