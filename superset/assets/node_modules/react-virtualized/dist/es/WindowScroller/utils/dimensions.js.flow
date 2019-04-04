// @flow

/**
 * Gets the dimensions of the element, accounting for API differences between
 * `window` and other DOM elements.
 */

type Dimensions = {
  height: number,
  width: number,
};

// TODO Move this into WindowScroller and import from there
type WindowScrollerProps = {
  serverHeight: number,
  serverWidth: number,
};

const isWindow = element => element === window;

const getBoundingBox = element => element.getBoundingClientRect();

export function getDimensions(
  scrollElement: ?Element,
  props: WindowScrollerProps,
): Dimensions {
  if (!scrollElement) {
    return {
      height: props.serverHeight,
      width: props.serverWidth,
    };
  } else if (isWindow(scrollElement)) {
    const {innerHeight, innerWidth} = window;
    return {
      height: typeof innerHeight === 'number' ? innerHeight : 0,
      width: typeof innerWidth === 'number' ? innerWidth : 0,
    };
  } else {
    return getBoundingBox(scrollElement);
  }
}

/**
 * Gets the vertical and horizontal position of an element within its scroll container.
 * Elements that have been “scrolled past” return negative values.
 * Handles edge-case where a user is navigating back (history) from an already-scrolled page.
 * In this case the body’s top or left position will be a negative number and this element’s top or left will be increased (by that amount).
 */
export function getPositionOffset(element: Element, container: Element) {
  if (isWindow(container) && document.documentElement) {
    const containerElement = document.documentElement;
    const elementRect = getBoundingBox(element);
    const containerRect = getBoundingBox(containerElement);
    return {
      top: elementRect.top - containerRect.top,
      left: elementRect.left - containerRect.left,
    };
  } else {
    const scrollOffset = getScrollOffset(container);
    const elementRect = getBoundingBox(element);
    const containerRect = getBoundingBox(container);
    return {
      top: elementRect.top + scrollOffset.top - containerRect.top,
      left: elementRect.left + scrollOffset.left - containerRect.left,
    };
  }
}

/**
 * Gets the vertical and horizontal scroll amount of the element, accounting for IE compatibility
 * and API differences between `window` and other DOM elements.
 */
export function getScrollOffset(element: Element) {
  if (isWindow(element) && document.documentElement) {
    return {
      top:
        'scrollY' in window
          ? window.scrollY
          : document.documentElement.scrollTop,
      left:
        'scrollX' in window
          ? window.scrollX
          : document.documentElement.scrollLeft,
    };
  } else {
    return {
      top: element.scrollTop,
      left: element.scrollLeft,
    };
  }
}
