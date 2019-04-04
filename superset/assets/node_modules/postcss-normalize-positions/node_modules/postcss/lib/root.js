"use strict";

exports.__esModule = true;
exports.default = void 0;

var _container = _interopRequireDefault(require("./container"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

/**
 * Represents a CSS file and contains all its parsed nodes.
 *
 * @extends Container
 *
 * @example
 * const root = postcss.parse('a{color:black} b{z-index:2}')
 * root.type         //=> 'root'
 * root.nodes.length //=> 2
 */
var Root =
/*#__PURE__*/
function (_Container) {
  _inheritsLoose(Root, _Container);

  function Root(defaults) {
    var _this;

    _this = _Container.call(this, defaults) || this;
    _this.type = 'root';
    if (!_this.nodes) _this.nodes = [];
    return _this;
  }

  var _proto = Root.prototype;

  _proto.removeChild = function removeChild(child, ignore) {
    var index = this.index(child);

    if (!ignore && index === 0 && this.nodes.length > 1) {
      this.nodes[1].raws.before = this.nodes[index].raws.before;
    }

    return _Container.prototype.removeChild.call(this, child);
  };

  _proto.normalize = function normalize(child, sample, type) {
    var nodes = _Container.prototype.normalize.call(this, child);

    if (sample) {
      if (type === 'prepend') {
        if (this.nodes.length > 1) {
          sample.raws.before = this.nodes[1].raws.before;
        } else {
          delete sample.raws.before;
        }
      } else if (this.first !== sample) {
        for (var _iterator = nodes, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
          var _ref;

          if (_isArray) {
            if (_i >= _iterator.length) break;
            _ref = _iterator[_i++];
          } else {
            _i = _iterator.next();
            if (_i.done) break;
            _ref = _i.value;
          }

          var node = _ref;
          node.raws.before = sample.raws.before;
        }
      }
    }

    return nodes;
  };
  /**
   * Returns a {@link Result} instance representing the root’s CSS.
   *
   * @param {processOptions} [opts] Options with only `to` and `map` keys.
   *
   * @return {Result} Result with current root’s CSS.
   *
   * @example
   * const root1 = postcss.parse(css1, { from: 'a.css' })
   * const root2 = postcss.parse(css2, { from: 'b.css' })
   * root1.append(root2)
   * const result = root1.toResult({ to: 'all.css', map: true })
   */


  _proto.toResult = function toResult(opts) {
    if (opts === void 0) {
      opts = {};
    }

    var LazyResult = require('./lazy-result');

    var Processor = require('./processor');

    var lazy = new LazyResult(new Processor(), this, opts);
    return lazy.stringify();
  };
  /**
   * @memberof Root#
   * @member {object} raws Information to generate byte-to-byte equal
   *                       node string as it was in the origin input.
   *
   * Every parser saves its own properties,
   * but the default CSS parser uses:
   *
   * * `after`: the space symbols after the last child to the end of file.
   * * `semicolon`: is the last child has an (optional) semicolon.
   *
   * @example
   * postcss.parse('a {}\n').raws //=> { after: '\n' }
   * postcss.parse('a {}').raws   //=> { after: '' }
   */


  return Root;
}(_container.default);

var _default = Root;
exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJvb3QuZXM2Il0sIm5hbWVzIjpbIlJvb3QiLCJkZWZhdWx0cyIsInR5cGUiLCJub2RlcyIsInJlbW92ZUNoaWxkIiwiY2hpbGQiLCJpZ25vcmUiLCJpbmRleCIsImxlbmd0aCIsInJhd3MiLCJiZWZvcmUiLCJub3JtYWxpemUiLCJzYW1wbGUiLCJmaXJzdCIsIm5vZGUiLCJ0b1Jlc3VsdCIsIm9wdHMiLCJMYXp5UmVzdWx0IiwicmVxdWlyZSIsIlByb2Nlc3NvciIsImxhenkiLCJzdHJpbmdpZnkiLCJDb250YWluZXIiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7Ozs7OztBQUVBOzs7Ozs7Ozs7O0lBVU1BLEk7Ozs7O0FBQ0osZ0JBQWFDLFFBQWIsRUFBdUI7QUFBQTs7QUFDckIsa0NBQU1BLFFBQU47QUFDQSxVQUFLQyxJQUFMLEdBQVksTUFBWjtBQUNBLFFBQUksQ0FBQyxNQUFLQyxLQUFWLEVBQWlCLE1BQUtBLEtBQUwsR0FBYSxFQUFiO0FBSEk7QUFJdEI7Ozs7U0FFREMsVyx3QkFBYUMsSyxFQUFPQyxNLEVBQVE7QUFDMUIsUUFBSUMsS0FBSyxHQUFHLEtBQUtBLEtBQUwsQ0FBV0YsS0FBWCxDQUFaOztBQUVBLFFBQUksQ0FBQ0MsTUFBRCxJQUFXQyxLQUFLLEtBQUssQ0FBckIsSUFBMEIsS0FBS0osS0FBTCxDQUFXSyxNQUFYLEdBQW9CLENBQWxELEVBQXFEO0FBQ25ELFdBQUtMLEtBQUwsQ0FBVyxDQUFYLEVBQWNNLElBQWQsQ0FBbUJDLE1BQW5CLEdBQTRCLEtBQUtQLEtBQUwsQ0FBV0ksS0FBWCxFQUFrQkUsSUFBbEIsQ0FBdUJDLE1BQW5EO0FBQ0Q7O0FBRUQsZ0NBQWFOLFdBQWIsWUFBeUJDLEtBQXpCO0FBQ0QsRzs7U0FFRE0sUyxzQkFBV04sSyxFQUFPTyxNLEVBQVFWLEksRUFBTTtBQUM5QixRQUFJQyxLQUFLLHdCQUFTUSxTQUFULFlBQW1CTixLQUFuQixDQUFUOztBQUVBLFFBQUlPLE1BQUosRUFBWTtBQUNWLFVBQUlWLElBQUksS0FBSyxTQUFiLEVBQXdCO0FBQ3RCLFlBQUksS0FBS0MsS0FBTCxDQUFXSyxNQUFYLEdBQW9CLENBQXhCLEVBQTJCO0FBQ3pCSSxVQUFBQSxNQUFNLENBQUNILElBQVAsQ0FBWUMsTUFBWixHQUFxQixLQUFLUCxLQUFMLENBQVcsQ0FBWCxFQUFjTSxJQUFkLENBQW1CQyxNQUF4QztBQUNELFNBRkQsTUFFTztBQUNMLGlCQUFPRSxNQUFNLENBQUNILElBQVAsQ0FBWUMsTUFBbkI7QUFDRDtBQUNGLE9BTkQsTUFNTyxJQUFJLEtBQUtHLEtBQUwsS0FBZUQsTUFBbkIsRUFBMkI7QUFDaEMsNkJBQWlCVCxLQUFqQixrSEFBd0I7QUFBQTs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBOztBQUFBLGNBQWZXLElBQWU7QUFDdEJBLFVBQUFBLElBQUksQ0FBQ0wsSUFBTCxDQUFVQyxNQUFWLEdBQW1CRSxNQUFNLENBQUNILElBQVAsQ0FBWUMsTUFBL0I7QUFDRDtBQUNGO0FBQ0Y7O0FBRUQsV0FBT1AsS0FBUDtBQUNELEc7QUFFRDs7Ozs7Ozs7Ozs7Ozs7O1NBYUFZLFEscUJBQVVDLEksRUFBWTtBQUFBLFFBQVpBLElBQVk7QUFBWkEsTUFBQUEsSUFBWSxHQUFMLEVBQUs7QUFBQTs7QUFDcEIsUUFBSUMsVUFBVSxHQUFHQyxPQUFPLENBQUMsZUFBRCxDQUF4Qjs7QUFDQSxRQUFJQyxTQUFTLEdBQUdELE9BQU8sQ0FBQyxhQUFELENBQXZCOztBQUVBLFFBQUlFLElBQUksR0FBRyxJQUFJSCxVQUFKLENBQWUsSUFBSUUsU0FBSixFQUFmLEVBQWdDLElBQWhDLEVBQXNDSCxJQUF0QyxDQUFYO0FBQ0EsV0FBT0ksSUFBSSxDQUFDQyxTQUFMLEVBQVA7QUFDRCxHO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7OztFQTFEaUJDLGtCOztlQTJFSnRCLEkiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQ29udGFpbmVyIGZyb20gJy4vY29udGFpbmVyJ1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBDU1MgZmlsZSBhbmQgY29udGFpbnMgYWxsIGl0cyBwYXJzZWQgbm9kZXMuXG4gKlxuICogQGV4dGVuZHMgQ29udGFpbmVyXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHJvb3QgPSBwb3N0Y3NzLnBhcnNlKCdhe2NvbG9yOmJsYWNrfSBie3otaW5kZXg6Mn0nKVxuICogcm9vdC50eXBlICAgICAgICAgLy89PiAncm9vdCdcbiAqIHJvb3Qubm9kZXMubGVuZ3RoIC8vPT4gMlxuICovXG5jbGFzcyBSb290IGV4dGVuZHMgQ29udGFpbmVyIHtcbiAgY29uc3RydWN0b3IgKGRlZmF1bHRzKSB7XG4gICAgc3VwZXIoZGVmYXVsdHMpXG4gICAgdGhpcy50eXBlID0gJ3Jvb3QnXG4gICAgaWYgKCF0aGlzLm5vZGVzKSB0aGlzLm5vZGVzID0gW11cbiAgfVxuXG4gIHJlbW92ZUNoaWxkIChjaGlsZCwgaWdub3JlKSB7XG4gICAgbGV0IGluZGV4ID0gdGhpcy5pbmRleChjaGlsZClcblxuICAgIGlmICghaWdub3JlICYmIGluZGV4ID09PSAwICYmIHRoaXMubm9kZXMubGVuZ3RoID4gMSkge1xuICAgICAgdGhpcy5ub2Rlc1sxXS5yYXdzLmJlZm9yZSA9IHRoaXMubm9kZXNbaW5kZXhdLnJhd3MuYmVmb3JlXG4gICAgfVxuXG4gICAgcmV0dXJuIHN1cGVyLnJlbW92ZUNoaWxkKGNoaWxkKVxuICB9XG5cbiAgbm9ybWFsaXplIChjaGlsZCwgc2FtcGxlLCB0eXBlKSB7XG4gICAgbGV0IG5vZGVzID0gc3VwZXIubm9ybWFsaXplKGNoaWxkKVxuXG4gICAgaWYgKHNhbXBsZSkge1xuICAgICAgaWYgKHR5cGUgPT09ICdwcmVwZW5kJykge1xuICAgICAgICBpZiAodGhpcy5ub2Rlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgc2FtcGxlLnJhd3MuYmVmb3JlID0gdGhpcy5ub2Rlc1sxXS5yYXdzLmJlZm9yZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSBzYW1wbGUucmF3cy5iZWZvcmVcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0aGlzLmZpcnN0ICE9PSBzYW1wbGUpIHtcbiAgICAgICAgZm9yIChsZXQgbm9kZSBvZiBub2Rlcykge1xuICAgICAgICAgIG5vZGUucmF3cy5iZWZvcmUgPSBzYW1wbGUucmF3cy5iZWZvcmVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBub2Rlc1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSB7QGxpbmsgUmVzdWx0fSBpbnN0YW5jZSByZXByZXNlbnRpbmcgdGhlIHJvb3TigJlzIENTUy5cbiAgICpcbiAgICogQHBhcmFtIHtwcm9jZXNzT3B0aW9uc30gW29wdHNdIE9wdGlvbnMgd2l0aCBvbmx5IGB0b2AgYW5kIGBtYXBgIGtleXMuXG4gICAqXG4gICAqIEByZXR1cm4ge1Jlc3VsdH0gUmVzdWx0IHdpdGggY3VycmVudCByb2904oCZcyBDU1MuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IHJvb3QxID0gcG9zdGNzcy5wYXJzZShjc3MxLCB7IGZyb206ICdhLmNzcycgfSlcbiAgICogY29uc3Qgcm9vdDIgPSBwb3N0Y3NzLnBhcnNlKGNzczIsIHsgZnJvbTogJ2IuY3NzJyB9KVxuICAgKiByb290MS5hcHBlbmQocm9vdDIpXG4gICAqIGNvbnN0IHJlc3VsdCA9IHJvb3QxLnRvUmVzdWx0KHsgdG86ICdhbGwuY3NzJywgbWFwOiB0cnVlIH0pXG4gICAqL1xuICB0b1Jlc3VsdCAob3B0cyA9IHsgfSkge1xuICAgIGxldCBMYXp5UmVzdWx0ID0gcmVxdWlyZSgnLi9sYXp5LXJlc3VsdCcpXG4gICAgbGV0IFByb2Nlc3NvciA9IHJlcXVpcmUoJy4vcHJvY2Vzc29yJylcblxuICAgIGxldCBsYXp5ID0gbmV3IExhenlSZXN1bHQobmV3IFByb2Nlc3NvcigpLCB0aGlzLCBvcHRzKVxuICAgIHJldHVybiBsYXp5LnN0cmluZ2lmeSgpXG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlcm9mIFJvb3QjXG4gICAqIEBtZW1iZXIge29iamVjdH0gcmF3cyBJbmZvcm1hdGlvbiB0byBnZW5lcmF0ZSBieXRlLXRvLWJ5dGUgZXF1YWxcbiAgICogICAgICAgICAgICAgICAgICAgICAgIG5vZGUgc3RyaW5nIGFzIGl0IHdhcyBpbiB0aGUgb3JpZ2luIGlucHV0LlxuICAgKlxuICAgKiBFdmVyeSBwYXJzZXIgc2F2ZXMgaXRzIG93biBwcm9wZXJ0aWVzLFxuICAgKiBidXQgdGhlIGRlZmF1bHQgQ1NTIHBhcnNlciB1c2VzOlxuICAgKlxuICAgKiAqIGBhZnRlcmA6IHRoZSBzcGFjZSBzeW1ib2xzIGFmdGVyIHRoZSBsYXN0IGNoaWxkIHRvIHRoZSBlbmQgb2YgZmlsZS5cbiAgICogKiBgc2VtaWNvbG9uYDogaXMgdGhlIGxhc3QgY2hpbGQgaGFzIGFuIChvcHRpb25hbCkgc2VtaWNvbG9uLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBwb3N0Y3NzLnBhcnNlKCdhIHt9XFxuJykucmF3cyAvLz0+IHsgYWZ0ZXI6ICdcXG4nIH1cbiAgICogcG9zdGNzcy5wYXJzZSgnYSB7fScpLnJhd3MgICAvLz0+IHsgYWZ0ZXI6ICcnIH1cbiAgICovXG59XG5cbmV4cG9ydCBkZWZhdWx0IFJvb3RcbiJdLCJmaWxlIjoicm9vdC5qcyJ9
