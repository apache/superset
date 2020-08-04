import activeElement from './activeElement';
import addClass from './addClass';
import addEventListener from './addEventListener';
import animate from './animate';
import { cancel as cancelAnimationFrame, request as requestAnimationFrame } from './animationFrame';
import closest from './closest';
import contains from './contains';
import style from './css';
import filter from './filterEventHandler';
import getComputedStyle from './getComputedStyle';
import hasClass from './hasClass';
import height from './height';
import listen from './listen';
import matches from './matches';
import offset from './offset';
import offsetParent from './offsetParent';
import ownerDocument from './ownerDocument';
import ownerWindow from './ownerWindow';
import position from './position';
import querySelectorAll from './querySelectorAll';
import removeClass from './removeClass';
import removeEventListener from './removeEventListener';
import scrollbarSize from './scrollbarSize';
import scrollLeft from './scrollLeft';
import scrollParent from './scrollParent';
import scrollTo from './scrollTo';
import scrollTop from './scrollTop';
import toggleClass from './toggleClass';
import transitionEnd from './transitionEnd';
import width from './width';
export { addEventListener, removeEventListener, animate, filter, listen, style, getComputedStyle, activeElement, ownerDocument, ownerWindow, requestAnimationFrame, cancelAnimationFrame, matches, height, width, offset, offsetParent, position, contains, scrollbarSize, scrollLeft, scrollParent, scrollTo, scrollTop, querySelectorAll, closest, addClass, removeClass, hasClass, toggleClass, transitionEnd };
export default {
  addEventListener: addEventListener,
  removeEventListener: removeEventListener,
  animate: animate,
  filter: filter,
  listen: listen,
  style: style,
  getComputedStyle: getComputedStyle,
  activeElement: activeElement,
  ownerDocument: ownerDocument,
  ownerWindow: ownerWindow,
  requestAnimationFrame: requestAnimationFrame,
  cancelAnimationFrame: cancelAnimationFrame,
  matches: matches,
  height: height,
  width: width,
  offset: offset,
  offsetParent: offsetParent,
  position: position,
  contains: contains,
  scrollbarSize: scrollbarSize,
  scrollLeft: scrollLeft,
  scrollParent: scrollParent,
  scrollTo: scrollTo,
  scrollTop: scrollTop,
  querySelectorAll: querySelectorAll,
  closest: closest,
  addClass: addClass,
  removeClass: removeClass,
  hasClass: hasClass,
  toggleClass: toggleClass,
  transitionEnd: transitionEnd
};