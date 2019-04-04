import {isBrowser} from './globals';

export const COLOR = {
  BLACK: 30,
  RED: 31,
  GREEN: 32,
  YELLOW: 33,
  BLUE: 34,
  MAGENTA: 35,
  CYAN: 36,
  WHITE: 37,

  BRIGHT_BLACK: 90,
  BRIGHT_RED: 91,
  BRIGHT_GREEN: 92,
  BRIGHT_YELLOW: 93,
  BRIGHT_BLUE: 94,
  BRIGHT_MAGENTA: 95,
  BRIGHT_CYAN: 96,
  BRIGHT_WHITE: 97
};

function getColor(color) {
  return typeof color === 'string' ? COLOR[color.toUpperCase()] || COLOR.WHITE : color;
}

export function addColor(string, color, background) {
  if (!isBrowser && typeof string === 'string') {
    if (color) {
      color = getColor(color);
      string = `\u001b[${color}m${string}\u001b[39m`;
    }
    if (background) {
      // background colors values are +10
      color = getColor(background);
      string = `\u001b[${background + 10}m${string}\u001b[49m`;
    }
  }
  return string;
}
