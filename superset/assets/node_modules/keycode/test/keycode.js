"use strict"

// check if is component
if (require.modules) {
  var keycode = require('keycode')
  var assert = require('timoxley-assert')
} else {
  var keycode = require('../')
  var assert = require('assert')
}

it('can return a charcode from a letter', function() {
  assert.strictEqual(keycode('0'), 48);
  assert.strictEqual(keycode('B'), 66);
  assert.strictEqual(keycode('f1'), 112);
  assert.strictEqual(keycode('9'), 57);
  assert.strictEqual(keycode('numpad 0'), 96);
})


it('can use aliases from a letter', function() {
  assert.strictEqual(keycode('ctl'), keycode('ctrl'));
})

it('does not use alias name when mapping back from a number', function() {
  for (var key in keycode.aliases) {
    assert.notStrictEqual(keycode(keycode(key)), key);
  }
})

it('is case insensitive', function() {
  assert.strictEqual(keycode('a'), 65);
  assert.strictEqual(keycode('A'), 65);
  assert.strictEqual(keycode('enter'), 13);
  assert.strictEqual(keycode('ENTER'), 13);
  assert.strictEqual(keycode('enTeR'), 13);
  assert.strictEqual(keycode('Spacebar'), 32);
})

it('returns char code for strange chars', function() {
  // TODO: not sure if this is sensible behaviour
  assert.strictEqual(keycode('∆'), 8710);
  assert.strictEqual(keycode('漢'), 28450);
})

it('returns undefined for unknown strings', function() {
  assert.strictEqual(keycode('ants'), undefined);
  assert.strictEqual(keycode('Bagels'), undefined);
  assert.strictEqual(keycode(''), undefined);
  assert.strictEqual(keycode('JKHG KJG LSDF'), undefined);
})

it('returns undefined for unknown numbers', function() {
  assert.strictEqual(keycode(-1), undefined);
  assert.strictEqual(keycode(Infinity), undefined);
  assert.strictEqual(keycode(0.3), undefined);
  assert.strictEqual(keycode(9999999), undefined);
})

it('returns code for objects implementing toString function', function() {
  var obj = {}
  obj.toString = function() {
    return 'a'
  }
  assert.strictEqual(keycode(obj), 65);
})

it('returns char for objects with a keyCode property', function() {
  var obj = { keyCode: 65 }
  assert.strictEqual(keycode(obj), 'a');
})

it('returns undefined for any other passed in type', function() {
  assert.strictEqual(keycode({}), undefined);
  assert.strictEqual(keycode([]), undefined);
  assert.strictEqual(keycode([1,2]), undefined);
  assert.strictEqual(keycode(null), undefined);
  assert.strictEqual(keycode(undefined), undefined);
  assert.strictEqual(keycode(/.*/), undefined);
  assert.strictEqual(keycode(), undefined);
})

it('is commutative', function() {
  for (var key in keycode.code) {
    assert.strictEqual(keycode(key), keycode(keycode(keycode(key))))
  }
})

it('exposes keycode/name maps', function() {
  for (var code in keycode.codes) {
    assert.strictEqual(keycode(code), keycode(keycode.names[keycode.codes[code]]))
  }
})

it('should return shift, ctrl, and alt for 16, 17, and 18', function() {
  assert.strictEqual(keycode(16), 'shift')
  assert.strictEqual(keycode(17), 'ctrl')
  assert.strictEqual(keycode(18), 'alt')
})

describe('isEventKey', function() {
  
  it('should allow to compare events to their names', function() {
    var event = { which: 13, keyCode: 13, charCode: 13 };
    assert.strictEqual(keycode.isEventKey(event, 'enter'), true);
    assert.strictEqual(keycode.isEventKey(event, 'down'), false);
  });
  
  it('should allow to compare events to their names (case insensitive)', function() {
    var event = { which: 13, keyCode: 13, charCode: 13 };
    assert.strictEqual(keycode.isEventKey(event, 'eNtER'), true);
    assert.strictEqual(keycode.isEventKey(event, 'dOWN'), false);
  });
  
  it('should return false if a ', function() {
    var event = { which: 13, keyCode: 13, charCode: 13 };
    assert.strictEqual(keycode.isEventKey(event, 'eNtER'), true);
    assert.strictEqual(keycode.isEventKey(event, 'dOWN'), false);
  });
  
  it('should allow to compare events to their keyCodes)', function() {
    var event = { which: 13, keyCode: 13, charCode: 13 };
    assert.strictEqual(keycode.isEventKey(event, 13), true);
    assert.strictEqual(keycode.isEventKey(event, 14), false);
  });

  it('should not break when invalid key codes are entered, instead false should be returned', function() {
    var event = { which: -1, keyCode: -1, charCode: -1 };
    assert.strictEqual(keycode.isEventKey(event, 'enter'), false);
    assert.strictEqual(keycode.isEventKey(event, 'down'), false);
  });

});

