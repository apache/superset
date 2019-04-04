import _extends from 'babel-runtime/helpers/extends';
import _slicedToArray from 'babel-runtime/helpers/slicedToArray';
import _Promise from 'babel-runtime/core-js/promise';
import _toConsumableArray from 'babel-runtime/helpers/toConsumableArray';
import _Object$getPrototypeOf from 'babel-runtime/core-js/object/get-prototype-of';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _createClass from 'babel-runtime/helpers/createClass';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { findDOMNode } from 'react-dom';
import invariant from 'invariant';

import Manager from '../Manager';
import { closest, events, vendorPrefix, limit, getEdgeOffset, getElementMargin, getLockPixelOffset, getPosition, isTouchEvent, provideDisplayName, omit } from '../utils';

// Export Higher Order Sortable Container Component
export default function sortableContainer(WrappedComponent) {
  var _class, _temp;

  var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { withRef: false };

  return _temp = _class = function (_Component) {
    _inherits(_class, _Component);

    function _class(props) {
      _classCallCheck(this, _class);

      var _this = _possibleConstructorReturn(this, (_class.__proto__ || _Object$getPrototypeOf(_class)).call(this, props));

      _this.handleStart = function (event) {
        var _this$props = _this.props,
            distance = _this$props.distance,
            shouldCancelStart = _this$props.shouldCancelStart;


        if (event.button === 2 || shouldCancelStart(event)) {
          return false;
        }

        _this._touched = true;
        _this._pos = getPosition(event);

        var node = closest(event.target, function (el) {
          return el.sortableInfo != null;
        });

        if (node && node.sortableInfo && _this.nodeIsChild(node) && !_this.state.sorting) {
          var useDragHandle = _this.props.useDragHandle;
          var _node$sortableInfo = node.sortableInfo,
              index = _node$sortableInfo.index,
              collection = _node$sortableInfo.collection;


          if (useDragHandle && !closest(event.target, function (el) {
            return el.sortableHandle != null;
          })) return;

          _this.manager.active = { index: index, collection: collection };

          /*
          * Fixes a bug in Firefox where the :active state of anchor tags
          * prevent subsequent 'mousemove' events from being fired
          * (see https://github.com/clauderic/react-sortable-hoc/issues/118)
          */
          if (!isTouchEvent(event) && event.target.tagName.toLowerCase() === 'a') {
            event.preventDefault();
          }

          if (!distance) {
            if (_this.props.pressDelay === 0) {
              _this.handlePress(event);
            } else {
              _this.pressTimer = setTimeout(function () {
                return _this.handlePress(event);
              }, _this.props.pressDelay);
            }
          }
        }
      };

      _this.nodeIsChild = function (node) {
        return node.sortableInfo.manager === _this.manager;
      };

      _this.handleMove = function (event) {
        var _this$props2 = _this.props,
            distance = _this$props2.distance,
            pressThreshold = _this$props2.pressThreshold;


        if (!_this.state.sorting && _this._touched) {
          var position = getPosition(event);
          var delta = _this._delta = {
            x: _this._pos.x - position.x,
            y: _this._pos.y - position.y
          };
          var combinedDelta = Math.abs(delta.x) + Math.abs(delta.y);

          if (!distance && (!pressThreshold || pressThreshold && combinedDelta >= pressThreshold)) {
            clearTimeout(_this.cancelTimer);
            _this.cancelTimer = setTimeout(_this.cancel, 0);
          } else if (distance && combinedDelta >= distance && _this.manager.isActive()) {
            _this.handlePress(event);
          }
        }
      };

      _this.handleEnd = function () {
        _this._touched = false;
        _this.cancel();
      };

      _this.cancel = function () {
        var distance = _this.props.distance;
        var sorting = _this.state.sorting;


        if (!sorting) {
          if (!distance) {
            clearTimeout(_this.pressTimer);
          }
          _this.manager.active = null;
        }
      };

      _this.handlePress = function (event) {
        var active = _this.manager.getActive();

        if (active) {
          var _this$props3 = _this.props,
              axis = _this$props3.axis,
              getHelperDimensions = _this$props3.getHelperDimensions,
              helperClass = _this$props3.helperClass,
              hideSortableGhost = _this$props3.hideSortableGhost,
              onSortStart = _this$props3.onSortStart,
              useWindowAsScrollContainer = _this$props3.useWindowAsScrollContainer;
          var node = active.node,
              collection = active.collection;
          var index = node.sortableInfo.index;

          var margin = getElementMargin(node);

          var containerBoundingRect = _this.container.getBoundingClientRect();
          var dimensions = getHelperDimensions({ index: index, node: node, collection: collection });

          _this.node = node;
          _this.margin = margin;
          _this.width = dimensions.width;
          _this.height = dimensions.height;
          _this.marginOffset = {
            x: _this.margin.left + _this.margin.right,
            y: Math.max(_this.margin.top, _this.margin.bottom)
          };
          _this.boundingClientRect = node.getBoundingClientRect();
          _this.containerBoundingRect = containerBoundingRect;
          _this.index = index;
          _this.newIndex = index;

          _this.axis = {
            x: axis.indexOf('x') >= 0,
            y: axis.indexOf('y') >= 0
          };
          _this.offsetEdge = getEdgeOffset(node, _this.container);
          _this.initialOffset = getPosition(event);
          _this.initialScroll = {
            top: _this.container.scrollTop,
            left: _this.container.scrollLeft
          };

          _this.initialWindowScroll = {
            top: window.pageYOffset,
            left: window.pageXOffset
          };

          var fields = node.querySelectorAll('input, textarea, select');
          var clonedNode = node.cloneNode(true);
          var clonedFields = [].concat(_toConsumableArray(clonedNode.querySelectorAll('input, textarea, select'))); // Convert NodeList to Array

          clonedFields.forEach(function (field, index) {
            if (field.type !== 'file' && fields[index]) {
              field.value = fields[index].value;
            }
          });

          _this.helper = _this.document.body.appendChild(clonedNode);

          _this.helper.style.position = 'fixed';
          _this.helper.style.top = _this.boundingClientRect.top - margin.top + 'px';
          _this.helper.style.left = _this.boundingClientRect.left - margin.left + 'px';
          _this.helper.style.width = _this.width + 'px';
          _this.helper.style.height = _this.height + 'px';
          _this.helper.style.boxSizing = 'border-box';
          _this.helper.style.pointerEvents = 'none';

          if (hideSortableGhost) {
            _this.sortableGhost = node;
            node.style.visibility = 'hidden';
            node.style.opacity = 0;
          }

          _this.minTranslate = {};
          _this.maxTranslate = {};
          if (_this.axis.x) {
            _this.minTranslate.x = (useWindowAsScrollContainer ? 0 : containerBoundingRect.left) - _this.boundingClientRect.left - _this.width / 2;
            _this.maxTranslate.x = (useWindowAsScrollContainer ? _this.contentWindow.innerWidth : containerBoundingRect.left + containerBoundingRect.width) - _this.boundingClientRect.left - _this.width / 2;
          }
          if (_this.axis.y) {
            _this.minTranslate.y = (useWindowAsScrollContainer ? 0 : containerBoundingRect.top) - _this.boundingClientRect.top - _this.height / 2;
            _this.maxTranslate.y = (useWindowAsScrollContainer ? _this.contentWindow.innerHeight : containerBoundingRect.top + containerBoundingRect.height) - _this.boundingClientRect.top - _this.height / 2;
          }

          if (helperClass) {
            var _this$helper$classLis;

            (_this$helper$classLis = _this.helper.classList).add.apply(_this$helper$classLis, _toConsumableArray(helperClass.split(' ')));
          }

          _this.listenerNode = event.touches ? node : _this.contentWindow;
          events.move.forEach(function (eventName) {
            return _this.listenerNode.addEventListener(eventName, _this.handleSortMove, false);
          });
          events.end.forEach(function (eventName) {
            return _this.listenerNode.addEventListener(eventName, _this.handleSortEnd, false);
          });

          _this.setState({
            sorting: true,
            sortingIndex: index
          });

          if (onSortStart) {
            onSortStart({ node: node, index: index, collection: collection }, event);
          }
        }
      };

      _this.handleSortMove = function (event) {
        var onSortMove = _this.props.onSortMove;

        event.preventDefault(); // Prevent scrolling on mobile

        _this.updatePosition(event);
        _this.animateNodes();
        _this.autoscroll();

        if (onSortMove) {
          onSortMove(event);
        }
      };

      _this.handleSortEnd = function (event) {
        var _this$props4 = _this.props,
            hideSortableGhost = _this$props4.hideSortableGhost,
            onSortEnd = _this$props4.onSortEnd;
        var collection = _this.manager.active.collection;

        // Remove the event listeners if the node is still in the DOM

        if (_this.listenerNode) {
          events.move.forEach(function (eventName) {
            return _this.listenerNode.removeEventListener(eventName, _this.handleSortMove);
          });
          events.end.forEach(function (eventName) {
            return _this.listenerNode.removeEventListener(eventName, _this.handleSortEnd);
          });
        }

        // Remove the helper from the DOM
        _this.helper.parentNode.removeChild(_this.helper);

        if (hideSortableGhost && _this.sortableGhost) {
          _this.sortableGhost.style.visibility = '';
          _this.sortableGhost.style.opacity = '';
        }

        var nodes = _this.manager.refs[collection];
        for (var i = 0, len = nodes.length; i < len; i++) {
          var node = nodes[i];
          var el = node.node;

          // Clear the cached offsetTop / offsetLeft value
          node.edgeOffset = null;

          // Remove the transforms / transitions
          el.style[vendorPrefix + 'Transform'] = '';
          el.style[vendorPrefix + 'TransitionDuration'] = '';
        }

        // Stop autoscroll
        clearInterval(_this.autoscrollInterval);
        _this.autoscrollInterval = null;

        // Update state
        _this.manager.active = null;

        _this.setState({
          sorting: false,
          sortingIndex: null
        });

        if (typeof onSortEnd === 'function') {
          onSortEnd({
            oldIndex: _this.index,
            newIndex: _this.newIndex,
            collection: collection
          }, event);
        }

        _this._touched = false;
      };

      _this.autoscroll = function () {
        var translate = _this.translate;
        var direction = {
          x: 0,
          y: 0
        };
        var speed = {
          x: 1,
          y: 1
        };
        var acceleration = {
          x: 10,
          y: 10
        };

        if (translate.y >= _this.maxTranslate.y - _this.height / 2) {
          direction.y = 1; // Scroll Down
          speed.y = acceleration.y * Math.abs((_this.maxTranslate.y - _this.height / 2 - translate.y) / _this.height);
        } else if (translate.x >= _this.maxTranslate.x - _this.width / 2) {
          direction.x = 1; // Scroll Right
          speed.x = acceleration.x * Math.abs((_this.maxTranslate.x - _this.width / 2 - translate.x) / _this.width);
        } else if (translate.y <= _this.minTranslate.y + _this.height / 2) {
          direction.y = -1; // Scroll Up
          speed.y = acceleration.y * Math.abs((translate.y - _this.height / 2 - _this.minTranslate.y) / _this.height);
        } else if (translate.x <= _this.minTranslate.x + _this.width / 2) {
          direction.x = -1; // Scroll Left
          speed.x = acceleration.x * Math.abs((translate.x - _this.width / 2 - _this.minTranslate.x) / _this.width);
        }

        if (_this.autoscrollInterval) {
          clearInterval(_this.autoscrollInterval);
          _this.autoscrollInterval = null;
          _this.isAutoScrolling = false;
        }

        if (direction.x !== 0 || direction.y !== 0) {
          _this.autoscrollInterval = setInterval(function () {
            _this.isAutoScrolling = true;
            var offset = {
              left: 1 * speed.x * direction.x,
              top: 1 * speed.y * direction.y
            };
            _this.scrollContainer.scrollTop += offset.top;
            _this.scrollContainer.scrollLeft += offset.left;
            _this.translate.x += offset.left;
            _this.translate.y += offset.top;
            _this.animateNodes();
          }, 5);
        }
      };

      _this.manager = new Manager();
      _this.events = {
        start: _this.handleStart,
        move: _this.handleMove,
        end: _this.handleEnd
      };

      invariant(!(props.distance && props.pressDelay), 'Attempted to set both `pressDelay` and `distance` on SortableContainer, you may only use one or the other, not both at the same time.');

      _this.state = {};
      return _this;
    }

    _createClass(_class, [{
      key: 'getChildContext',
      value: function getChildContext() {
        return {
          manager: this.manager
        };
      }
    }, {
      key: 'componentDidMount',
      value: function componentDidMount() {
        var _this2 = this;

        var useWindowAsScrollContainer = this.props.useWindowAsScrollContainer;

        /*
         *  Set our own default rather than using defaultProps because Jest
         *  snapshots will serialize window, causing a RangeError
         *  https://github.com/clauderic/react-sortable-hoc/issues/249
         */

        var container = this.getContainer();

        _Promise.resolve(container).then(function (containerNode) {
          _this2.container = containerNode;
          _this2.document = _this2.container.ownerDocument || document;

          var contentWindow = _this2.props.contentWindow || _this2.document.defaultView || window;

          _this2.contentWindow = typeof contentWindow === 'function' ? contentWindow() : contentWindow;
          _this2.scrollContainer = useWindowAsScrollContainer ? _this2.document.scrollingElement || _this2.document.documentElement : _this2.container;

          var _loop = function _loop(key) {
            if (_this2.events.hasOwnProperty(key)) {
              events[key].forEach(function (eventName) {
                return _this2.container.addEventListener(eventName, _this2.events[key], false);
              });
            }
          };

          for (var key in _this2.events) {
            _loop(key);
          }
        });
      }
    }, {
      key: 'componentWillUnmount',
      value: function componentWillUnmount() {
        var _this3 = this;

        if (this.container) {
          var _loop2 = function _loop2(key) {
            if (_this3.events.hasOwnProperty(key)) {
              events[key].forEach(function (eventName) {
                return _this3.container.removeEventListener(eventName, _this3.events[key]);
              });
            }
          };

          for (var key in this.events) {
            _loop2(key);
          }
        }
      }
    }, {
      key: 'getLockPixelOffsets',
      value: function getLockPixelOffsets() {
        var width = this.width,
            height = this.height;
        var lockOffset = this.props.lockOffset;

        var offsets = Array.isArray(lockOffset) ? lockOffset : [lockOffset, lockOffset];

        invariant(offsets.length === 2, 'lockOffset prop of SortableContainer should be a single ' + 'value or an array of exactly two values. Given %s', lockOffset);

        var _offsets = _slicedToArray(offsets, 2),
            minLockOffset = _offsets[0],
            maxLockOffset = _offsets[1];

        return [getLockPixelOffset({ lockOffset: minLockOffset, width: width, height: height }), getLockPixelOffset({ lockOffset: maxLockOffset, width: width, height: height })];
      }
    }, {
      key: 'updatePosition',
      value: function updatePosition(event) {
        var _props = this.props,
            lockAxis = _props.lockAxis,
            lockToContainerEdges = _props.lockToContainerEdges;


        var offset = getPosition(event);
        var translate = {
          x: offset.x - this.initialOffset.x,
          y: offset.y - this.initialOffset.y
        };

        // Adjust for window scroll
        translate.y -= window.pageYOffset - this.initialWindowScroll.top;
        translate.x -= window.pageXOffset - this.initialWindowScroll.left;

        this.translate = translate;

        if (lockToContainerEdges) {
          var _getLockPixelOffsets = this.getLockPixelOffsets(),
              _getLockPixelOffsets2 = _slicedToArray(_getLockPixelOffsets, 2),
              minLockOffset = _getLockPixelOffsets2[0],
              maxLockOffset = _getLockPixelOffsets2[1];

          var minOffset = {
            x: this.width / 2 - minLockOffset.x,
            y: this.height / 2 - minLockOffset.y
          };
          var maxOffset = {
            x: this.width / 2 - maxLockOffset.x,
            y: this.height / 2 - maxLockOffset.y
          };

          translate.x = limit(this.minTranslate.x + minOffset.x, this.maxTranslate.x - maxOffset.x, translate.x);
          translate.y = limit(this.minTranslate.y + minOffset.y, this.maxTranslate.y - maxOffset.y, translate.y);
        }

        if (lockAxis === 'x') {
          translate.y = 0;
        } else if (lockAxis === 'y') {
          translate.x = 0;
        }

        this.helper.style[vendorPrefix + 'Transform'] = 'translate3d(' + translate.x + 'px,' + translate.y + 'px, 0)';
      }
    }, {
      key: 'animateNodes',
      value: function animateNodes() {
        var _props2 = this.props,
            transitionDuration = _props2.transitionDuration,
            hideSortableGhost = _props2.hideSortableGhost,
            onSortOver = _props2.onSortOver;

        var nodes = this.manager.getOrderedRefs();
        var containerScrollDelta = {
          left: this.container.scrollLeft - this.initialScroll.left,
          top: this.container.scrollTop - this.initialScroll.top
        };
        var sortingOffset = {
          left: this.offsetEdge.left + this.translate.x + containerScrollDelta.left,
          top: this.offsetEdge.top + this.translate.y + containerScrollDelta.top
        };
        var windowScrollDelta = {
          top: window.pageYOffset - this.initialWindowScroll.top,
          left: window.pageXOffset - this.initialWindowScroll.left
        };
        var prevIndex = this.newIndex;
        this.newIndex = null;

        for (var i = 0, len = nodes.length; i < len; i++) {
          var node = nodes[i].node;

          var index = node.sortableInfo.index;
          var width = node.offsetWidth;
          var height = node.offsetHeight;
          var offset = {
            width: this.width > width ? width / 2 : this.width / 2,
            height: this.height > height ? height / 2 : this.height / 2
          };

          var translate = {
            x: 0,
            y: 0
          };
          var edgeOffset = nodes[i].edgeOffset;

          // If we haven't cached the node's offsetTop / offsetLeft value

          if (!edgeOffset) {
            nodes[i].edgeOffset = edgeOffset = getEdgeOffset(node, this.container);
          }

          // Get a reference to the next and previous node
          var nextNode = i < nodes.length - 1 && nodes[i + 1];
          var prevNode = i > 0 && nodes[i - 1];

          // Also cache the next node's edge offset if needed.
          // We need this for calculating the animation in a grid setup
          if (nextNode && !nextNode.edgeOffset) {
            nextNode.edgeOffset = getEdgeOffset(nextNode.node, this.container);
          }

          // If the node is the one we're currently animating, skip it
          if (index === this.index) {
            if (hideSortableGhost) {
              /*
              * With windowing libraries such as `react-virtualized`, the sortableGhost
              * node may change while scrolling down and then back up (or vice-versa),
              * so we need to update the reference to the new node just to be safe.
              */
              this.sortableGhost = node;
              node.style.visibility = 'hidden';
              node.style.opacity = 0;
            }
            continue;
          }

          if (transitionDuration) {
            node.style[vendorPrefix + 'TransitionDuration'] = transitionDuration + 'ms';
          }

          if (this.axis.x) {
            if (this.axis.y) {
              // Calculations for a grid setup
              if (index < this.index && (sortingOffset.left + windowScrollDelta.left - offset.width <= edgeOffset.left && sortingOffset.top + windowScrollDelta.top <= edgeOffset.top + offset.height || sortingOffset.top + windowScrollDelta.top + offset.height <= edgeOffset.top)) {
                // If the current node is to the left on the same row, or above the node that's being dragged
                // then move it to the right
                translate.x = this.width + this.marginOffset.x;
                if (edgeOffset.left + translate.x > this.containerBoundingRect.width - offset.width) {
                  // If it moves passed the right bounds, then animate it to the first position of the next row.
                  // We just use the offset of the next node to calculate where to move, because that node's original position
                  // is exactly where we want to go
                  translate.x = nextNode.edgeOffset.left - edgeOffset.left;
                  translate.y = nextNode.edgeOffset.top - edgeOffset.top;
                }
                if (this.newIndex === null) {
                  this.newIndex = index;
                }
              } else if (index > this.index && (sortingOffset.left + windowScrollDelta.left + offset.width >= edgeOffset.left && sortingOffset.top + windowScrollDelta.top + offset.height >= edgeOffset.top || sortingOffset.top + windowScrollDelta.top + offset.height >= edgeOffset.top + height)) {
                // If the current node is to the right on the same row, or below the node that's being dragged
                // then move it to the left
                translate.x = -(this.width + this.marginOffset.x);
                if (edgeOffset.left + translate.x < this.containerBoundingRect.left + offset.width) {
                  // If it moves passed the left bounds, then animate it to the last position of the previous row.
                  // We just use the offset of the previous node to calculate where to move, because that node's original position
                  // is exactly where we want to go
                  translate.x = prevNode.edgeOffset.left - edgeOffset.left;
                  translate.y = prevNode.edgeOffset.top - edgeOffset.top;
                }
                this.newIndex = index;
              }
            } else {
              if (index > this.index && sortingOffset.left + windowScrollDelta.left + offset.width >= edgeOffset.left) {
                translate.x = -(this.width + this.marginOffset.x);
                this.newIndex = index;
              } else if (index < this.index && sortingOffset.left + windowScrollDelta.left <= edgeOffset.left + offset.width) {
                translate.x = this.width + this.marginOffset.x;
                if (this.newIndex == null) {
                  this.newIndex = index;
                }
              }
            }
          } else if (this.axis.y) {
            if (index > this.index && sortingOffset.top + windowScrollDelta.top + offset.height >= edgeOffset.top) {
              translate.y = -(this.height + this.marginOffset.y);
              this.newIndex = index;
            } else if (index < this.index && sortingOffset.top + windowScrollDelta.top <= edgeOffset.top + offset.height) {
              translate.y = this.height + this.marginOffset.y;
              if (this.newIndex == null) {
                this.newIndex = index;
              }
            }
          }
          node.style[vendorPrefix + 'Transform'] = 'translate3d(' + translate.x + 'px,' + translate.y + 'px,0)';
        }

        if (this.newIndex == null) {
          this.newIndex = this.index;
        }

        if (onSortOver && this.newIndex !== prevIndex) {
          onSortOver({
            newIndex: this.newIndex,
            oldIndex: prevIndex,
            index: this.index,
            collection: this.manager.active.collection
          });
        }
      }
    }, {
      key: 'getWrappedInstance',
      value: function getWrappedInstance() {
        invariant(config.withRef, 'To access the wrapped instance, you need to pass in {withRef: true} as the second argument of the SortableContainer() call');

        return this.refs.wrappedInstance;
      }
    }, {
      key: 'getContainer',
      value: function getContainer() {
        var getContainer = this.props.getContainer;


        if (typeof getContainer !== 'function') {
          return findDOMNode(this);
        }

        return getContainer(config.withRef ? this.getWrappedInstance() : undefined);
      }
    }, {
      key: 'render',
      value: function render() {
        var ref = config.withRef ? 'wrappedInstance' : null;

        return React.createElement(WrappedComponent, _extends({
          ref: ref
        }, omit(this.props, 'contentWindow', 'useWindowAsScrollContainer', 'distance', 'helperClass', 'hideSortableGhost', 'transitionDuration', 'useDragHandle', 'pressDelay', 'pressThreshold', 'shouldCancelStart', 'onSortStart', 'onSortMove', 'onSortEnd', 'axis', 'lockAxis', 'lockOffset', 'lockToContainerEdges', 'getContainer', 'getHelperDimensions')));
      }
    }]);

    return _class;
  }(Component), _class.displayName = provideDisplayName('sortableList', WrappedComponent), _class.defaultProps = {
    axis: 'y',
    transitionDuration: 300,
    pressDelay: 0,
    pressThreshold: 5,
    distance: 0,
    useWindowAsScrollContainer: false,
    hideSortableGhost: true,
    shouldCancelStart: function shouldCancelStart(e) {
      // Cancel sorting if the event target is an `input`, `textarea`, `select` or `option`
      var disabledElements = ['input', 'textarea', 'select', 'option', 'button'];

      if (disabledElements.indexOf(e.target.tagName.toLowerCase()) !== -1) {
        return true; // Return true to cancel sorting
      }
    },
    lockToContainerEdges: false,
    lockOffset: '50%',
    getHelperDimensions: function getHelperDimensions(_ref) {
      var node = _ref.node;
      return {
        width: node.offsetWidth,
        height: node.offsetHeight
      };
    }
  }, _class.propTypes = {
    axis: PropTypes.oneOf(['x', 'y', 'xy']),
    distance: PropTypes.number,
    lockAxis: PropTypes.string,
    helperClass: PropTypes.string,
    transitionDuration: PropTypes.number,
    contentWindow: PropTypes.any,
    onSortStart: PropTypes.func,
    onSortMove: PropTypes.func,
    onSortOver: PropTypes.func,
    onSortEnd: PropTypes.func,
    shouldCancelStart: PropTypes.func,
    pressDelay: PropTypes.number,
    useDragHandle: PropTypes.bool,
    useWindowAsScrollContainer: PropTypes.bool,
    hideSortableGhost: PropTypes.bool,
    lockToContainerEdges: PropTypes.bool,
    lockOffset: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string]))]),
    getContainer: PropTypes.func,
    getHelperDimensions: PropTypes.func
  }, _class.childContextTypes = {
    manager: PropTypes.object.isRequired
  }, _temp;
}