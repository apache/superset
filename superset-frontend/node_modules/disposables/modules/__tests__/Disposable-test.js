'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _expectJs = require('expect.js');

var _expectJs2 = _interopRequireDefault(_expectJs);

var _Disposable = require('../Disposable');

var _Disposable2 = _interopRequireDefault(_Disposable);

describe('Disposable', function () {
  it('should provide empty disposable', function () {
    _expectJs2['default'](_Disposable2['default'].empty.dispose).to.not.throwError();
  });

  it('calls dispose', function () {
    var disposed = false;
    var d = new _Disposable2['default'](function () {
      return disposed = true;
    });
    _expectJs2['default'](disposed).to.equal(false);
    d.dispose();
    _expectJs2['default'](disposed).to.equal(true);
  });

  it('calls dispose with null context', function () {
    var context = undefined;
    var d = new _Disposable2['default'](function () {
      context = this;
    });
    d.dispose();
    _expectJs2['default'](context).to.equal(null);
  });

  it('does not call dispose twice', function () {
    var disposed = false;
    var d = new _Disposable2['default'](function () {
      return disposed = true;
    });
    _expectJs2['default'](disposed).to.equal(false);
    d.dispose();
    _expectJs2['default'](disposed).to.equal(true);

    disposed = 42;
    d.dispose();
    _expectJs2['default'](disposed).to.equal(42);
  });
});