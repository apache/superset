"use strict";
const DOMException = require("domexception");

const reportException = require("../helpers/runtime-script-errors");
const idlUtils = require("../generated/utils");
const {
  isNode, isShadowRoot, isSlotable, getRoot, getEventTargetParent,
  isShadowInclusiveAncestor, retarget
} = require("../helpers/shadow-dom");

const Event = require("../generated/Event").interface;
const MouseEvent = require("../generated/MouseEvent");

class EventTargetImpl {
  constructor() {
    this._eventListeners = Object.create(null);
  }

  addEventListener(type, callback, options) {
    // webidl2js currently can't handle neither optional arguments nor callback interfaces
    if (callback === undefined || callback === null) {
      callback = null;
    } else if (typeof callback !== "object" && typeof callback !== "function") {
      throw new TypeError("Only undefined, null, an object, or a function are allowed for the callback parameter");
    }

    options = normalizeEventHandlerOptions(options, ["capture", "once", "passive"]);

    if (callback === null) {
      return;
    }

    if (!this._eventListeners[type]) {
      this._eventListeners[type] = [];
    }

    for (let i = 0; i < this._eventListeners[type].length; ++i) {
      const listener = this._eventListeners[type][i];
      if (listener.options.capture === options.capture && listener.callback === callback) {
        return;
      }
    }

    this._eventListeners[type].push({
      callback,
      options
    });
  }

  removeEventListener(type, callback, options) {
    if (callback === undefined || callback === null) {
      callback = null;
    } else if (typeof callback !== "object" && typeof callback !== "function") {
      throw new TypeError("Only undefined, null, an object, or a function are allowed for the callback parameter");
    }

    options = normalizeEventHandlerOptions(options, ["capture"]);

    if (callback === null) {
      // Optimization, not in the spec.
      return;
    }

    if (!this._eventListeners[type]) {
      return;
    }

    for (let i = 0; i < this._eventListeners[type].length; ++i) {
      const listener = this._eventListeners[type][i];
      if (listener.callback === callback && listener.options.capture === options.capture) {
        this._eventListeners[type].splice(i, 1);
        break;
      }
    }
  }

  dispatchEvent(eventImpl) {
    if (eventImpl._dispatchFlag || !eventImpl._initializedFlag) {
      throw new DOMException("Tried to dispatch an uninitialized event", "InvalidStateError");
    }
    if (eventImpl.eventPhase !== Event.NONE) {
      throw new DOMException("Tried to dispatch a dispatching event", "InvalidStateError");
    }

    eventImpl.isTrusted = false;

    return this._dispatch(eventImpl);
  }

  // https://dom.spec.whatwg.org/#get-the-parent
  _getTheParent() {
    return null;
  }

  // https://dom.spec.whatwg.org/#concept-event-dispatch
  // legacyOutputDidListenersThrowFlag optional parameter is not necessary here since it is only used by indexDB.
  _dispatch(eventImpl, targetOverride /* , legacyOutputDidListenersThrowFlag */) {
    let targetImpl = this;
    let clearTargets = false;
    let activationTarget = null;

    eventImpl._dispatchFlag = true;

    targetOverride = targetOverride || targetImpl;
    let relatedTarget = retarget(eventImpl.relatedTarget, targetImpl);

    if (targetImpl !== relatedTarget || targetImpl === eventImpl.relatedTarget) {
      const touchTargets = [];

      appendToEventPath(eventImpl, targetImpl, targetOverride, relatedTarget, touchTargets, false);

      const isActivationEvent = MouseEvent.isImpl(eventImpl) && eventImpl.type === "click";

      if (isActivationEvent && targetImpl._hasActivationBehavior) {
        activationTarget = targetImpl;
      }

      let slotInClosedTree = false;
      let slotable = isSlotable(targetImpl) && targetImpl._assignedSlot ? targetImpl : null;
      let parent = getEventTargetParent(targetImpl, eventImpl);

      // Populate event path
      // https://dom.spec.whatwg.org/#event-path
      while (parent !== null) {
        if (slotable !== null) {
          if (parent.localName !== "slot") {
            throw new Error(`JSDOM Internal Error: Expected parent to be a Slot`);
          }

          slotable = null;

          const parentRoot = getRoot(parent);
          if (isShadowRoot(parentRoot) && parentRoot.mode === "closed") {
            slotInClosedTree = true;
          }
        }

        if (isSlotable(parent) && parent._assignedSlot) {
          slotable = parent;
        }

        relatedTarget = retarget(eventImpl.relatedTarget, parent);

        if (
          (isNode(parent) && isShadowInclusiveAncestor(getRoot(targetImpl), parent)) ||
          idlUtils.wrapperForImpl(parent).constructor.name === "Window"
        ) {
          if (isActivationEvent && eventImpl.bubbles && activationTarget === null &&
              parent._hasActivationBehavior) {
            activationTarget = parent;
          }

          appendToEventPath(eventImpl, parent, null, relatedTarget, touchTargets, slotInClosedTree);
        } else if (parent === relatedTarget) {
          parent = null;
        } else {
          targetImpl = parent;

          if (isActivationEvent && activationTarget === null && targetImpl._hasActivationBehavior) {
            activationTarget = targetImpl;
          }

          appendToEventPath(eventImpl, parent, targetImpl, relatedTarget, touchTargets, slotInClosedTree);
        }

        if (parent !== null) {
          parent = getEventTargetParent(parent, eventImpl);
        }

        slotInClosedTree = false;
      }

      let clearTargetsStructIndex = -1;
      for (let i = eventImpl._path.length - 1; i >= 0 && clearTargetsStructIndex === -1; i--) {
        if (eventImpl._path[i].target !== null) {
          clearTargetsStructIndex = i;
        }
      }
      const clearTargetsStruct = eventImpl._path[clearTargetsStructIndex];

      clearTargets =
          (isNode(clearTargetsStruct.target) && isShadowRoot(getRoot(clearTargetsStruct.target))) ||
          (isNode(clearTargetsStruct.relatedTarget) && isShadowRoot(getRoot(clearTargetsStruct.relatedTarget)));

      if (activationTarget !== null && activationTarget._legacyPreActivationBehavior) {
        activationTarget._legacyPreActivationBehavior();
      }

      for (let i = eventImpl._path.length - 1; i >= 0; --i) {
        const struct = eventImpl._path[i];

        if (struct.target !== null) {
          eventImpl.eventPhase = Event.AT_TARGET;
        } else {
          eventImpl.eventPhase = Event.CAPTURING_PHASE;
        }

        invokeEventListeners(struct, eventImpl, "capturing");
      }

      for (let i = 0; i < eventImpl._path.length; i++) {
        const struct = eventImpl._path[i];

        if (struct.target !== null) {
          eventImpl.eventPhase = Event.AT_TARGET;
        } else {
          if (!eventImpl.bubbles) {
            continue;
          }

          eventImpl.eventPhase = Event.BUBBLING_PHASE;
        }

        invokeEventListeners(struct, eventImpl, "bubbling");
      }
    }

    eventImpl.eventPhase = Event.NONE;

    eventImpl.currentTarget = null;
    eventImpl._path = [];
    eventImpl._dispatchFlag = false;
    eventImpl._stopPropagationFlag = false;
    eventImpl._stopImmediatePropagationFlag = false;

    if (clearTargets) {
      eventImpl.target = null;
      eventImpl.relatedTarget = null;
    }

    if (activationTarget !== null) {
      if (!eventImpl._canceledFlag) {
        activationTarget._activationBehavior();
      } else if (activationTarget._legacyCanceledActivationBehavior) {
        activationTarget._legacyCanceledActivationBehavior();
      }
    }

    return !eventImpl._canceledFlag;
  }
}

module.exports = {
  implementation: EventTargetImpl
};

// https://dom.spec.whatwg.org/#concept-event-listener-invoke
function invokeEventListeners(struct, eventImpl, phase) {
  const structIndex = eventImpl._path.indexOf(struct);
  for (let i = structIndex; i >= 0; i--) {
    const t = eventImpl._path[i];
    if (t.target) {
      eventImpl.target = t.target;
      break;
    }
  }

  eventImpl.relatedTarget = idlUtils.wrapperForImpl(struct.relatedTarget);

  if (eventImpl._stopPropagationFlag) {
    return;
  }

  eventImpl.currentTarget = idlUtils.wrapperForImpl(struct.item);

  const listeners = struct.item._eventListeners;
  innerInvokeEventListeners(eventImpl, listeners, phase, struct);
}

// https://dom.spec.whatwg.org/#concept-event-listener-inner-invoke
function innerInvokeEventListeners(eventImpl, listeners, phase) {
  let found = false;

  const { type, target } = eventImpl;
  const wrapper = idlUtils.wrapperForImpl(target);

  if (!listeners || !listeners[type]) {
    return found;
  }

  // Copy event listeners before iterating since the list can be modified during the iteration.
  const handlers = listeners[type].slice();

  for (let i = 0; i < handlers.length; i++) {
    const listener = handlers[i];
    const { capture, once, passive } = listener.options;

    // Check if the event listener has been removed since the listeners has been cloned.
    if (!listeners[type].includes(listener)) {
      continue;
    }

    found = true;

    if (
      (phase === "capturing" && !capture) ||
      (phase === "bubbling" && capture)
    ) {
      continue;
    }

    if (once) {
      listeners[type].splice(listeners[type].indexOf(listener), 1);
    }

    if (passive) {
      eventImpl._inPassiveListenerFlag = true;
    }

    try {
      if (typeof listener.callback === "object") {
        if (typeof listener.callback.handleEvent === "function") {
          listener.callback.handleEvent(idlUtils.wrapperForImpl(eventImpl));
        }
      } else {
        listener.callback.call(eventImpl.currentTarget, idlUtils.wrapperForImpl(eventImpl));
      }
    } catch (e) {
      let window = null;
      if (wrapper && wrapper._document) {
        // Triggered by Window
        window = wrapper;
      } else if (target._ownerDocument) {
        // Triggered by most webidl2js'ed instances
        window = target._ownerDocument._defaultView;
      } else if (wrapper._ownerDocument) {
        // Currently triggered by XHR and some other non-webidl2js things
        window = wrapper._ownerDocument._defaultView;
      }

      if (window) {
        reportException(window, e);
      }
      // Errors in window-less documents just get swallowed... can you think of anything better?
    }

    eventImpl._inPassiveListenerFlag = false;

    if (eventImpl._stopImmediatePropagationFlag) {
      return found;
    }
  }

  return found;
}

/**
 * Normalize the event listeners options argument in order to get always a valid options object
 * @param   {Object} options         - user defined options
 * @param   {Array} defaultBoolKeys  - boolean properties that should belong to the options object
 * @returns {Object} object containing at least the "defaultBoolKeys"
 */
function normalizeEventHandlerOptions(options, defaultBoolKeys) {
  const returnValue = {};

  // no need to go further here
  if (typeof options === "boolean" || options === null || typeof options === "undefined") {
    returnValue.capture = Boolean(options);
    return returnValue;
  }

  // non objects options so we typecast its value as "capture" value
  if (typeof options !== "object") {
    returnValue.capture = Boolean(options);
    // at this point we don't need to loop the "capture" key anymore
    defaultBoolKeys = defaultBoolKeys.filter(k => k !== "capture");
  }

  for (const key of defaultBoolKeys) {
    returnValue[key] = Boolean(options[key]);
  }

  return returnValue;
}

// https://dom.spec.whatwg.org/#concept-event-path-append
function appendToEventPath(eventImpl, target, targetOverride, relatedTarget, touchTargets, slotInClosedTree) {
  const itemInShadowTree = isNode(target) && isShadowRoot(getRoot(target));
  const rootOfClosedTree = isShadowRoot(target) && target.mode === "closed";

  eventImpl._path.push({
    item: target,
    itemInShadowTree,
    target: targetOverride,
    relatedTarget,
    touchTargets,
    rootOfClosedTree,
    slotInClosedTree
  });
}
