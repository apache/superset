// DODO added
// conversion functions from https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function hexToRgb(hex: string) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// DODO added
// from https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function rgbToHex(r: number, g: number, b: number) {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// DODO added
// https://stackoverflow.com/questions/2049230/convert-rgba-color-to-rgb
function buildNewRgbWithoutOpacity(
  rgba: { red: number; green: number; blue: number; alpha: number },
  background: { red: number; green: number; blue: number; alpha: number } = {
    red: 255,
    green: 255,
    blue: 255,
    alpha: 1,
  },
): { red: number; green: number; blue: number } {
  const red = Math.round(
    (1 - rgba.alpha) * background.red + rgba.alpha * rgba.red,
  );
  const green = Math.round(
    (1 - rgba.alpha) * background.green + rgba.alpha * rgba.green,
  );
  const blue = Math.round(
    (1 - rgba.alpha) * background.blue + rgba.alpha * rgba.blue,
  );

  return { red, green, blue };
}

export const addGradientDodo = (colorScheme: string, opacity: number) => {
  const rgbColor = hexToRgb(colorScheme);
  if (rgbColor) {
    const rgbNoOpacity = buildNewRgbWithoutOpacity({
      red: rgbColor.r,
      green: rgbColor.g,
      blue: rgbColor.b,
      alpha: opacity,
    });

    const hexNoOpacity = rgbToHex(
      rgbNoOpacity.red,
      rgbNoOpacity.green,
      rgbNoOpacity.blue,
    );

    return hexNoOpacity;
  }

  return null;
};
