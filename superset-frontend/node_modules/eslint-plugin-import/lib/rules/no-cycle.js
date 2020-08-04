'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * @fileOverview Ensures that no imported module imports the linted module.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * @author Ben Mosher
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          */

var _ExportMap = require('../ExportMap');

var _ExportMap2 = _interopRequireDefault(_ExportMap);

var _moduleVisitor = require('eslint-module-utils/moduleVisitor');

var _moduleVisitor2 = _interopRequireDefault(_moduleVisitor);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// todo: cache cycles / deep relationships for faster repeat evaluation
module.exports = {
  meta: {
    docs: { url: (0, _docsUrl2.default)('no-cycle') },
    schema: [(0, _moduleVisitor.makeOptionsSchema)({
      maxDepth: {
        description: 'maximum dependency depth to traverse',
        type: 'integer',
        minimum: 1
      }
    })]
  },

  create: function (context) {
    const myPath = context.getFilename();
    if (myPath === '<text>') return {}; // can't cycle-check a non-file

    const options = context.options[0] || {};
    const maxDepth = options.maxDepth || Infinity;

    function checkSourceValue(sourceNode, importer) {
      const imported = _ExportMap2.default.get(sourceNode.value, context);

      if (sourceNode.parent && sourceNode.parent.importKind === 'type') {
        return; // no Flow import resolution
      }

      if (sourceNode._babelType === 'Literal') {
        return; // no Flow import resolution, workaround for ESLint < 5.x
      }

      if (imported == null) {
        return; // no-unresolved territory
      }

      if (imported.path === myPath) {
        return; // no-self-import territory
      }

      const untraversed = [{ mget: () => imported, route: [] }];
      const traversed = new Set();
      function detectCycle(_ref) {
        let mget = _ref.mget,
            route = _ref.route;

        const m = mget();
        if (m == null) return;
        if (traversed.has(m.path)) return;
        traversed.add(m.path);

        for (let _ref2 of m.imports) {
          var _ref3 = _slicedToArray(_ref2, 2);

          let path = _ref3[0];
          var _ref3$ = _ref3[1];
          let getter = _ref3$.getter;
          let source = _ref3$.source;

          if (path === myPath) return true;
          if (traversed.has(path)) continue;
          if (route.length + 1 < maxDepth) {
            untraversed.push({
              mget: getter,
              route: route.concat(source)
            });
          }
        }
      }

      while (untraversed.length > 0) {
        const next = untraversed.shift(); // bfs!
        if (detectCycle(next)) {
          const message = next.route.length > 0 ? `Dependency cycle via ${routeString(next.route)}` : 'Dependency cycle detected.';
          context.report(importer, message);
          return;
        }
      }
    }

    return (0, _moduleVisitor2.default)(checkSourceValue, context.options[0]);
  }
};

function routeString(route) {
  return route.map(s => `${s.value}:${s.loc.start.line}`).join('=>');
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLWN5Y2xlLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwiZG9jcyIsInVybCIsInNjaGVtYSIsIm1heERlcHRoIiwiZGVzY3JpcHRpb24iLCJ0eXBlIiwibWluaW11bSIsImNyZWF0ZSIsImNvbnRleHQiLCJteVBhdGgiLCJnZXRGaWxlbmFtZSIsIm9wdGlvbnMiLCJJbmZpbml0eSIsImNoZWNrU291cmNlVmFsdWUiLCJzb3VyY2VOb2RlIiwiaW1wb3J0ZXIiLCJpbXBvcnRlZCIsIkV4cG9ydHMiLCJnZXQiLCJ2YWx1ZSIsInBhcmVudCIsImltcG9ydEtpbmQiLCJfYmFiZWxUeXBlIiwicGF0aCIsInVudHJhdmVyc2VkIiwibWdldCIsInJvdXRlIiwidHJhdmVyc2VkIiwiU2V0IiwiZGV0ZWN0Q3ljbGUiLCJtIiwiaGFzIiwiYWRkIiwiaW1wb3J0cyIsImdldHRlciIsInNvdXJjZSIsImxlbmd0aCIsInB1c2giLCJjb25jYXQiLCJuZXh0Iiwic2hpZnQiLCJtZXNzYWdlIiwicm91dGVTdHJpbmciLCJyZXBvcnQiLCJtYXAiLCJzIiwibG9jIiwic3RhcnQiLCJsaW5lIiwiam9pbiJdLCJtYXBwaW5ncyI6Ijs7eXBCQUFBOzs7OztBQUtBOzs7O0FBQ0E7Ozs7QUFDQTs7Ozs7O0FBRUE7QUFDQUEsT0FBT0MsT0FBUCxHQUFpQjtBQUNmQyxRQUFNO0FBQ0pDLFVBQU0sRUFBRUMsS0FBSyx1QkFBUSxVQUFSLENBQVAsRUFERjtBQUVKQyxZQUFRLENBQUMsc0NBQWtCO0FBQ3pCQyxnQkFBUztBQUNQQyxxQkFBYSxzQ0FETjtBQUVQQyxjQUFNLFNBRkM7QUFHUEMsaUJBQVM7QUFIRjtBQURnQixLQUFsQixDQUFEO0FBRkosR0FEUzs7QUFZZkMsVUFBUSxVQUFVQyxPQUFWLEVBQW1CO0FBQ3pCLFVBQU1DLFNBQVNELFFBQVFFLFdBQVIsRUFBZjtBQUNBLFFBQUlELFdBQVcsUUFBZixFQUF5QixPQUFPLEVBQVAsQ0FGQSxDQUVVOztBQUVuQyxVQUFNRSxVQUFVSCxRQUFRRyxPQUFSLENBQWdCLENBQWhCLEtBQXNCLEVBQXRDO0FBQ0EsVUFBTVIsV0FBV1EsUUFBUVIsUUFBUixJQUFvQlMsUUFBckM7O0FBRUEsYUFBU0MsZ0JBQVQsQ0FBMEJDLFVBQTFCLEVBQXNDQyxRQUF0QyxFQUFnRDtBQUM5QyxZQUFNQyxXQUFXQyxvQkFBUUMsR0FBUixDQUFZSixXQUFXSyxLQUF2QixFQUE4QlgsT0FBOUIsQ0FBakI7O0FBRUEsVUFBSU0sV0FBV00sTUFBWCxJQUFxQk4sV0FBV00sTUFBWCxDQUFrQkMsVUFBbEIsS0FBaUMsTUFBMUQsRUFBa0U7QUFDaEUsZUFEZ0UsQ0FDekQ7QUFDUjs7QUFFRCxVQUFJUCxXQUFXUSxVQUFYLEtBQTBCLFNBQTlCLEVBQXlDO0FBQ3ZDLGVBRHVDLENBQ2hDO0FBQ1I7O0FBRUQsVUFBSU4sWUFBWSxJQUFoQixFQUFzQjtBQUNwQixlQURvQixDQUNaO0FBQ1Q7O0FBRUQsVUFBSUEsU0FBU08sSUFBVCxLQUFrQmQsTUFBdEIsRUFBOEI7QUFDNUIsZUFENEIsQ0FDcEI7QUFDVDs7QUFFRCxZQUFNZSxjQUFjLENBQUMsRUFBQ0MsTUFBTSxNQUFNVCxRQUFiLEVBQXVCVSxPQUFNLEVBQTdCLEVBQUQsQ0FBcEI7QUFDQSxZQUFNQyxZQUFZLElBQUlDLEdBQUosRUFBbEI7QUFDQSxlQUFTQyxXQUFULE9BQW9DO0FBQUEsWUFBZEosSUFBYyxRQUFkQSxJQUFjO0FBQUEsWUFBUkMsS0FBUSxRQUFSQSxLQUFROztBQUNsQyxjQUFNSSxJQUFJTCxNQUFWO0FBQ0EsWUFBSUssS0FBSyxJQUFULEVBQWU7QUFDZixZQUFJSCxVQUFVSSxHQUFWLENBQWNELEVBQUVQLElBQWhCLENBQUosRUFBMkI7QUFDM0JJLGtCQUFVSyxHQUFWLENBQWNGLEVBQUVQLElBQWhCOztBQUVBLDBCQUF1Q08sRUFBRUcsT0FBekMsRUFBa0Q7QUFBQTs7QUFBQSxjQUF4Q1YsSUFBd0M7QUFBQTtBQUFBLGNBQWhDVyxNQUFnQyxVQUFoQ0EsTUFBZ0M7QUFBQSxjQUF4QkMsTUFBd0IsVUFBeEJBLE1BQXdCOztBQUNoRCxjQUFJWixTQUFTZCxNQUFiLEVBQXFCLE9BQU8sSUFBUDtBQUNyQixjQUFJa0IsVUFBVUksR0FBVixDQUFjUixJQUFkLENBQUosRUFBeUI7QUFDekIsY0FBSUcsTUFBTVUsTUFBTixHQUFlLENBQWYsR0FBbUJqQyxRQUF2QixFQUFpQztBQUMvQnFCLHdCQUFZYSxJQUFaLENBQWlCO0FBQ2ZaLG9CQUFNUyxNQURTO0FBRWZSLHFCQUFPQSxNQUFNWSxNQUFOLENBQWFILE1BQWI7QUFGUSxhQUFqQjtBQUlEO0FBQ0Y7QUFDRjs7QUFFRCxhQUFPWCxZQUFZWSxNQUFaLEdBQXFCLENBQTVCLEVBQStCO0FBQzdCLGNBQU1HLE9BQU9mLFlBQVlnQixLQUFaLEVBQWIsQ0FENkIsQ0FDSTtBQUNqQyxZQUFJWCxZQUFZVSxJQUFaLENBQUosRUFBdUI7QUFDckIsZ0JBQU1FLFVBQVdGLEtBQUtiLEtBQUwsQ0FBV1UsTUFBWCxHQUFvQixDQUFwQixHQUNaLHdCQUF1Qk0sWUFBWUgsS0FBS2IsS0FBakIsQ0FBd0IsRUFEbkMsR0FFYiw0QkFGSjtBQUdBbEIsa0JBQVFtQyxNQUFSLENBQWU1QixRQUFmLEVBQXlCMEIsT0FBekI7QUFDQTtBQUNEO0FBQ0Y7QUFDRjs7QUFFRCxXQUFPLDZCQUFjNUIsZ0JBQWQsRUFBZ0NMLFFBQVFHLE9BQVIsQ0FBZ0IsQ0FBaEIsQ0FBaEMsQ0FBUDtBQUNEO0FBdkVjLENBQWpCOztBQTBFQSxTQUFTK0IsV0FBVCxDQUFxQmhCLEtBQXJCLEVBQTRCO0FBQzFCLFNBQU9BLE1BQU1rQixHQUFOLENBQVVDLEtBQU0sR0FBRUEsRUFBRTFCLEtBQU0sSUFBRzBCLEVBQUVDLEdBQUYsQ0FBTUMsS0FBTixDQUFZQyxJQUFLLEVBQTlDLEVBQWlEQyxJQUFqRCxDQUFzRCxJQUF0RCxDQUFQO0FBQ0QiLCJmaWxlIjoicnVsZXMvbm8tY3ljbGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBmaWxlT3ZlcnZpZXcgRW5zdXJlcyB0aGF0IG5vIGltcG9ydGVkIG1vZHVsZSBpbXBvcnRzIHRoZSBsaW50ZWQgbW9kdWxlLlxuICogQGF1dGhvciBCZW4gTW9zaGVyXG4gKi9cblxuaW1wb3J0IEV4cG9ydHMgZnJvbSAnLi4vRXhwb3J0TWFwJ1xuaW1wb3J0IG1vZHVsZVZpc2l0b3IsIHsgbWFrZU9wdGlvbnNTY2hlbWEgfSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL21vZHVsZVZpc2l0b3InXG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG4vLyB0b2RvOiBjYWNoZSBjeWNsZXMgLyBkZWVwIHJlbGF0aW9uc2hpcHMgZm9yIGZhc3RlciByZXBlYXQgZXZhbHVhdGlvblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICBkb2NzOiB7IHVybDogZG9jc1VybCgnbm8tY3ljbGUnKSB9LFxuICAgIHNjaGVtYTogW21ha2VPcHRpb25zU2NoZW1hKHtcbiAgICAgIG1heERlcHRoOntcbiAgICAgICAgZGVzY3JpcHRpb246ICdtYXhpbXVtIGRlcGVuZGVuY3kgZGVwdGggdG8gdHJhdmVyc2UnLFxuICAgICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICAgIG1pbmltdW06IDEsXG4gICAgICB9LFxuICAgIH0pXSxcbiAgfSxcblxuICBjcmVhdGU6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgY29uc3QgbXlQYXRoID0gY29udGV4dC5nZXRGaWxlbmFtZSgpXG4gICAgaWYgKG15UGF0aCA9PT0gJzx0ZXh0PicpIHJldHVybiB7fSAvLyBjYW4ndCBjeWNsZS1jaGVjayBhIG5vbi1maWxlXG5cbiAgICBjb25zdCBvcHRpb25zID0gY29udGV4dC5vcHRpb25zWzBdIHx8IHt9XG4gICAgY29uc3QgbWF4RGVwdGggPSBvcHRpb25zLm1heERlcHRoIHx8IEluZmluaXR5XG5cbiAgICBmdW5jdGlvbiBjaGVja1NvdXJjZVZhbHVlKHNvdXJjZU5vZGUsIGltcG9ydGVyKSB7XG4gICAgICBjb25zdCBpbXBvcnRlZCA9IEV4cG9ydHMuZ2V0KHNvdXJjZU5vZGUudmFsdWUsIGNvbnRleHQpXG5cbiAgICAgIGlmIChzb3VyY2VOb2RlLnBhcmVudCAmJiBzb3VyY2VOb2RlLnBhcmVudC5pbXBvcnRLaW5kID09PSAndHlwZScpIHtcbiAgICAgICAgcmV0dXJuIC8vIG5vIEZsb3cgaW1wb3J0IHJlc29sdXRpb25cbiAgICAgIH1cblxuICAgICAgaWYgKHNvdXJjZU5vZGUuX2JhYmVsVHlwZSA9PT0gJ0xpdGVyYWwnKSB7XG4gICAgICAgIHJldHVybiAvLyBubyBGbG93IGltcG9ydCByZXNvbHV0aW9uLCB3b3JrYXJvdW5kIGZvciBFU0xpbnQgPCA1LnhcbiAgICAgIH1cblxuICAgICAgaWYgKGltcG9ydGVkID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuICAvLyBuby11bnJlc29sdmVkIHRlcnJpdG9yeVxuICAgICAgfVxuXG4gICAgICBpZiAoaW1wb3J0ZWQucGF0aCA9PT0gbXlQYXRoKSB7XG4gICAgICAgIHJldHVybiAgLy8gbm8tc2VsZi1pbXBvcnQgdGVycml0b3J5XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHVudHJhdmVyc2VkID0gW3ttZ2V0OiAoKSA9PiBpbXBvcnRlZCwgcm91dGU6W119XVxuICAgICAgY29uc3QgdHJhdmVyc2VkID0gbmV3IFNldCgpXG4gICAgICBmdW5jdGlvbiBkZXRlY3RDeWNsZSh7bWdldCwgcm91dGV9KSB7XG4gICAgICAgIGNvbnN0IG0gPSBtZ2V0KClcbiAgICAgICAgaWYgKG0gPT0gbnVsbCkgcmV0dXJuXG4gICAgICAgIGlmICh0cmF2ZXJzZWQuaGFzKG0ucGF0aCkpIHJldHVyblxuICAgICAgICB0cmF2ZXJzZWQuYWRkKG0ucGF0aClcblxuICAgICAgICBmb3IgKGxldCBbcGF0aCwgeyBnZXR0ZXIsIHNvdXJjZSB9XSBvZiBtLmltcG9ydHMpIHtcbiAgICAgICAgICBpZiAocGF0aCA9PT0gbXlQYXRoKSByZXR1cm4gdHJ1ZVxuICAgICAgICAgIGlmICh0cmF2ZXJzZWQuaGFzKHBhdGgpKSBjb250aW51ZVxuICAgICAgICAgIGlmIChyb3V0ZS5sZW5ndGggKyAxIDwgbWF4RGVwdGgpIHtcbiAgICAgICAgICAgIHVudHJhdmVyc2VkLnB1c2goe1xuICAgICAgICAgICAgICBtZ2V0OiBnZXR0ZXIsXG4gICAgICAgICAgICAgIHJvdXRlOiByb3V0ZS5jb25jYXQoc291cmNlKSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHdoaWxlICh1bnRyYXZlcnNlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IG5leHQgPSB1bnRyYXZlcnNlZC5zaGlmdCgpIC8vIGJmcyFcbiAgICAgICAgaWYgKGRldGVjdEN5Y2xlKG5leHQpKSB7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IChuZXh0LnJvdXRlLmxlbmd0aCA+IDBcbiAgICAgICAgICAgID8gYERlcGVuZGVuY3kgY3ljbGUgdmlhICR7cm91dGVTdHJpbmcobmV4dC5yb3V0ZSl9YFxuICAgICAgICAgICAgOiAnRGVwZW5kZW5jeSBjeWNsZSBkZXRlY3RlZC4nKVxuICAgICAgICAgIGNvbnRleHQucmVwb3J0KGltcG9ydGVyLCBtZXNzYWdlKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vZHVsZVZpc2l0b3IoY2hlY2tTb3VyY2VWYWx1ZSwgY29udGV4dC5vcHRpb25zWzBdKVxuICB9LFxufVxuXG5mdW5jdGlvbiByb3V0ZVN0cmluZyhyb3V0ZSkge1xuICByZXR1cm4gcm91dGUubWFwKHMgPT4gYCR7cy52YWx1ZX06JHtzLmxvYy5zdGFydC5saW5lfWApLmpvaW4oJz0+Jylcbn1cbiJdfQ==