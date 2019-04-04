/* global Image */
export function loadImage(url, {crossOrigin = 'anonymous'} = {}) {
  return new Promise((resolve, reject) => {
    try {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load image ${url}.`));
      image.crossOrigin = crossOrigin;
      image.src = url;
    } catch (error) {
      reject(error);
    }
  });
}
