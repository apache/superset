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

const {MOUSE_EVENTS} = INPUT_EVENT_TYPES;
const MOVE_EVENT_TYPE = 'pointermove';
const OVER_EVENT_TYPE = 'pointerover';
const OUT_EVENT_TYPE = 'pointerout';
const LEAVE_EVENT_TYPE = 'pointerleave';

/**
 * Hammer.js swallows 'move' events (for pointer/touch/mouse)
 * when the pointer is not down. This class sets up a handler
 * specifically for these events to work around this limitation.
 * Note that this could be extended to more intelligently handle
 * move events across input types, e.g. storing multiple simultaneous
 * pointer/touch events, calculating speed/direction, etc.
 */
export default class MoveInput {

  constructor(element, callback, options = {}) {
    this.element = element;
    this.callback = callback;
    this.pressed = false;

    this.options = Object.assign({enable: true}, options);
    this.enableMoveEvent = this.options.enable;
    this.enableLeaveEvent = this.options.enable;
    this.enableOutEvent = this.options.enable;
    this.enableOverEvent = this.options.enable;

    this.events = MOUSE_EVENTS.concat(options.events || []);

    this.handleEvent = this.handleEvent.bind(this);
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
    if (eventType === MOVE_EVENT_TYPE) {
      this.enableMoveEvent = enabled;
    }
    if (eventType === OVER_EVENT_TYPE) {
      this.enableOverEvent = enabled;
    }
    if (eventType === OUT_EVENT_TYPE) {
      this.enableOutEvent = enabled;
    }
    if (eventType === LEAVE_EVENT_TYPE) {
      this.enableLeaveEvent = enabled;
    }
  }

  handleEvent(event) {
    this.handleOverEvent(event);
    this.handleOutEvent(event);
    this.handleLeaveEvent(event);
    this.handleMoveEvent(event);
  }

  handleOverEvent(event) {
    if (this.enableOverEvent) {
      if (event.type === 'mouseover') {
        this.callback({
          type: OVER_EVENT_TYPE,
          srcEvent: event,
          pointerType: 'mouse',
          target: event.target
        });
      }
    }
  }

  handleOutEvent(event) {
    if (this.enableOutEvent) {
      if (event.type === 'mouseout') {
        this.callback({
          type: OUT_EVENT_TYPE,
          srcEvent: event,
          pointerType: 'mouse',
          target: event.target
        });
      }
    }
  }

  handleLeaveEvent(event) {
    if (this.enableLeaveEvent) {
      if (event.type === 'mouseleave') {
        this.callback({
          type: LEAVE_EVENT_TYPE,
          srcEvent: event,
          pointerType: 'mouse',
          target: event.target
        });
      }
    }
  }

  handleMoveEvent(event) {
    if (this.enableMoveEvent) {
      switch (event.type) {
      case 'mousedown':
        if (event.button >= 0) {
          // Button is down
          this.pressed = true;
        }
        break;
      case 'mousemove':
      // Move events use `which` to track the button being pressed
        if (event.which === 0) {
          // Button is not down
          this.pressed = false;
        }
        if (!this.pressed) {
          // Drag events are emitted by hammer already
          // we just need to emit the move event on hover
          this.callback({
            type: MOVE_EVENT_TYPE,
            srcEvent: event,
            pointerType: 'mouse',
            target: event.target
          });
        }
        break;
      case 'mouseup':
        this.pressed = false;
        break;
      default:
      }
    }
  }
}
