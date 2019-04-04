'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _constants = require('../constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var MOUSE_EVENTS = _constants.INPUT_EVENT_TYPES.MOUSE_EVENTS; // Copyright (c) 2017 Uber Technologies, Inc.
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

var MOVE_EVENT_TYPE = 'pointermove';
var LEAVE_EVENT_TYPE = 'pointerleave';

/**
 * Hammer.js swallows 'move' events (for pointer/touch/mouse)
 * when the pointer is not down. This class sets up a handler
 * specifically for these events to work around this limitation.
 * Note that this could be extended to more intelligently handle
 * move events across input types, e.g. storing multiple simultaneous
 * pointer/touch events, calculating speed/direction, etc.
 */

var MoveInput = function () {
  function MoveInput(element, callback) {
    var _this = this;

    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    (0, _classCallCheck3.default)(this, MoveInput);

    this.element = element;
    this.callback = callback;
    this.pressed = false;

    this.options = (0, _assign2.default)({ enable: true }, options);
    this.enableMoveEvent = this.options.enable;
    this.enableLeaveEvent = this.options.enable;

    this.events = MOUSE_EVENTS.concat(options.events || []);

    this.handleEvent = this.handleEvent.bind(this);
    this.events.forEach(function (event) {
      return element.addEventListener(event, _this.handleEvent);
    });
  }

  (0, _createClass3.default)(MoveInput, [{
    key: 'destroy',
    value: function destroy() {
      var _this2 = this;

      this.events.forEach(function (event) {
        return _this2.element.removeEventListener(event, _this2.handleEvent);
      });
    }

    /**
     * Enable this input (begin processing events)
     * if the specified event type is among those handled by this input.
     */

  }, {
    key: 'enableEventType',
    value: function enableEventType(eventType, enabled) {
      if (eventType === MOVE_EVENT_TYPE) {
        this.enableMoveEvent = enabled;
      }
      if (eventType === LEAVE_EVENT_TYPE) {
        this.enableLeaveEvent = enabled;
      }
    }
  }, {
    key: 'handleEvent',
    value: function handleEvent(event) {
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
  }]);
  return MoveInput;
}();

exports.default = MoveInput;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pbnB1dHMvbW92ZS1pbnB1dC5qcyJdLCJuYW1lcyI6WyJNT1VTRV9FVkVOVFMiLCJNT1ZFX0VWRU5UX1RZUEUiLCJMRUFWRV9FVkVOVF9UWVBFIiwiTW92ZUlucHV0IiwiZWxlbWVudCIsImNhbGxiYWNrIiwib3B0aW9ucyIsInByZXNzZWQiLCJlbmFibGUiLCJlbmFibGVNb3ZlRXZlbnQiLCJlbmFibGVMZWF2ZUV2ZW50IiwiZXZlbnRzIiwiY29uY2F0IiwiaGFuZGxlRXZlbnQiLCJiaW5kIiwiZm9yRWFjaCIsImFkZEV2ZW50TGlzdGVuZXIiLCJldmVudCIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJldmVudFR5cGUiLCJlbmFibGVkIiwidHlwZSIsInNyY0V2ZW50IiwicG9pbnRlclR5cGUiLCJ0YXJnZXQiLCJidXR0b24iLCJ3aGljaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0JBOzs7O0lBRU9BLFksZ0NBQUFBLFksRUF0QlA7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBS0EsSUFBTUMsa0JBQWtCLGFBQXhCO0FBQ0EsSUFBTUMsbUJBQW1CLGNBQXpCOztBQUVBOzs7Ozs7Ozs7SUFRcUJDLFM7QUFFbkIscUJBQVlDLE9BQVosRUFBcUJDLFFBQXJCLEVBQTZDO0FBQUE7O0FBQUEsUUFBZEMsT0FBYyx1RUFBSixFQUFJO0FBQUE7O0FBQzNDLFNBQUtGLE9BQUwsR0FBZUEsT0FBZjtBQUNBLFNBQUtDLFFBQUwsR0FBZ0JBLFFBQWhCO0FBQ0EsU0FBS0UsT0FBTCxHQUFlLEtBQWY7O0FBRUEsU0FBS0QsT0FBTCxHQUFlLHNCQUFjLEVBQUNFLFFBQVEsSUFBVCxFQUFkLEVBQThCRixPQUE5QixDQUFmO0FBQ0EsU0FBS0csZUFBTCxHQUF1QixLQUFLSCxPQUFMLENBQWFFLE1BQXBDO0FBQ0EsU0FBS0UsZ0JBQUwsR0FBd0IsS0FBS0osT0FBTCxDQUFhRSxNQUFyQzs7QUFFQSxTQUFLRyxNQUFMLEdBQWNYLGFBQWFZLE1BQWIsQ0FBb0JOLFFBQVFLLE1BQVIsSUFBa0IsRUFBdEMsQ0FBZDs7QUFFQSxTQUFLRSxXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUJDLElBQWpCLENBQXNCLElBQXRCLENBQW5CO0FBQ0EsU0FBS0gsTUFBTCxDQUFZSSxPQUFaLENBQW9CO0FBQUEsYUFBU1gsUUFBUVksZ0JBQVIsQ0FBeUJDLEtBQXpCLEVBQWdDLE1BQUtKLFdBQXJDLENBQVQ7QUFBQSxLQUFwQjtBQUNEOzs7OzhCQUVTO0FBQUE7O0FBQ1IsV0FBS0YsTUFBTCxDQUFZSSxPQUFaLENBQW9CO0FBQUEsZUFBUyxPQUFLWCxPQUFMLENBQWFjLG1CQUFiLENBQWlDRCxLQUFqQyxFQUF3QyxPQUFLSixXQUE3QyxDQUFUO0FBQUEsT0FBcEI7QUFDRDs7QUFFRDs7Ozs7OztvQ0FJZ0JNLFMsRUFBV0MsTyxFQUFTO0FBQ2xDLFVBQUlELGNBQWNsQixlQUFsQixFQUFtQztBQUNqQyxhQUFLUSxlQUFMLEdBQXVCVyxPQUF2QjtBQUNEO0FBQ0QsVUFBSUQsY0FBY2pCLGdCQUFsQixFQUFvQztBQUNsQyxhQUFLUSxnQkFBTCxHQUF3QlUsT0FBeEI7QUFDRDtBQUNGOzs7Z0NBRVdILEssRUFBTztBQUNqQixVQUFJLEtBQUtQLGdCQUFULEVBQTJCO0FBQ3pCLFlBQUlPLE1BQU1JLElBQU4sS0FBZSxZQUFuQixFQUFpQztBQUMvQixlQUFLaEIsUUFBTCxDQUFjO0FBQ1pnQixrQkFBTW5CLGdCQURNO0FBRVpvQixzQkFBVUwsS0FGRTtBQUdaTSx5QkFBYSxPQUhEO0FBSVpDLG9CQUFRUCxNQUFNTztBQUpGLFdBQWQ7QUFNRDtBQUNGOztBQUVELFVBQUksS0FBS2YsZUFBVCxFQUEwQjtBQUN4QixnQkFBUVEsTUFBTUksSUFBZDtBQUNBLGVBQUssV0FBTDtBQUNFLGdCQUFJSixNQUFNUSxNQUFOLElBQWdCLENBQXBCLEVBQXVCO0FBQ3JCO0FBQ0EsbUJBQUtsQixPQUFMLEdBQWUsSUFBZjtBQUNEO0FBQ0Q7QUFDRixlQUFLLFdBQUw7QUFDRTtBQUNBLGdCQUFJVSxNQUFNUyxLQUFOLEtBQWdCLENBQXBCLEVBQXVCO0FBQ3JCO0FBQ0EsbUJBQUtuQixPQUFMLEdBQWUsS0FBZjtBQUNEO0FBQ0QsZ0JBQUksQ0FBQyxLQUFLQSxPQUFWLEVBQW1CO0FBQ2pCO0FBQ0E7QUFDQSxtQkFBS0YsUUFBTCxDQUFjO0FBQ1pnQixzQkFBTXBCLGVBRE07QUFFWnFCLDBCQUFVTCxLQUZFO0FBR1pNLDZCQUFhLE9BSEQ7QUFJWkMsd0JBQVFQLE1BQU1PO0FBSkYsZUFBZDtBQU1EO0FBQ0Q7QUFDRixlQUFLLFNBQUw7QUFDRSxpQkFBS2pCLE9BQUwsR0FBZSxLQUFmO0FBQ0E7QUFDRjtBQTNCQTtBQTZCRDtBQUVGOzs7OztrQkE5RWtCSixTIiwiZmlsZSI6Im1vdmUtaW5wdXQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgKGMpIDIwMTcgVWJlciBUZWNobm9sb2dpZXMsIEluYy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4vLyBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4vLyBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4vLyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4vLyBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbi8vIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbi8vIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1Jcbi8vIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuLy8gRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4vLyBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4vLyBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuLy8gT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuLy8gVEhFIFNPRlRXQVJFLlxuXG5pbXBvcnQge0lOUFVUX0VWRU5UX1RZUEVTfSBmcm9tICcuLi9jb25zdGFudHMnO1xuXG5jb25zdCB7TU9VU0VfRVZFTlRTfSA9IElOUFVUX0VWRU5UX1RZUEVTO1xuY29uc3QgTU9WRV9FVkVOVF9UWVBFID0gJ3BvaW50ZXJtb3ZlJztcbmNvbnN0IExFQVZFX0VWRU5UX1RZUEUgPSAncG9pbnRlcmxlYXZlJztcblxuLyoqXG4gKiBIYW1tZXIuanMgc3dhbGxvd3MgJ21vdmUnIGV2ZW50cyAoZm9yIHBvaW50ZXIvdG91Y2gvbW91c2UpXG4gKiB3aGVuIHRoZSBwb2ludGVyIGlzIG5vdCBkb3duLiBUaGlzIGNsYXNzIHNldHMgdXAgYSBoYW5kbGVyXG4gKiBzcGVjaWZpY2FsbHkgZm9yIHRoZXNlIGV2ZW50cyB0byB3b3JrIGFyb3VuZCB0aGlzIGxpbWl0YXRpb24uXG4gKiBOb3RlIHRoYXQgdGhpcyBjb3VsZCBiZSBleHRlbmRlZCB0byBtb3JlIGludGVsbGlnZW50bHkgaGFuZGxlXG4gKiBtb3ZlIGV2ZW50cyBhY3Jvc3MgaW5wdXQgdHlwZXMsIGUuZy4gc3RvcmluZyBtdWx0aXBsZSBzaW11bHRhbmVvdXNcbiAqIHBvaW50ZXIvdG91Y2ggZXZlbnRzLCBjYWxjdWxhdGluZyBzcGVlZC9kaXJlY3Rpb24sIGV0Yy5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTW92ZUlucHV0IHtcblxuICBjb25zdHJ1Y3RvcihlbGVtZW50LCBjYWxsYmFjaywgb3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcbiAgICB0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgdGhpcy5wcmVzc2VkID0gZmFsc2U7XG5cbiAgICB0aGlzLm9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtlbmFibGU6IHRydWV9LCBvcHRpb25zKTtcbiAgICB0aGlzLmVuYWJsZU1vdmVFdmVudCA9IHRoaXMub3B0aW9ucy5lbmFibGU7XG4gICAgdGhpcy5lbmFibGVMZWF2ZUV2ZW50ID0gdGhpcy5vcHRpb25zLmVuYWJsZTtcblxuICAgIHRoaXMuZXZlbnRzID0gTU9VU0VfRVZFTlRTLmNvbmNhdChvcHRpb25zLmV2ZW50cyB8fCBbXSk7XG5cbiAgICB0aGlzLmhhbmRsZUV2ZW50ID0gdGhpcy5oYW5kbGVFdmVudC5iaW5kKHRoaXMpO1xuICAgIHRoaXMuZXZlbnRzLmZvckVhY2goZXZlbnQgPT4gZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCB0aGlzLmhhbmRsZUV2ZW50KSk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuZXZlbnRzLmZvckVhY2goZXZlbnQgPT4gdGhpcy5lbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIHRoaXMuaGFuZGxlRXZlbnQpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbmFibGUgdGhpcyBpbnB1dCAoYmVnaW4gcHJvY2Vzc2luZyBldmVudHMpXG4gICAqIGlmIHRoZSBzcGVjaWZpZWQgZXZlbnQgdHlwZSBpcyBhbW9uZyB0aG9zZSBoYW5kbGVkIGJ5IHRoaXMgaW5wdXQuXG4gICAqL1xuICBlbmFibGVFdmVudFR5cGUoZXZlbnRUeXBlLCBlbmFibGVkKSB7XG4gICAgaWYgKGV2ZW50VHlwZSA9PT0gTU9WRV9FVkVOVF9UWVBFKSB7XG4gICAgICB0aGlzLmVuYWJsZU1vdmVFdmVudCA9IGVuYWJsZWQ7XG4gICAgfVxuICAgIGlmIChldmVudFR5cGUgPT09IExFQVZFX0VWRU5UX1RZUEUpIHtcbiAgICAgIHRoaXMuZW5hYmxlTGVhdmVFdmVudCA9IGVuYWJsZWQ7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlRXZlbnQoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5lbmFibGVMZWF2ZUV2ZW50KSB7XG4gICAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ21vdXNlbGVhdmUnKSB7XG4gICAgICAgIHRoaXMuY2FsbGJhY2soe1xuICAgICAgICAgIHR5cGU6IExFQVZFX0VWRU5UX1RZUEUsXG4gICAgICAgICAgc3JjRXZlbnQ6IGV2ZW50LFxuICAgICAgICAgIHBvaW50ZXJUeXBlOiAnbW91c2UnLFxuICAgICAgICAgIHRhcmdldDogZXZlbnQudGFyZ2V0XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmVuYWJsZU1vdmVFdmVudCkge1xuICAgICAgc3dpdGNoIChldmVudC50eXBlKSB7XG4gICAgICBjYXNlICdtb3VzZWRvd24nOlxuICAgICAgICBpZiAoZXZlbnQuYnV0dG9uID49IDApIHtcbiAgICAgICAgICAvLyBCdXR0b24gaXMgZG93blxuICAgICAgICAgIHRoaXMucHJlc3NlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdtb3VzZW1vdmUnOlxuICAgICAgICAvLyBNb3ZlIGV2ZW50cyB1c2UgYHdoaWNoYCB0byB0cmFjayB0aGUgYnV0dG9uIGJlaW5nIHByZXNzZWRcbiAgICAgICAgaWYgKGV2ZW50LndoaWNoID09PSAwKSB7XG4gICAgICAgICAgLy8gQnV0dG9uIGlzIG5vdCBkb3duXG4gICAgICAgICAgdGhpcy5wcmVzc2VkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLnByZXNzZWQpIHtcbiAgICAgICAgICAvLyBEcmFnIGV2ZW50cyBhcmUgZW1pdHRlZCBieSBoYW1tZXIgYWxyZWFkeVxuICAgICAgICAgIC8vIHdlIGp1c3QgbmVlZCB0byBlbWl0IHRoZSBtb3ZlIGV2ZW50IG9uIGhvdmVyXG4gICAgICAgICAgdGhpcy5jYWxsYmFjayh7XG4gICAgICAgICAgICB0eXBlOiBNT1ZFX0VWRU5UX1RZUEUsXG4gICAgICAgICAgICBzcmNFdmVudDogZXZlbnQsXG4gICAgICAgICAgICBwb2ludGVyVHlwZTogJ21vdXNlJyxcbiAgICAgICAgICAgIHRhcmdldDogZXZlbnQudGFyZ2V0XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdtb3VzZXVwJzpcbiAgICAgICAgdGhpcy5wcmVzc2VkID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgIH1cbiAgICB9XG5cbiAgfVxufVxuIl19