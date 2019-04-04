import {whichButtons, getOffsetPosition} from './event-utils';

export default class EventRegistrar {
  constructor(eventManager) {
    this.eventManager = eventManager;
    this.handlers = [];
    // Element -> handler map
    this.handlersByElement = new Map();

    this.handleEvent = this.handleEvent.bind(this);
  }

  isEmpty() {
    return this.handlers.length === 0;
  }

  add(type, handler, srcElement = 'root') {
    const {handlers, handlersByElement} = this;

    if (!handlersByElement.has(srcElement)) {
      handlersByElement.set(srcElement, []);
    }
    const entry = {type, handler, srcElement};
    handlers.push(entry);
    handlersByElement.get(srcElement).push(entry);
  }

  remove(type, handler) {
    const {handlers, handlersByElement} = this;

    for (let i = handlers.length - 1; i >= 0; i--) {
      const entry = handlers[i];

      if (entry.type === type && entry.handler === handler) {
        handlers.splice(i, 1);
        const entries = handlersByElement.get(entry.srcElement);
        entries.splice(entries.indexOf(entry), 1);
        if (entries.length === 0) {
          handlersByElement.delete(entry.srcElement);
        }
      }
    }
  }

  /**
   * Handles hammerjs event
   */
  handleEvent(event) {
    if (this.isEmpty()) {
      return;
    }

    const mjolnirEvent = this._normalizeEvent(event);
    let target = event.srcEvent.target;

    while (target && target !== mjolnirEvent.rootElement) {
      this._emit(mjolnirEvent, target);
      if (mjolnirEvent.handled) {
        return;
      }
      target = target.parentNode;
    }
    this._emit(mjolnirEvent, 'root');
  }

  /**
   * Invoke handlers on a particular element
   */
  _emit(event, srcElement) {
    const entries = this.handlersByElement.get(srcElement);

    if (entries) {
      let immediatePropagationStopped = false;

      // Prevents the current event from bubbling up
      const stopPropagation = () => {
        event.handled = true;
      };
      // Prevent any remaining listeners from being called
      const stopImmediatePropagation = () => {
        event.handled = true;
        immediatePropagationStopped = true;
      };
      for (let i = 0; i < entries.length; i++) {
        const {type, handler} = entries[i];
        handler(Object.assign({}, event, {
          type,
          stopPropagation,
          stopImmediatePropagation
        }));
        if (immediatePropagationStopped) {
          break;
        }
      }
    }
  }

  /**
   * Normalizes hammerjs and custom events to have predictable fields.
   */
  _normalizeEvent(event) {
    const rootElement = this.eventManager.element;

    return Object.assign({}, event,
      whichButtons(event),
      getOffsetPosition(event, rootElement),
      {
        handled: false,
        rootElement
      });
  }

}
