// @flow

export const ANCHOR_POSITION = {
  top: {x: 0.5, y: 0},
  'top-left': {x: 0, y: 0},
  'top-right': {x: 1, y: 0},
  bottom: {x: 0.5, y: 1},
  'bottom-left': {x: 0, y: 1},
  'bottom-right': {x: 1, y: 1},
  left: {x: 0, y: 0.5},
  right: {x: 1, y: 0.5}
};

const ANCHOR_TYPES = Object.keys(ANCHOR_POSITION);

/**
 * Calculate the dynamic position for a popup to fit in a container.
 * @param {Number} x - x position of the anchor on screen
 * @param {Number} y - y position of the anchor on screen
 * @param {Number} width - width of the container
 * @param {Number} height - height of the container
 * @param {Number} padding - extra space from the edge in pixels
 * @param {Number} selfWidth - width of the popup
 * @param {Number} selfHeight - height of the popup
 * @param {String} anchor - type of the anchor, one of 'top', 'bottom',
    'left', 'right', 'top-left', 'top-right', 'bottom-left' , and  'bottom-right'
 * @returns {String} position - one of 'top', 'bottom',
    'left', 'right', 'top-left', 'top-right', 'bottom-left' , and  'bottom-right'
 */
export function getDynamicPosition({
  x, y,
  width, height,
  selfWidth, selfHeight,
  anchor,
  padding = 0
} : {
  x: number,
  y: number,
  width: number,
  height: number,
  selfWidth: number,
  selfHeight: number,
  anchor: string,
  padding: number
}) : string {
  let {x: anchorX, y: anchorY} = ANCHOR_POSITION[anchor];

  // anchorY: top - 0, center - 0.5, bottom - 1
  let top = y - anchorY * selfHeight;
  let bottom = top + selfHeight;
  // If needed, adjust anchorY at 0.5 step between [0, 1]
  const yStep = 0.5;

  if (top < padding) {
    // Top edge is outside, try move down
    while (top < padding && anchorY >= yStep) {
      anchorY -= yStep;
      top += yStep * selfHeight;
    }
  } else if (bottom > height - padding) {
    // bottom edge is outside, try move up
    while (bottom > height - padding && anchorY <= 1 - yStep) {
      anchorY += yStep;
      bottom -= yStep * selfHeight;
    }
  }

  // anchorX: left - 0, center - 0.5, right - 1
  let left = x - anchorX * selfWidth;
  let right = left + selfWidth;

  // If needed, adjust anchorX at 0.5 step between [0, 1]
  let xStep = 0.5;
  if (anchorY === 0.5) {
    // If y is centered, then x cannot also be centered
    anchorX = Math.floor(anchorX);
    xStep = 1;
  }

  if (left < padding) {
    // Left edge is outside, try move right
    while (left < padding && anchorX >= xStep) {
      anchorX -= xStep;
      left += xStep * selfWidth;
    }
  } else if (right > width - padding) {
    // Right edge is outside, try move left
    while (right > width - padding && anchorX <= 1 - xStep) {
      anchorX += xStep;
      right -= xStep * selfWidth;
    }
  }

  // Find the name of the new anchor position
  return ANCHOR_TYPES.find((positionType) => {
    const anchorPosition = ANCHOR_POSITION[positionType];
    return anchorPosition.x === anchorX && anchorPosition.y === anchorY;
  }) || anchor;
}
