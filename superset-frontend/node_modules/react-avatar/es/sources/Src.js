'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import PropTypes from 'prop-types';

var SrcSource = function SrcSource(props) {
  var _this = this;

  _classCallCheck(this, SrcSource);

  _defineProperty(this, "props", null);

  _defineProperty(this, "isCompatible", function () {
    return !!_this.props.src;
  });

  _defineProperty(this, "get", function (setState) {
    setState({
      sourceName: 'src',
      src: _this.props.src
    });
  });

  this.props = props;
};

_defineProperty(SrcSource, "propTypes", {
  src: PropTypes.string
});

export { SrcSource as default };