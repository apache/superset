'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Sanitizes text by converting to a locale-friendly lower-case version and triming leading and trailing whitespace.
 */
var LowerCaseSanitizer = exports.LowerCaseSanitizer = function () {
  function LowerCaseSanitizer() {
    _classCallCheck(this, LowerCaseSanitizer);
  }

  _createClass(LowerCaseSanitizer, [{
    key: 'sanitize',


    /**
     * @inheritDocs
     */
    value: function sanitize(text) {
      return text ? text.toLocaleLowerCase().trim() : '';
    }
  }]);

  return LowerCaseSanitizer;
}();

;
//# sourceMappingURL=LowerCaseSanitizer.js.map