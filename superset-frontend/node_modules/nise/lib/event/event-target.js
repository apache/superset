"use strict";

function flattenOptions(options) {
    if (options !== Object(options)) {
        return {
            capture: Boolean(options),
            once: false,
            passive: false
        };
    }
    return {
        capture: Boolean(options.capture),
        once: Boolean(options.once),
        passive: Boolean(options.passive)
    };
}
function not(fn) {
    return function() {
        return !fn.apply(this, arguments);
    };
}
function hasListenerFilter(listener, capture) {
    return function(listenerSpec) {
        return (
            listenerSpec.capture === capture &&
            listenerSpec.listener === listener
        );
    };
}

var EventTarget = {
    // https://dom.spec.whatwg.org/#dom-eventtarget-addeventlistener
    addEventListener: function addEventListener(
        event,
        listener,
        providedOptions
    ) {
        // 3. Let capture, passive, and once be the result of flattening more options.
        // Flatten property before executing step 2,
        // feture detection is usually based on registering handler with options object,
        // that has getter defined
        // addEventListener("load", () => {}, {
        //    get once() { supportsOnce = true; }
        // });
        var options = flattenOptions(providedOptions);

        // 2. If callback is null, then return.
        if (listener === null || listener === undefined) {
            return;
        }

        this.eventListeners = this.eventListeners || {};
        this.eventListeners[event] = this.eventListeners[event] || [];

        // 4. If context object’s associated list of event listener
        //    does not contain an event listener whose type is type,
        //    callback is callback, and capture is capture, then append
        //    a new event listener to it, whose type is type, callback is
        //    callback, capture is capture, passive is passive, and once is once.
        if (
            !this.eventListeners[event].some(
                hasListenerFilter(listener, options.capture)
            )
        ) {
            this.eventListeners[event].push({
                listener: listener,
                capture: options.capture,
                once: options.once
            });
        }
    },

    // https://dom.spec.whatwg.org/#dom-eventtarget-removeeventlistener
    removeEventListener: function removeEventListener(
        event,
        listener,
        providedOptions
    ) {
        if (!this.eventListeners || !this.eventListeners[event]) {
            return;
        }

        // 2. Let capture be the result of flattening options.
        var options = flattenOptions(providedOptions);

        // 3. If there is an event listener in the associated list of
        //    event listeners whose type is type, callback is callback,
        //    and capture is capture, then set that event listener’s
        //    removed to true and remove it from the associated list of event listeners.
        this.eventListeners[event] = this.eventListeners[event].filter(
            not(hasListenerFilter(listener, options.capture))
        );
    },

    dispatchEvent: function dispatchEvent(event) {
        if (!this.eventListeners || !this.eventListeners[event.type]) {
            return Boolean(event.defaultPrevented);
        }

        var self = this;
        var type = event.type;
        var listeners = self.eventListeners[type];

        // Remove listeners, that should be dispatched once
        // before running dispatch loop to avoid nested dispatch issues
        self.eventListeners[type] = listeners.filter(function(listenerSpec) {
            return !listenerSpec.once;
        });
        listeners.forEach(function(listenerSpec) {
            var listener = listenerSpec.listener;
            if (typeof listener === "function") {
                listener.call(self, event);
            } else {
                listener.handleEvent(event);
            }
        });

        return Boolean(event.defaultPrevented);
    }
};

module.exports = EventTarget;
