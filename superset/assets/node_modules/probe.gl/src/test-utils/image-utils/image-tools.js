// EXPERIMENTAL IMAGE TOOLS
// TODO - only works in browser
/* global document */

export function createImage(width, height) {
  const image = document.createElement('img');
  image.width = width;
  image.height = height;
  image.style.position = 'absolute';
  image.style.top = 0;
  image.style.left = 0;
  return image;
}

export function getImageFromContext(gl) {
  const image = createImage(gl.drawingBufferWidth, gl.drawingBufferHeight);
  return new Promise(resolve => {
    image.onload = () => {
      resolve(image);
    };
    image.src = gl.canvas.toDataURL();
  });
}

export function getImagePixelData(image, width = null, height = null) {
  width = width || image.width;
  height = height || image.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}
