/*
 * Calculate perceived color difference using YIQ NTSC transmission color space
 * Based on 2010 paper by Yuriy Kotsarenko and Fernando Ramos
 * http://www.progmat.uaem.mx:8080/artVol2Num2/Articulo3Vol2Num2.pdf
 */
const DEFAULT_THRESHOLD = 255 * 0.05;

const getY = (r, g, b) => r * 0.29889531 + g * 0.58662247 + b * 0.11448223;
const getI = (r, g, b) => r * 0.59597799 - g * 0.2741761 - b * 0.32180189;
const getQ = (r, g, b) => r * 0.21147017 - g * 0.52261711 + b * 0.31114694;
const getESq = (dY, dI, dQ) => 0.5053 * dY * dY + 0.299 * dI * dI + 0.1957 * dQ * dQ;

// Get blended r/g/b value after applying alpha
const applyAlpha = (c, a) => 255 + (c - 255) * a / 255;

/**
 * Get dE square at given index from two pixel arrays
 * @param {Uint8ClampedArray} img1 - pixel data of first image
 * @param {Uint8ClampedArray} img2 - pixel data of second image
 * @param {Number} i - pixel index
 */
function colorDelta(img1, img2, index) {
  return Math.sqrt(colorDeltaSq(img1, img2, index));
}

function colorDeltaSq(img1, img2, index) {
  const i = index * 4;
  const a1 = img1[i + 3];
  const a2 = img2[i + 3];

  const r1 = applyAlpha(img1[i + 0], a1);
  const g1 = applyAlpha(img1[i + 1], a1);
  const b1 = applyAlpha(img1[i + 2], a1);

  const r2 = applyAlpha(img2[i + 0], a2);
  const g2 = applyAlpha(img2[i + 1], a2);
  const b2 = applyAlpha(img2[i + 2], a2);

  return getESq(
    getY(r1, g1, b1) - getY(r2, g2, b2),
    getI(r1, g1, b1) - getI(r2, g2, b2),
    getQ(r1, g1, b1) - getQ(r2, g2, b2)
  );
}

// TODO - expects imagedata structs
// may need a helper func to accept different arguments types
export function diffImagePixels(data1, data2, colorDeltaThreshold = DEFAULT_THRESHOLD) {
  const pixelCount = data1.data.length / 4;
  const maxDeltaSq = colorDeltaThreshold * colorDeltaThreshold;
  let badPixels = 0;
  for (let i = 0; i < pixelCount; i++) {
    const delta = colorDeltaSq(data1.data, data2.data, i);
    if (delta > maxDeltaSq) {
      badPixels++;
    }
  }
  const percentage = 1 - badPixels / pixelCount;
  return percentage;
}
