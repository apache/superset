'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _expectJs = require('expect.js');

var _expectJs2 = _interopRequireDefault(_expectJs);

var _Disposable = require('../Disposable');

var _Disposable2 = _interopRequireDefault(_Disposable);

var _SerialDisposable = require('../SerialDisposable');

var _SerialDisposable2 = _interopRequireDefault(_SerialDisposable);

var _CompositeDisposable = require('../CompositeDisposable');

var _CompositeDisposable2 = _interopRequireDefault(_CompositeDisposable);

var _isDisposable = require('../isDisposable');

var _isDisposable2 = _interopRequireDefault(_isDisposable);

describe('isDisposable', function () {
  it('checks for dispose function', function () {
    _expectJs2['default'](_isDisposable2['default'](new _Disposable2['default']())).to.equal(true);
    _expectJs2['default'](_isDisposable2['default'](new _SerialDisposable2['default']())).to.equal(true);
    _expectJs2['default'](_isDisposable2['default'](new _CompositeDisposable2['default']())).to.equal(true);
    _expectJs2['default'](_isDisposable2['default']({ dispose: function dispose() {} })).to.equal(true);
    _expectJs2['default'](_isDisposable2['default']({ dispose: 42 })).to.equal(false);
    _expectJs2['default'](_isDisposable2['default'](function () {})).to.equal(false);
  });
});