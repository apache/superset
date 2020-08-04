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

const {KEY_EVENTS} = INPUT_EVENT_TYPES;
const DOWN_EVENT_TYPE = 'keydown';
const UP_EVENT_TYPE = 'keyup';

export default class KeyInput {
  constructor(element, callback, options = {}) {
    this.element = element;
    this.callback = callback;

    this.options = Object.assign({enable: true}, options);
    this.enableDownEvent = this.options.enable;
    this.enableUpEvent = this.options.enable;

    this.events = KEY_EVENTS.concat(options.events || []);

    this.handleEvent = this.handleEvent.bind(this);

    element.tabIndex = options.tabIndex || 0;
    element.style.outline = 'none';
    this.events.forEach(event => element.addEventListener(event, this.handleEvent));
  }

  destroy() {
    this.events.forEach(event => this.element.removeEventListener(event, this.handleEvent));
  }

  /**
   * Enable this input (begin processing events)
   * if the specified event type is among those handled by this input.
   */
  enableEventType(eventType, enabled) {
    if (eventType === DOWN_EVENT_TYPE) {
      this.enableDownEvent = enabled;
    }
    if (eventType === UP_EVENT_TYPE) {
      this.enableUpEvent = enabled;
    }
  }

  handleEvent(event) {
    // Ignore if focused on text input
    const targetElement = event.target || event.srcElement;
    if (
      (targetElement.tagName === 'INPUT' && targetElement.type === 'text') ||
      targetElement.tagName === 'TEXTAREA'
    ) {
      return;
    }

    if (this.enableDownEvent && event.type === 'keydown') {
      this.callback({
        type: DOWN_EVENT_TYPE,
        srcEvent: event,
        key: event.key,
        target: event.target
      });
    }

    if (this.enableUpEvent && event.type === 'keyup') {
      this.callback({
        type: UP_EVENT_TYPE,
        srcEvent: event,
        key: event.key,
        target: event.target
      });
    }
  }
}
