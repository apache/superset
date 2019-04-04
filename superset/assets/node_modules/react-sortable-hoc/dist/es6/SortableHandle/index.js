import _extends from 'babel-runtime/helpers/extends';
import _Object$getPrototypeOf from 'babel-runtime/core-js/object/get-prototype-of';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _createClass from 'babel-runtime/helpers/createClass';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import invariant from 'invariant';

import { provideDisplayName } from '../utils';

// Export Higher Order Sortable Element Component
export default function sortableHandle(WrappedComponent) {
  var _class, _temp;

  var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { withRef: false };

  return _temp = _class = function (_Component) {
    _inherits(_class, _Component);

    function _class() {
      _classCallCheck(this, _class);

      return _possibleConstructorReturn(this, (_class.__proto__ || _Object$getPrototypeOf(_class)).apply(this, arguments));
    }

    _createClass(_class, [{
      key: 'componentDidMount',
      value: function componentDidMount() {
        var node = findDOMNode(this);
        node.sortableHandle = true;
      }
    }, {
      key: 'getWrappedInstance',
      value: function getWrappedInstance() {
        invariant(config.withRef, 'To access the wrapped instance, you need to pass in {withRef: true} as the second argument of the SortableHandle() call');
        return this.refs.wrappedInstance;
      }
    }, {
      key: 'render',
      value: function render() {
        var ref = config.withRef ? 'wrappedInstance' : null;

        return React.createElement(WrappedComponent, _extends({ ref: ref }, this.props));
      }
    }]);

    return _class;
  }(Component), _class.displayName = provideDisplayName('sortableHandle', WrappedComponent), _temp;
}