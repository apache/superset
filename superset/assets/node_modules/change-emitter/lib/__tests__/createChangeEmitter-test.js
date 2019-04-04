'use strict';

var _ava = require('ava');

var _ava2 = _interopRequireDefault(_ava);

var _ = require('../');

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _ava2.default)('calls listeners with arguments passed to emit()', function (t) {
  var emitter = (0, _.createChangeEmitter)();
  var calledWith = void 0;
  emitter.listen(function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    calledWith = args;
  });
  emitter.emit('a', 'b', 'c');
  t.deepEqual(calledWith, ['a', 'b', 'c']);
});

(0, _ava2.default)('supports multiple listeners', function (t) {
  var emitter = (0, _.createChangeEmitter)();
  var listenerA = _sinon2.default.spy();
  var listenerB = _sinon2.default.spy();

  var unlistenA = emitter.listen(listenerA);
  emitter.emit();
  t.is(listenerA.callCount, 1);
  t.is(listenerB.callCount, 0);

  emitter.emit();
  t.is(listenerA.callCount, 2);
  t.is(listenerB.callCount, 0);

  var unlistenB = emitter.listen(listenerB);
  t.is(listenerA.callCount, 2);
  t.is(listenerB.callCount, 0);

  emitter.emit();
  t.is(listenerA.callCount, 3);
  t.is(listenerB.callCount, 1);

  unlistenA();
  t.is(listenerA.callCount, 3);
  t.is(listenerB.callCount, 1);

  emitter.emit();
  t.is(listenerA.callCount, 3);
  t.is(listenerB.callCount, 2);

  unlistenB();
  t.is(listenerA.callCount, 3);
  t.is(listenerB.callCount, 2);

  emitter.emit();
  t.is(listenerA.callCount, 3);
  t.is(listenerB.callCount, 2);

  unlistenA = emitter.listen(listenerA);
  t.is(listenerA.callCount, 3);
  t.is(listenerB.callCount, 2);

  emitter.emit();
  t.is(listenerA.callCount, 4);
  t.is(listenerB.callCount, 2);
});

(0, _ava2.default)('only removes listener once when unlisten is called', function (t) {
  var emitter = (0, _.createChangeEmitter)();
  var listenerA = _sinon2.default.spy();
  var listenerB = _sinon2.default.spy();

  var unlistenA = emitter.listen(listenerA);
  emitter.listen(listenerB);

  unlistenA();
  unlistenA();

  emitter.emit();
  t.is(listenerA.callCount, 0);
  t.is(listenerB.callCount, 1);
});

(0, _ava2.default)('only removes relevant listener when unlisten is called', function (t) {
  var emitter = (0, _.createChangeEmitter)();
  var listener = _sinon2.default.spy();

  emitter.listen(listener);
  var unlisten = emitter.listen(listener);

  unlisten();
  unlisten();

  emitter.emit();
  t.is(listener.callCount, 1);
});

(0, _ava2.default)('supports unlistening within a listener', function (t) {
  var emitter = (0, _.createChangeEmitter)();
  var listenerA = _sinon2.default.spy();
  var listenerB = _sinon2.default.spy();
  var listenerC = _sinon2.default.spy();

  emitter.listen(listenerA);
  var unlistenB = emitter.listen(function () {
    listenerB();
    unlistenB();
  });
  emitter.listen(listenerC);

  emitter.emit();
  emitter.emit();

  t.is(listenerA.callCount, 2);
  t.is(listenerB.callCount, 1);
  t.is(listenerC.callCount, 2);
});

(0, _ava2.default)('when a listener is removed from inside another listener, it is still ' + 'called for the current change', function (t) {
  var emitter = (0, _.createChangeEmitter)();

  var unlistens = [];
  var unlistenAll = function unlistenAll() {
    return unlistens.forEach(function (unlisten) {
      return unlisten();
    });
  };

  var listener1 = _sinon2.default.spy();
  var listener2 = _sinon2.default.spy();
  var listener3 = _sinon2.default.spy();

  unlistens.push(emitter.listen(listener1));
  unlistens.push(emitter.listen(function () {
    listener2();
    unlistenAll();
  }));
  unlistens.push(emitter.listen(listener3));

  emitter.emit();
  t.is(listener1.callCount, 1);
  t.is(listener2.callCount, 1);
  t.is(listener3.callCount, 1); // Still called

  // Confirm all listeners were removed
  emitter.emit();
  t.is(listener1.callCount, 1);
  t.is(listener2.callCount, 1);
  t.is(listener3.callCount, 1);
});

(0, _ava2.default)('when listener is added inside another listener, the new listener is ' + 'not called for the current change', function (t) {
  var emitter = (0, _.createChangeEmitter)();

  var listener1 = _sinon2.default.spy();
  var listener2 = _sinon2.default.spy();
  var listener3 = _sinon2.default.spy();

  var listener3Added = false;
  var maybeAddThirdListener = function maybeAddThirdListener() {
    if (!listener3Added) {
      listener3Added = true;
      emitter.listen(listener3);
    }
  };

  emitter.listen(listener1);
  emitter.listen(function () {
    listener2();
    maybeAddThirdListener();
  });

  emitter.emit();
  t.is(listener1.callCount, 1);
  t.is(listener2.callCount, 1);
  t.is(listener3.callCount, 0); // Not called

  emitter.emit();
  t.is(listener1.callCount, 2);
  t.is(listener2.callCount, 2);
  t.is(listener3.callCount, 1); // Called
});

(0, _ava2.default)('uses the last snapshot of listeners during nested change events', function (t) {
  var emitter = (0, _.createChangeEmitter)();

  var listener1 = _sinon2.default.spy();
  var listener2 = _sinon2.default.spy();
  var listener3 = _sinon2.default.spy();
  var listener4 = _sinon2.default.spy();

  var unlisten4 = void 0;
  var unlisten1 = emitter.listen(function () {
    listener1();
    t.is(listener1.callCount, 1);
    t.is(listener2.callCount, 0);
    t.is(listener3.callCount, 0);
    t.is(listener4.callCount, 0);

    unlisten1();
    unlisten4 = emitter.listen(listener4);
    emitter.emit();

    t.is(listener1.callCount, 1);
    t.is(listener2.callCount, 1);
    t.is(listener3.callCount, 1);
    t.is(listener4.callCount, 1);
  });
  emitter.listen(listener2);
  emitter.listen(listener3);

  emitter.emit();
  t.is(listener1.callCount, 1);
  t.is(listener2.callCount, 2);
  t.is(listener3.callCount, 2);
  t.is(listener4.callCount, 1);

  unlisten4();
  emitter.emit();
  t.is(listener1.callCount, 1);
  t.is(listener2.callCount, 3);
  t.is(listener3.callCount, 3);
  t.is(listener4.callCount, 1);
});