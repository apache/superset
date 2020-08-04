'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _expectJs = require('expect.js');

var _expectJs2 = _interopRequireDefault(_expectJs);

var _Disposable = require('../Disposable');

var _Disposable2 = _interopRequireDefault(_Disposable);

var _SerialDisposable = require('../SerialDisposable');

var _SerialDisposable2 = _interopRequireDefault(_SerialDisposable);

describe('SerialDisposable', function () {
  var dispA = undefined;
  var dispB = undefined;
  var dispC = undefined;

  beforeEach(function () {
    dispA = new _Disposable2['default'](function () {
      dispA.disposed = true;
    });
    dispB = new _Disposable2['default'](function () {
      dispB.disposed = true;
    });
    dispC = new _Disposable2['default'](function () {
      dispC.disposed = true;
    });
  });

  it('throws on bad disposable', function () {
    var serial = new _SerialDisposable2['default']();
    _expectJs2['default'](function () {
      return serial.setDisposable(42);
    }).to.throwError();
    _expectJs2['default'](function () {
      return serial.setDisposable({});
    }).to.throwError();
    _expectJs2['default'](function () {
      return serial.setDisposable(0);
    }).to.throwError();
    _expectJs2['default'](function () {
      return serial.setDisposable('');
    }).to.throwError();
  });

  it('lets you get and set the current disposable', function () {
    var serial = new _SerialDisposable2['default']();
    _expectJs2['default'](serial.getDisposable()).equal(null);
    serial.setDisposable(dispA);
    _expectJs2['default'](serial.getDisposable()).equal(dispA);
    serial.setDisposable(null);
    _expectJs2['default'](serial.getDisposable()).equal(null);
    serial.setDisposable();
    _expectJs2['default'](serial.getDisposable()).equal(null);
    serial.setDisposable(dispA);
    _expectJs2['default'](serial.getDisposable()).equal(dispA);
  });

  it('disposes the current disposable on own dispose', function () {
    var serial = new _SerialDisposable2['default']();
    serial.setDisposable(dispA);
    _expectJs2['default'](dispA.disposed).to.equal(undefined);
    serial.dispose();
    _expectJs2['default'](dispA.disposed).to.equal(true);
  });

  it('disposes the just current disposable if is disposed itself', function () {
    var serial = new _SerialDisposable2['default']();
    serial.dispose();
    serial.setDisposable(dispA);
    _expectJs2['default'](dispA.disposed).to.equal(true);
    serial.setDisposable(null);
    serial.setDisposable(dispB);
    _expectJs2['default'](dispB.disposed).to.equal(true);
  });

  it('disposes the previous disposable ', function () {
    var serial = new _SerialDisposable2['default']();
    serial.setDisposable(dispA);
    _expectJs2['default'](dispA.disposed).to.equal(undefined);
    serial.setDisposable(dispB);
    _expectJs2['default'](dispA.disposed).to.equal(true);
    _expectJs2['default'](dispB.disposed).to.equal(undefined);
    serial.setDisposable(null);
    _expectJs2['default'](dispB.disposed).to.equal(true);
    serial.setDisposable(dispC);
    _expectJs2['default'](dispC.disposed).to.equal(undefined);
    serial.setDisposable(null);
    _expectJs2['default'](dispC.disposed).to.equal(true);
  });

  it('does not attempt to dispose the child twice', function () {
    var serial = new _SerialDisposable2['default']();
    serial.setDisposable(dispA);
    serial.dispose();
    _expectJs2['default'](dispA.disposed).to.equal(true);

    dispA.disposed = 42;
    serial.dispose();
    _expectJs2['default'](dispA.disposed).to.equal(42);
  });
});