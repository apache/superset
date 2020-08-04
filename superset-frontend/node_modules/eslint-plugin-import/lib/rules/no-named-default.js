'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    docs: {
      url: (0, _docsUrl2.default)('no-named-default')
    }
  },

  create: function (context) {
    return {
      'ImportDeclaration': function (node) {
        node.specifiers.forEach(function (im) {
          if (im.type === 'ImportSpecifier' && im.imported.name === 'default') {
            context.report({
              node: im.local,
              message: `Use default import syntax to import '${im.local.name}'.` });
          }
        });
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGVzL25vLW5hbWVkLWRlZmF1bHQuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwiY3JlYXRlIiwiY29udGV4dCIsIm5vZGUiLCJzcGVjaWZpZXJzIiwiZm9yRWFjaCIsImltIiwidHlwZSIsImltcG9ydGVkIiwibmFtZSIsInJlcG9ydCIsImxvY2FsIiwibWVzc2FnZSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0FBRUFBLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsUUFBTTtBQUNKQyxVQUFNO0FBQ0pDLFdBQUssdUJBQVEsa0JBQVI7QUFERDtBQURGLEdBRFM7O0FBT2ZDLFVBQVEsVUFBVUMsT0FBVixFQUFtQjtBQUN6QixXQUFPO0FBQ0wsMkJBQXFCLFVBQVVDLElBQVYsRUFBZ0I7QUFDbkNBLGFBQUtDLFVBQUwsQ0FBZ0JDLE9BQWhCLENBQXdCLFVBQVVDLEVBQVYsRUFBYztBQUNwQyxjQUFJQSxHQUFHQyxJQUFILEtBQVksaUJBQVosSUFBaUNELEdBQUdFLFFBQUgsQ0FBWUMsSUFBWixLQUFxQixTQUExRCxFQUFxRTtBQUNuRVAsb0JBQVFRLE1BQVIsQ0FBZTtBQUNiUCxvQkFBTUcsR0FBR0ssS0FESTtBQUViQyx1QkFBVSx3Q0FBdUNOLEdBQUdLLEtBQUgsQ0FBU0YsSUFBSyxJQUZsRCxFQUFmO0FBR0Q7QUFDRixTQU5EO0FBT0Q7QUFUSSxLQUFQO0FBV0Q7QUFuQmMsQ0FBakIiLCJmaWxlIjoicnVsZXMvbm8tbmFtZWQtZGVmYXVsdC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCduby1uYW1lZC1kZWZhdWx0JyksXG4gICAgfSxcbiAgfSxcblxuICBjcmVhdGU6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICdJbXBvcnREZWNsYXJhdGlvbic6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgIG5vZGUuc3BlY2lmaWVycy5mb3JFYWNoKGZ1bmN0aW9uIChpbSkge1xuICAgICAgICAgIGlmIChpbS50eXBlID09PSAnSW1wb3J0U3BlY2lmaWVyJyAmJiBpbS5pbXBvcnRlZC5uYW1lID09PSAnZGVmYXVsdCcpIHtcbiAgICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgICAgbm9kZTogaW0ubG9jYWwsXG4gICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2UgZGVmYXVsdCBpbXBvcnQgc3ludGF4IHRvIGltcG9ydCAnJHtpbS5sb2NhbC5uYW1lfScuYCB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH0sXG4gICAgfVxuICB9LFxufVxuIl19