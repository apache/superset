'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Raised = undefined;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _reactcss = require('reactcss');

var _reactcss2 = _interopRequireDefault(_reactcss);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Raised = exports.Raised = function Raised(_ref) {
  var zDepth = _ref.zDepth,
      radius = _ref.radius,
      background = _ref.background,
      children = _ref.children;

  var styles = (0, _reactcss2.default)({
    'default': {
      wrap: {
        position: 'relative',
        display: 'inline-block'
      },
      content: {
        position: 'relative'
      },
      bg: {
        absolute: '0px 0px 0px 0px',
        boxShadow: '0 ' + zDepth + 'px ' + zDepth * 4 + 'px rgba(0,0,0,.24)',
        borderRadius: radius,
        background: background
      }
    },
    'zDepth-0': {
      bg: {
        boxShadow: 'none'
      }
    },

    'zDepth-1': {
      bg: {
        boxShadow: '0 2px 10px rgba(0,0,0,.12), 0 2px 5px rgba(0,0,0,.16)'
      }
    },
    'zDepth-2': {
      bg: {
        boxShadow: '0 6px 20px rgba(0,0,0,.19), 0 8px 17px rgba(0,0,0,.2)'
      }
    },
    'zDepth-3': {
      bg: {
        boxShadow: '0 17px 50px rgba(0,0,0,.19), 0 12px 15px rgba(0,0,0,.24)'
      }
    },
    'zDepth-4': {
      bg: {
        boxShadow: '0 25px 55px rgba(0,0,0,.21), 0 16px 28px rgba(0,0,0,.22)'
      }
    },
    'zDepth-5': {
      bg: {
        boxShadow: '0 40px 77px rgba(0,0,0,.22), 0 27px 24px rgba(0,0,0,.2)'
      }
    },
    'square': {
      bg: {
        borderRadius: '0'
      }
    },
    'circle': {
      bg: {
        borderRadius: '50%'
      }
    }
  }, { 'zDepth-1': zDepth === 1 });

  return _react2.default.createElement(
    'div',
    { style: styles.wrap },
    _react2.default.createElement('div', { style: styles.bg }),
    _react2.default.createElement(
      'div',
      { style: styles.content },
      children
    )
  );
};

Raised.propTypes = {
  background: _propTypes2.default.string,
  zDepth: _propTypes2.default.oneOf([0, 1, 2, 3, 4, 5]),
  radius: _propTypes2.default.number
};

Raised.defaultProps = {
  background: '#fff',
  zDepth: 1,
  radius: 2
};

exports.default = Raised;