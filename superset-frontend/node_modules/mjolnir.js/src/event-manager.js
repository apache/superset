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

import {Manager} from './utils/hammer';

import WheelInput from './inputs/wheel-input';
import MoveInput from './inputs/move-input';
import KeyInput from './inputs/key-input';
import ContextmenuInput from './inputs/contextmenu-input';

import EventRegistrar from './utils/event-registrar';

import {
  BASIC_EVENT_ALIASES,
  EVENT_RECOGNIZER_MAP,
  GESTURE_EVENT_ALIASES,
  RECOGNIZERS,
  RECOGNIZER_COMPATIBLE_MAP,
  RECOGNIZER_FALLBACK_MAP
} from './constants';

const DEFAULT_OPTIONS = {
  // event handlers
  events: null,
  // custom recognizers
  recognizers: null,
  recognizerOptions: {},
  // Manager class
  Manager,
  // allow browser default touch action
  // https://github.com/uber/react-map-gl/issues/506
  touchAction: 'none',
  tabIndex: 0
};

// Unified API for subscribing to events about both
// basic input events (e.g. 'mousemove', 'touchstart', 'wheel')
// and gestural input (e.g. 'click', 'tap', 'panstart').
// Delegates gesture related event registration and handling to Hammer.js.
export default class EventManager {
  constructor(element = null, options = {}) {
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.events = new Map();

    this._onBasicInput = this._onBasicInput.bind(this);
    this._onOtherEvent = this._onOtherEvent.bind(this);

    this.setElement(element);

    // Register all passed events.
    const {events} = options;
    if (events) {
      this.on(events);
    }
  }

  setElement(element) {
    if (this.element) {
      // unregister all events
      this.destroy();
    }
    this.element = element;
    if (!element) {
      return;
    }

    const {options} = this;
    const ManagerClass = options.Manager;

    this.manager = new ManagerClass(element, {
      touchAction: options.touchAction,
      recognizers: options.recognizers || RECOGNIZERS
    }).on('hammer.input', this._onBasicInput);

    if (!options.recognizers) {
      // Set default recognize withs
      // http://hammerjs.github.io/recognize-with/
      Object.keys(RECOGNIZER_COMPATIBLE_MAP).forEach(name => {
        const recognizer = this.manager.get(name);
        if (recognizer) {
          RECOGNIZER_COMPATIBLE_MAP[name].forEach(otherName => {
            recognizer.recognizeWith(otherName);
          });
        }
      });
    }

    // Set recognizer options
    for (const recognizerName in options.recognizerOptions) {
      const recognizer = this.manager.get(recognizerName);
      if (recognizer) {
        const recognizerOption = options.recognizerOptions[recognizerName];
        // `enable` is managed by the event registrations
        delete recognizerOption.enable;
        recognizer.set(recognizerOption);
      }
    }

    // Handle events not handled by Hammer.js:
    // - mouse wheel
    // - pointer/touch/mouse move
    this.wheelInput = new WheelInput(element, this._onOtherEvent, {
      enable: false
    });
    this.moveInput = new MoveInput(element, this._onOtherEvent, {
      enable: false
    });
    this.keyInput = new KeyInput(element, this._onOtherEvent, {
      enable: false,
      tabIndex: options.tabIndex
    });
    this.contextmenuInput = new ContextmenuInput(element, this._onOtherEvent, {
      enable: false
    });

    // Register all existing events
    for (const [eventAlias, eventRegistrar] of this.events) {
      if (!eventRegistrar.isEmpty()) {
        // Enable recognizer for this event.
        this._toggleRecognizer(eventRegistrar.recognizerName, true);
        this.manager.on(eventAlias, eventRegistrar.handleEvent);
      }
    }
  }

  // Tear down internal event management implementations.
  destroy() {
    if (this.element) {
      // wheelInput etc. are created in setElement() and therefore
      // cannot exist if there is no element
      this.wheelInput.destroy();
      this.moveInput.destroy();
      this.keyInput.destroy();
      this.contextmenuInput.destroy();
      this.manager.destroy();

      this.wheelInput = null;
      this.moveInput = null;
      this.keyInput = null;
      this.contextmenuInput = null;
      this.manager = null;
      this.element = null;
    }
  }

  // Register an event handler function to be called on `event`.
  on(event, handler, opts) {
    this._addEventHandler(event, handler, opts, false);
  }

  // Register an event handler function to be called on `event`, then remove it
  once(event, handler, opts) {
    this._addEventHandler(event, handler, opts, true);
  }

  // Register an event handler function to be called on `event`
  // This handler does not ask the event to be recognized at all times.
  // Instead, it only "intercepts" the event if some other handler is getting it.
  watch(event, handler, opts) {
    this._addEventHandler(event, handler, opts, false, true);
  }

  /**
   * Deregister a previously-registered event handler.
   * @param {string|Object} event   An event name (String) or map of event names to handlers
   * @param {Function} [handler]    The function to be called on `event`.
   */
  off(event, handler) {
    this._removeEventHandler(event, handler);
  }

  /*
   * Enable/disable recognizer for the given event
   */
  _toggleRecognizer(name, enabled) {
    const {manager} = this;
    if (!manager) {
      return;
    }
    const recognizer = manager.get(name);
    if (recognizer && recognizer.options.enable !== enabled) {
      recognizer.set({enable: enabled});

      const fallbackRecognizers = RECOGNIZER_FALLBACK_MAP[name];
      if (fallbackRecognizers && !this.options.recognizers) {
        // Set default require failures
        // http://hammerjs.github.io/require-failure/
        fallbackRecognizers.forEach(otherName => {
          const otherRecognizer = manager.get(otherName);
          if (enabled) {
            // Wait for this recognizer to fail
            otherRecognizer.requireFailure(name);
            /**
             * This seems to be a bug in hammerjs:
             * requireFailure() adds both ways
             * dropRequireFailure() only drops one way
             * https://github.com/hammerjs/hammer.js/blob/master/src/recognizerjs/
               recognizer-constructor.js#L136
             */
            recognizer.dropRequireFailure(otherName);
          } else {
            // Do not wait for this recognizer to fail
            otherRecognizer.dropRequireFailure(name);
          }
        });
      }
    }
    this.wheelInput.enableEventType(name, enabled);
    this.moveInput.enableEventType(name, enabled);
    this.keyInput.enableEventType(name, enabled);
    this.contextmenuInput.enableEventType(name, enabled);
  }

  /**
   * Process the event registration for a single event + handler.
   */
  _addEventHandler(event, handler, opts, once, passive) {
    if (typeof event !== 'string') {
      opts = handler;
      // If `event` is a map, call `on()` for each entry.
      for (const eventName in event) {
        this._addEventHandler(eventName, event[eventName], opts, once, passive);
      }
      return;
    }

    const {manager, events} = this;
    // Alias to a recognized gesture as necessary.
    const eventAlias = GESTURE_EVENT_ALIASES[event] || event;

    let eventRegistrar = events.get(eventAlias);
    if (!eventRegistrar) {
      eventRegistrar = new EventRegistrar(this);
      events.set(eventAlias, eventRegistrar);
      // Enable recognizer for this event.
      eventRegistrar.recognizerName = EVENT_RECOGNIZER_MAP[eventAlias] || eventAlias;
      // Listen to the event
      if (manager) {
        manager.on(eventAlias, eventRegistrar.handleEvent);
      }
    }
    eventRegistrar.add(event, handler, opts, once, passive);
    if (!eventRegistrar.isEmpty()) {
      this._toggleRecognizer(eventRegistrar.recognizerName, true);
    }
  }

  /**
   * Process the event deregistration for a single event + handler.
   */
  _removeEventHandler(event, handler) {
    if (typeof event !== 'string') {
      // If `event` is a map, call `off()` for each entry.
      for (const eventName in event) {
        this._removeEventHandler(eventName, event[eventName]);
      }
      return;
    }

    const {events} = this;
    // Alias to a recognized gesture as necessary.
    const eventAlias = GESTURE_EVENT_ALIASES[event] || event;

    const eventRegistrar = events.get(eventAlias);

    if (!eventRegistrar) {
      return;
    }

    eventRegistrar.remove(event, handler);

    if (eventRegistrar.isEmpty()) {
      const {recognizerName} = eventRegistrar;
      // Disable recognizer if no more handlers are attached to its events
      let isRecognizerUsed = false;
      for (const eh of events.values()) {
        if (eh.recognizerName === recognizerName && !eh.isEmpty()) {
          isRecognizerUsed = true;
          break;
        }
      }
      if (!isRecognizerUsed) {
        this._toggleRecognizer(recognizerName, false);
      }
    }
  }

  /**
   * Handle basic events using the 'hammer.input' Hammer.js API:
   * Before running Recognizers, Hammer emits a 'hammer.input' event
   * with the basic event info. This function emits all basic events
   * aliased to the "class" of event received.
   * See constants.BASIC_EVENT_CLASSES basic event class definitions.
   */
  _onBasicInput(event) {
    const {srcEvent} = event;
    const alias = BASIC_EVENT_ALIASES[srcEvent.type];
    if (alias) {
      // fire all events aliased to srcEvent.type
      this.manager.emit(alias, event);
    }
  }

  /**
   * Handle events not supported by Hammer.js,
   * and pipe back out through same (Hammer) channel used by other events.
   */
  _onOtherEvent(event) {
    // console.log('onotherevent', event.type, event)
    this.manager.emit(event.type, event);
  }
}
