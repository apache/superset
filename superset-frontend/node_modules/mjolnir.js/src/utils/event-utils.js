/* Constants */
const DOWN_EVENT = 1;
const MOVE_EVENT = 2;
const UP_EVENT = 4;
const MOUSE_EVENTS = {
  pointerdown: DOWN_EVENT,
  pointermove: MOVE_EVENT,
  pointerup: UP_EVENT,
  mousedown: DOWN_EVENT,
  mousemove: MOVE_EVENT,
  mouseup: UP_EVENT
};

// MouseEvent.which https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/which
const MOUSE_EVENT_WHICH_LEFT = 1;
const MOUSE_EVENT_WHICH_MIDDLE = 2;
const MOUSE_EVENT_WHICH_RIGHT = 3;
// MouseEvent.button https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
const MOUSE_EVENT_BUTTON_LEFT = 0;
const MOUSE_EVENT_BUTTON_MIDDLE = 1;
const MOUSE_EVENT_BUTTON_RIGHT = 2;
// MouseEvent.buttons https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
const MOUSE_EVENT_BUTTONS_LEFT_MASK = 1;
const MOUSE_EVENT_BUTTONS_RIGHT_MASK = 2;
const MOUSE_EVENT_BUTTONS_MIDDLE_MASK = 4;

/**
 * Extract the involved mouse button
 */
export function whichButtons(event) {
  const eventType = MOUSE_EVENTS[event.srcEvent.type];
  if (!eventType) {
    // Not a mouse evet
    return null;
  }

  const {buttons, button, which} = event.srcEvent;
  let leftButton = false;
  let middleButton = false;
  let rightButton = false;

  if (
    // button is up, need to find out which one was pressed before
    eventType === UP_EVENT ||
    // moving but does not support `buttons` API
    (eventType === MOVE_EVENT && !Number.isFinite(buttons))
  ) {
    leftButton = which === MOUSE_EVENT_WHICH_LEFT;
    middleButton = which === MOUSE_EVENT_WHICH_MIDDLE;
    rightButton = which === MOUSE_EVENT_WHICH_RIGHT;
  } else if (eventType === MOVE_EVENT) {
    leftButton = Boolean(buttons & MOUSE_EVENT_BUTTONS_LEFT_MASK);
    middleButton = Boolean(buttons & MOUSE_EVENT_BUTTONS_MIDDLE_MASK);
    rightButton = Boolean(buttons & MOUSE_EVENT_BUTTONS_RIGHT_MASK);
  } else if (eventType === DOWN_EVENT) {
    leftButton = button === MOUSE_EVENT_BUTTON_LEFT;
    middleButton = button === MOUSE_EVENT_BUTTON_MIDDLE;
    rightButton = button === MOUSE_EVENT_BUTTON_RIGHT;
  }

  return {leftButton, middleButton, rightButton};
}

/**
 * Calculate event position relative to the root element
 */
export function getOffsetPosition(event, rootElement) {
  const {srcEvent} = event;

  // `center` is a hammer.js event property
  if (!event.center && !Number.isFinite(srcEvent.clientX)) {
    // Not a gestural event
    return null;
  }

  const center = event.center || {
    x: srcEvent.clientX,
    y: srcEvent.clientY
  };

  const rect = rootElement.getBoundingClientRect();

  // Fix scale for map affected by a CSS transform.
  // See https://stackoverflow.com/a/26893663/3528533
  const scaleX = rect.width / rootElement.offsetWidth;
  const scaleY = rect.height / rootElement.offsetHeight;

  // Calculate center relative to the root element
  const offsetCenter = {
    x: (center.x - rect.left - rootElement.clientLeft) / scaleX,
    y: (center.y - rect.top - rootElement.clientTop) / scaleY
  };

  return {center, offsetCenter};
}
