'use strict';

exports.__esModule = true;

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _JSONArrow = require('./JSONArrow');

var _JSONArrow2 = _interopRequireDefault(_JSONArrow);

var _getCollectionEntries = require('./getCollectionEntries');

var _getCollectionEntries2 = _interopRequireDefault(_getCollectionEntries);

var _JSONNode = require('./JSONNode');

var _JSONNode2 = _interopRequireDefault(_JSONNode);

var _ItemRange = require('./ItemRange');

var _ItemRange2 = _interopRequireDefault(_ItemRange);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/**
 * Renders nested values (eg. objects, arrays, lists, etc.)
 */

function renderChildNodes(props, from, to) {
  var nodeType = props.nodeType,
      data = props.data,
      collectionLimit = props.collectionLimit,
      circularCache = props.circularCache,
      keyPath = props.keyPath,
      postprocessValue = props.postprocessValue,
      sortObjectKeys = props.sortObjectKeys;

  var childNodes = [];

  (0, _getCollectionEntries2['default'])(nodeType, data, sortObjectKeys, collectionLimit, from, to).forEach(function (entry) {
    if (entry.to) {
      childNodes.push(_react2['default'].createElement(_ItemRange2['default'], (0, _extends3['default'])({}, props, {
        key: 'ItemRange--' + entry.from + '-' + entry.to,
        from: entry.from,
        to: entry.to,
        renderChildNodes: renderChildNodes
      })));
    } else {
      var key = entry.key,
          value = entry.value;

      var isCircular = circularCache.indexOf(value) !== -1;

      var node = _react2['default'].createElement(_JSONNode2['default'], (0, _extends3['default'])({}, props, { postprocessValue: postprocessValue, collectionLimit: collectionLimit }, {
        key: 'Node--' + key,
        keyPath: [key].concat(keyPath),
        value: postprocessValue(value),
        circularCache: [].concat(circularCache, [value]),
        isCircular: isCircular,
        hideRoot: false
      }));

      if (node !== false) {
        childNodes.push(node);
      }
    }
  });

  return childNodes;
}

function getStateFromProps(props) {
  // calculate individual node expansion if necessary
  var expanded = props.shouldExpandNode && !props.isCircular ? props.shouldExpandNode(props.keyPath, props.data, props.level) : false;
  return {
    expanded: expanded
  };
}

var JSONNestedNode = function (_React$Component) {
  (0, _inherits3['default'])(JSONNestedNode, _React$Component);

  function JSONNestedNode(props) {
    (0, _classCallCheck3['default'])(this, JSONNestedNode);

    var _this = (0, _possibleConstructorReturn3['default'])(this, _React$Component.call(this, props));

    _this.handleClick = function () {
      if (_this.props.expandable) {
        _this.setState({ expanded: !_this.state.expanded });
      }
    };

    _this.state = getStateFromProps(props);
    return _this;
  }

  JSONNestedNode.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
    var nextState = getStateFromProps(nextProps);
    if (getStateFromProps(this.props).expanded !== nextState.expanded) {
      this.setState(nextState);
    }
  };

  JSONNestedNode.prototype.shouldComponentUpdate = function shouldComponentUpdate(nextProps, nextState) {
    var _this2 = this;

    return !!(0, _keys2['default'])(nextProps).find(function (key) {
      return key !== 'circularCache' && (key === 'keyPath' ? nextProps[key].join('/') !== _this2.props[key].join('/') : nextProps[key] !== _this2.props[key]);
    }) || nextState.expanded !== this.state.expanded;
  };

  JSONNestedNode.prototype.render = function render() {
    var _props = this.props,
        getItemString = _props.getItemString,
        nodeTypeIndicator = _props.nodeTypeIndicator,
        nodeType = _props.nodeType,
        data = _props.data,
        hideRoot = _props.hideRoot,
        createItemString = _props.createItemString,
        styling = _props.styling,
        collectionLimit = _props.collectionLimit,
        keyPath = _props.keyPath,
        labelRenderer = _props.labelRenderer,
        expandable = _props.expandable;
    var expanded = this.state.expanded;

    var renderedChildren = expanded || hideRoot && this.props.level === 0 ? renderChildNodes((0, _extends3['default'])({}, this.props, { level: this.props.level + 1 })) : null;

    var itemType = _react2['default'].createElement(
      'span',
      styling('nestedNodeItemType', expanded),
      nodeTypeIndicator
    );
    var renderedItemString = getItemString(nodeType, data, itemType, createItemString(data, collectionLimit));
    var stylingArgs = [keyPath, nodeType, expanded, expandable];

    return hideRoot ? _react2['default'].createElement(
      'li',
      styling.apply(undefined, ['rootNode'].concat(stylingArgs)),
      _react2['default'].createElement(
        'ul',
        styling.apply(undefined, ['rootNodeChildren'].concat(stylingArgs)),
        renderedChildren
      )
    ) : _react2['default'].createElement(
      'li',
      styling.apply(undefined, ['nestedNode'].concat(stylingArgs)),
      expandable && _react2['default'].createElement(_JSONArrow2['default'], {
        styling: styling,
        nodeType: nodeType,
        expanded: expanded,
        onClick: this.handleClick
      }),
      _react2['default'].createElement(
        'label',
        (0, _extends3['default'])({}, styling.apply(undefined, [['label', 'nestedNodeLabel']].concat(stylingArgs)), {
          onClick: this.handleClick
        }),
        labelRenderer.apply(undefined, stylingArgs)
      ),
      _react2['default'].createElement(
        'span',
        (0, _extends3['default'])({}, styling.apply(undefined, ['nestedNodeItemString'].concat(stylingArgs)), {
          onClick: this.handleClick
        }),
        renderedItemString
      ),
      _react2['default'].createElement(
        'ul',
        styling.apply(undefined, ['nestedNodeChildren'].concat(stylingArgs)),
        renderedChildren
      )
    );
  };

  return JSONNestedNode;
}(_react2['default'].Component);

JSONNestedNode.propTypes = {
  getItemString: _propTypes2['default'].func.isRequired,
  nodeTypeIndicator: _propTypes2['default'].any,
  nodeType: _propTypes2['default'].string.isRequired,
  data: _propTypes2['default'].any,
  hideRoot: _propTypes2['default'].bool.isRequired,
  createItemString: _propTypes2['default'].func.isRequired,
  styling: _propTypes2['default'].func.isRequired,
  collectionLimit: _propTypes2['default'].number,
  keyPath: _propTypes2['default'].arrayOf(_propTypes2['default'].oneOfType([_propTypes2['default'].string, _propTypes2['default'].number])).isRequired,
  labelRenderer: _propTypes2['default'].func.isRequired,
  shouldExpandNode: _propTypes2['default'].func,
  level: _propTypes2['default'].number.isRequired,
  sortObjectKeys: _propTypes2['default'].oneOfType([_propTypes2['default'].func, _propTypes2['default'].bool]),
  isCircular: _propTypes2['default'].bool,
  expandable: _propTypes2['default'].bool
};
JSONNestedNode.defaultProps = {
  data: [],
  circularCache: [],
  level: 0,
  expandable: true
};
exports['default'] = JSONNestedNode;