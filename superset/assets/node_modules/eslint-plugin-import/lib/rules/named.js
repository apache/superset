'use strict';

var _path = require('path');

var path = _interopRequireWildcard(_path);

var _ExportMap = require('../ExportMap');

var _ExportMap2 = _interopRequireDefault(_ExportMap);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('named')
    }
  },

  create: function (context) {
    function checkSpecifiers(key, type, node) {
      // ignore local exports and type imports
      if (node.source == null || node.importKind === 'type') return;

      if (!node.specifiers.some(function (im) {
        return im.type === type;
      })) {
        return; // no named imports/exports
      }

      const imports = _ExportMap2.default.get(node.source.value, context);
      if (imports == null) return;

      if (imports.errors.length) {
        imports.reportErrors(context, node);
        return;
      }

      node.specifiers.forEach(function (im) {
        if (im.type !== type) return;

        // ignore type imports
        if (im.importKind === 'type') return;

        const deepLookup = imports.hasDeep(im[key].name);

        if (!deepLookup.found) {
          if (deepLookup.path.length > 1) {
            const deepPath = deepLookup.path.map(i => path.relative(path.dirname(context.getFilename()), i.path)).join(' -> ');

            context.report(im[key], `${im[key].name} not found via ${deepPath}`);
          } else {
            context.report(im[key], im[key].name + ' not found in \'' + node.source.value + '\'');
          }
        }
      });
    }

    return {
      'ImportDeclaration': checkSpecifiers.bind(null, 'imported', 'ImportSpecifier'),

      'ExportNamedDeclaration': checkSpecifiers.bind(null, 'local', 'ExportSpecifier')
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25hbWVkLmpzIl0sIm5hbWVzIjpbInBhdGgiLCJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJjcmVhdGUiLCJjb250ZXh0IiwiY2hlY2tTcGVjaWZpZXJzIiwia2V5IiwidHlwZSIsIm5vZGUiLCJzb3VyY2UiLCJpbXBvcnRLaW5kIiwic3BlY2lmaWVycyIsInNvbWUiLCJpbSIsImltcG9ydHMiLCJFeHBvcnRzIiwiZ2V0IiwidmFsdWUiLCJlcnJvcnMiLCJsZW5ndGgiLCJyZXBvcnRFcnJvcnMiLCJmb3JFYWNoIiwiZGVlcExvb2t1cCIsImhhc0RlZXAiLCJuYW1lIiwiZm91bmQiLCJkZWVwUGF0aCIsIm1hcCIsImkiLCJyZWxhdGl2ZSIsImRpcm5hbWUiLCJnZXRGaWxlbmFtZSIsImpvaW4iLCJyZXBvcnQiLCJiaW5kIl0sIm1hcHBpbmdzIjoiOztBQUFBOztJQUFZQSxJOztBQUNaOzs7O0FBQ0E7Ozs7Ozs7O0FBRUFDLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsUUFBTTtBQUNKQyxVQUFNO0FBQ0pDLFdBQUssdUJBQVEsT0FBUjtBQUREO0FBREYsR0FEUzs7QUFPZkMsVUFBUSxVQUFVQyxPQUFWLEVBQW1CO0FBQ3pCLGFBQVNDLGVBQVQsQ0FBeUJDLEdBQXpCLEVBQThCQyxJQUE5QixFQUFvQ0MsSUFBcEMsRUFBMEM7QUFDeEM7QUFDQSxVQUFJQSxLQUFLQyxNQUFMLElBQWUsSUFBZixJQUF1QkQsS0FBS0UsVUFBTCxLQUFvQixNQUEvQyxFQUF1RDs7QUFFdkQsVUFBSSxDQUFDRixLQUFLRyxVQUFMLENBQ0VDLElBREYsQ0FDTyxVQUFVQyxFQUFWLEVBQWM7QUFBRSxlQUFPQSxHQUFHTixJQUFILEtBQVlBLElBQW5CO0FBQXlCLE9BRGhELENBQUwsRUFDd0Q7QUFDdEQsZUFEc0QsQ0FDL0M7QUFDUjs7QUFFRCxZQUFNTyxVQUFVQyxvQkFBUUMsR0FBUixDQUFZUixLQUFLQyxNQUFMLENBQVlRLEtBQXhCLEVBQStCYixPQUEvQixDQUFoQjtBQUNBLFVBQUlVLFdBQVcsSUFBZixFQUFxQjs7QUFFckIsVUFBSUEsUUFBUUksTUFBUixDQUFlQyxNQUFuQixFQUEyQjtBQUN6QkwsZ0JBQVFNLFlBQVIsQ0FBcUJoQixPQUFyQixFQUE4QkksSUFBOUI7QUFDQTtBQUNEOztBQUVEQSxXQUFLRyxVQUFMLENBQWdCVSxPQUFoQixDQUF3QixVQUFVUixFQUFWLEVBQWM7QUFDcEMsWUFBSUEsR0FBR04sSUFBSCxLQUFZQSxJQUFoQixFQUFzQjs7QUFFdEI7QUFDQSxZQUFJTSxHQUFHSCxVQUFILEtBQWtCLE1BQXRCLEVBQThCOztBQUU5QixjQUFNWSxhQUFhUixRQUFRUyxPQUFSLENBQWdCVixHQUFHUCxHQUFILEVBQVFrQixJQUF4QixDQUFuQjs7QUFFQSxZQUFJLENBQUNGLFdBQVdHLEtBQWhCLEVBQXVCO0FBQ3JCLGNBQUlILFdBQVd6QixJQUFYLENBQWdCc0IsTUFBaEIsR0FBeUIsQ0FBN0IsRUFBZ0M7QUFDOUIsa0JBQU1PLFdBQVdKLFdBQVd6QixJQUFYLENBQ2Q4QixHQURjLENBQ1ZDLEtBQUsvQixLQUFLZ0MsUUFBTCxDQUFjaEMsS0FBS2lDLE9BQUwsQ0FBYTFCLFFBQVEyQixXQUFSLEVBQWIsQ0FBZCxFQUFtREgsRUFBRS9CLElBQXJELENBREssRUFFZG1DLElBRmMsQ0FFVCxNQUZTLENBQWpCOztBQUlBNUIsb0JBQVE2QixNQUFSLENBQWVwQixHQUFHUCxHQUFILENBQWYsRUFDRyxHQUFFTyxHQUFHUCxHQUFILEVBQVFrQixJQUFLLGtCQUFpQkUsUUFBUyxFQUQ1QztBQUVELFdBUEQsTUFPTztBQUNMdEIsb0JBQVE2QixNQUFSLENBQWVwQixHQUFHUCxHQUFILENBQWYsRUFDRU8sR0FBR1AsR0FBSCxFQUFRa0IsSUFBUixHQUFlLGtCQUFmLEdBQW9DaEIsS0FBS0MsTUFBTCxDQUFZUSxLQUFoRCxHQUF3RCxJQUQxRDtBQUVEO0FBQ0Y7QUFDRixPQXJCRDtBQXNCRDs7QUFFRCxXQUFPO0FBQ0wsMkJBQXFCWixnQkFBZ0I2QixJQUFoQixDQUFzQixJQUF0QixFQUNzQixVQUR0QixFQUVzQixpQkFGdEIsQ0FEaEI7O0FBTUwsZ0NBQTBCN0IsZ0JBQWdCNkIsSUFBaEIsQ0FBc0IsSUFBdEIsRUFDc0IsT0FEdEIsRUFFc0IsaUJBRnRCO0FBTnJCLEtBQVA7QUFZRDtBQTdEYyxDQUFqQiIsImZpbGUiOiJydWxlcy9uYW1lZC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCBFeHBvcnRzIGZyb20gJy4uL0V4cG9ydE1hcCdcbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCduYW1lZCcpLFxuICAgIH0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIGZ1bmN0aW9uIGNoZWNrU3BlY2lmaWVycyhrZXksIHR5cGUsIG5vZGUpIHtcbiAgICAgIC8vIGlnbm9yZSBsb2NhbCBleHBvcnRzIGFuZCB0eXBlIGltcG9ydHNcbiAgICAgIGlmIChub2RlLnNvdXJjZSA9PSBudWxsIHx8IG5vZGUuaW1wb3J0S2luZCA9PT0gJ3R5cGUnKSByZXR1cm5cblxuICAgICAgaWYgKCFub2RlLnNwZWNpZmllcnNcbiAgICAgICAgICAgIC5zb21lKGZ1bmN0aW9uIChpbSkgeyByZXR1cm4gaW0udHlwZSA9PT0gdHlwZSB9KSkge1xuICAgICAgICByZXR1cm4gLy8gbm8gbmFtZWQgaW1wb3J0cy9leHBvcnRzXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGltcG9ydHMgPSBFeHBvcnRzLmdldChub2RlLnNvdXJjZS52YWx1ZSwgY29udGV4dClcbiAgICAgIGlmIChpbXBvcnRzID09IG51bGwpIHJldHVyblxuXG4gICAgICBpZiAoaW1wb3J0cy5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgIGltcG9ydHMucmVwb3J0RXJyb3JzKGNvbnRleHQsIG5vZGUpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBub2RlLnNwZWNpZmllcnMuZm9yRWFjaChmdW5jdGlvbiAoaW0pIHtcbiAgICAgICAgaWYgKGltLnR5cGUgIT09IHR5cGUpIHJldHVyblxuXG4gICAgICAgIC8vIGlnbm9yZSB0eXBlIGltcG9ydHNcbiAgICAgICAgaWYgKGltLmltcG9ydEtpbmQgPT09ICd0eXBlJykgcmV0dXJuXG5cbiAgICAgICAgY29uc3QgZGVlcExvb2t1cCA9IGltcG9ydHMuaGFzRGVlcChpbVtrZXldLm5hbWUpXG5cbiAgICAgICAgaWYgKCFkZWVwTG9va3VwLmZvdW5kKSB7XG4gICAgICAgICAgaWYgKGRlZXBMb29rdXAucGF0aC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICBjb25zdCBkZWVwUGF0aCA9IGRlZXBMb29rdXAucGF0aFxuICAgICAgICAgICAgICAubWFwKGkgPT4gcGF0aC5yZWxhdGl2ZShwYXRoLmRpcm5hbWUoY29udGV4dC5nZXRGaWxlbmFtZSgpKSwgaS5wYXRoKSlcbiAgICAgICAgICAgICAgLmpvaW4oJyAtPiAnKVxuXG4gICAgICAgICAgICBjb250ZXh0LnJlcG9ydChpbVtrZXldLFxuICAgICAgICAgICAgICBgJHtpbVtrZXldLm5hbWV9IG5vdCBmb3VuZCB2aWEgJHtkZWVwUGF0aH1gKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb250ZXh0LnJlcG9ydChpbVtrZXldLFxuICAgICAgICAgICAgICBpbVtrZXldLm5hbWUgKyAnIG5vdCBmb3VuZCBpbiBcXCcnICsgbm9kZS5zb3VyY2UudmFsdWUgKyAnXFwnJylcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICdJbXBvcnREZWNsYXJhdGlvbic6IGNoZWNrU3BlY2lmaWVycy5iaW5kKCBudWxsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICwgJ2ltcG9ydGVkJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAsICdJbXBvcnRTcGVjaWZpZXInXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICksXG5cbiAgICAgICdFeHBvcnROYW1lZERlY2xhcmF0aW9uJzogY2hlY2tTcGVjaWZpZXJzLmJpbmQoIG51bGxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAsICdsb2NhbCdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAsICdFeHBvcnRTcGVjaWZpZXInXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICB9XG5cbiAgfSxcbn1cbiJdfQ==