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

import {INPUT_EVENT_TYPES} from '../constants';
import {window, userAgent, passiveSupported} from '../utils/globals';

const firefox = userAgent.indexOf('firefox') !== -1;

const {WHEEL_EVENTS} = INPUT_EVENT_TYPES;
const EVENT_TYPE = 'wheel';

// Constants for normalizing input delta
const WHEEL_DELTA_MAGIC_SCALER = 4.000244140625;
const WHEEL_DELTA_PER_LINE = 40;
// Slow down zoom if shift key is held for more precise zooming
const SHIFT_MULTIPLIER = 0.25;

export default class WheelInput {
  constructor(element, callback, options = {}) {
    this.element = element;
    this.callback = callback;

    this.options = Object.assign({enable: true}, options);

    this.events = WHEEL_EVENTS.concat(options.events || []);

    this.handleEvent = this.handleEvent.bind(this);
    this.events.forEach(event =>
      element.addEventListener(event, this.handleEvent, passiveSupported ? {passive: false} : false)
    );
  }

  destroy() {
    this.events.forEach(event => this.element.removeEventListener(event, this.handleEvent));
  }

  /**
   * Enable this input (begin processing events)
   * if the specified event type is among those handled by this input.
   */
  enableEventType(eventType, enabled) {
    if (eventType === EVENT_TYPE) {
      this.options.enable = enabled;
    }
  }

  /* eslint-disable complexity, max-statements */
  handleEvent(event) {
    if (!this.options.enable) {
      return;
    }

    let value = event.deltaY;
    if (window.WheelEvent) {
      // Firefox doubles the values on retina screens...
      if (firefox && event.deltaMode === window.WheelEvent.DOM_DELTA_PIXEL) {
        value /= window.devicePixelRatio;
      }
      if (event.deltaMode === window.WheelEvent.DOM_DELTA_LINE) {
        value *= WHEEL_DELTA_PER_LINE;
      }
    }

    const wheelPosition = {
      x: event.clientX,
      y: event.clientY
    };

    if (value !== 0 && value % WHEEL_DELTA_MAGIC_SCALER === 0) {
      // This one is definitely a mouse wheel event.
      // Normalize this value to match trackpad.
      value = Math.floor(value / WHEEL_DELTA_MAGIC_SCALER);
    }

    if (event.shiftKey && value) {
      value = value * SHIFT_MULTIPLIER;
    }

    this._onWheel(event, -value, wheelPosition);
  }

  _onWheel(srcEvent, delta, position) {
    this.callback({
      type: EVENT_TYPE,
      center: position,
      delta,
      srcEvent,
      pointerType: 'mouse',
      target: srcEvent.target
    });
  }
}
