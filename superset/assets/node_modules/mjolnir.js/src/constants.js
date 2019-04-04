// Copyright (c) 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import Hammer from './utils/hammer';

// This module contains constants that must be conditionally required
// due to `window`/`document` references downstream.
export const RECOGNIZERS = Hammer ? [
  [Hammer.Rotate, {enable: false}],
  [Hammer.Pinch, {enable: false}],
  [Hammer.Swipe, {enable: false}],
  [Hammer.Pan, {threshold: 0, enable: false}],
  [Hammer.Press, {enable: false}],
  [Hammer.Tap, {event: 'doubletap', taps: 2, enable: false}],
  [Hammer.Tap, {enable: false}]
] : null;

// Recognize the following gestures even if a given recognizer succeeds
export const RECOGNIZER_COMPATIBLE_MAP = {
  rotate: ['pinch']
};

// Recognize the folling gestures only if a given recognizer fails
export const RECOGNIZER_FALLBACK_MAP = {
  doubletap: ['tap']
};

/**
 * Only one set of basic input events will be fired by Hammer.js:
 * either pointer, touch, or mouse, depending on system support.
 * In order to enable an application to be agnostic of system support,
 * alias basic input events into "classes" of events: down, move, and up.
 * See `_onBasicInput()` for usage of these aliases.
 */
export const BASIC_EVENT_ALIASES = {
  pointerdown: 'pointerdown',
  pointermove: 'pointermove',
  pointerup: 'pointerup',
  touchstart: 'pointerdown',
  touchmove: 'pointermove',
  touchend: 'pointerup',
  mousedown: 'pointerdown',
  mousemove: 'pointermove',
  mouseup: 'pointerup'
};

export const INPUT_EVENT_TYPES = {
  KEY_EVENTS: [
    'keydown',
    'keyup'
  ],
  MOUSE_EVENTS: [
    'mousedown',
    'mousemove',
    'mouseup',
    'mouseleave'
  ],
  WHEEL_EVENTS: [
    // Chrome, Safari
    'wheel',
    // IE
    'mousewheel',
    // legacy Firefox
    'DOMMouseScroll'
  ]
};

/**
 * "Gestural" events are those that have semantic meaning beyond the basic input event,
 * e.g. a click or tap is a sequence of `down` and `up` events with no `move` event in between.
 * Hammer.js handles these with its Recognizer system;
 * this block maps event names to the Recognizers required to detect the events.
 */
export const EVENT_RECOGNIZER_MAP = {
  tap: 'tap',
  doubletap: 'doubletap',
  press: 'press',
  pinch: 'pinch',
  pinchin: 'pinch',
  pinchout: 'pinch',
  pinchstart: 'pinch',
  pinchmove: 'pinch',
  pinchend: 'pinch',
  pinchcancel: 'pinch',
  rotate: 'rotate',
  rotatestart: 'rotate',
  rotatemove: 'rotate',
  rotateend: 'rotate',
  rotatecancel: 'rotate',
  pan: 'pan',
  panstart: 'pan',
  panmove: 'pan',
  panup: 'pan',
  pandown: 'pan',
  panleft: 'pan',
  panright: 'pan',
  panend: 'pan',
  pancancel: 'pan',
  swipe: 'swipe',
  swipeleft: 'swipe',
  swiperight: 'swipe',
  swipeup: 'swipe',
  swipedown: 'swipe'
};

/**
 * Map gestural events typically provided by browsers
 * that are not reported in 'hammer.input' events
 * to corresponding Hammer.js gestures.
 */
export const GESTURE_EVENT_ALIASES = {
  click: 'tap',
  dblclick: 'doubletap',
  mousedown: 'pointerdown',
  mousemove: 'pointermove',
  mouseup: 'pointerup',
  mouseleave: 'pointerleave'
};
