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

const EVENT_TYPE = 'contextmenu';

export default class ContextmenuInput {

  constructor(element, callback, options = {}) {
    this.element = element;
    this.callback = callback;

    this.options = Object.assign({enable: true}, options);

    this.handleEvent = this.handleEvent.bind(this);
    element.addEventListener('contextmenu', this.handleEvent);
  }

  destroy() {
    this.element.removeEventListener('contextmenu', this.handleEvent);
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

  handleEvent(event) {
    if (!this.options.enable) {
      return;
    }

    this.callback({
      type: EVENT_TYPE,
      center: {
        x: event.clientX,
        y: event.clientY
      },
      srcEvent: event,
      pointerType: 'mouse',
      target: event.target
    });
  }
}
