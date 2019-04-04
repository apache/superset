/*globals chai, spooks, require, tryer, suite, setup, test, setTimeout, Promise */

(function (require, spooks) {
  'use strict';

  var assert, modulePath;

  if (require === undefined) {
    assert = chai.assert;
    require = function () { return tryer; };
  } else {
    assert = require('chai').assert;
    spooks = require('spooks');
    modulePath = '../src/tryer';
  }
  
  suite('tryer:', function () {
    test('require does not throw', function () {
      assert.doesNotThrow(function () {
        require(modulePath);
      });
    });
  
    suite('require:', function () {
      var tryer;
  
      setup(function () {
        tryer = require(modulePath);
      });
  
      test('function is exported', function () {
        assert.isFunction(tryer);
      });
  
      test('tryer does not throw when options is missing', function () {
        assert.doesNotThrow(function () {
          tryer();
        });
      });
  
      test('tryer does not throw when options is object', function () {
        assert.doesNotThrow(function () {
          tryer({});
        });
      });
  
      suite('when passing immediately:', function () {
        var log, predicate, action, fail, pass;
  
        setup(function (done) {
          log = {};
          predicate = spooks.fn({ name: 'predicate', log: log, results: [ true ] });
          action = spooks.fn({ name: 'action', log: log });
          fail = spooks.fn({ name: 'fail', log: log, callback: done });
          pass = spooks.fn({ name: 'pass', log: log, callback: done });
          tryer({
            when: predicate,
            action: action,
            fail: fail,
            pass: pass,
            interval: 0,
            limit: 3
          });
        });
  
        test('predicate was called once', function () {
          assert.strictEqual(log.counts.predicate, 1);
        });
  
        test('action was called once', function () {
          assert.strictEqual(log.counts.action, 1);
        });
  
        test('fail was not called', function () {
          assert.strictEqual(log.counts.fail, 0);
        });
  
        test('pass was called once', function () {
          assert.strictEqual(log.counts.pass, 1);
        });
      });
  
      suite('when failing three times:', function () {
        var log, predicate, action, fail, pass;
  
        setup(function (done) {
          log = {};
          predicate = spooks.fn({ name: 'predicate', log: log, results: [ false ] });
          action = spooks.fn({ name: 'action', log: log });
          fail = spooks.fn({ name: 'fail', log: log, callback: done });
          pass = spooks.fn({ name: 'pass', log: log, callback: done });
          tryer({
            when: predicate,
            action: action,
            fail: fail,
            pass: pass,
            interval: 0,
            limit: 3
          });
        });
  
        test('predicate was called three times', function () {
          assert.strictEqual(log.counts.predicate, 3);
        });
  
        test('action was not called', function () {
          assert.strictEqual(log.counts.action, 0);
        });
  
        test('fail was called once', function () {
          assert.strictEqual(log.counts.fail, 1);
        });
  
        test('pass was not called', function () {
          assert.strictEqual(log.counts.pass, 0);
        });
      });
  
      suite('when failing five times:', function () {
        var log, predicate, action, fail;
  
        setup(function (done) {
          log = {};
          predicate = spooks.fn({ name: 'predicate', log: log, results: [ false ] });
          action = spooks.fn({ name: 'action', log: log, callback: done });
          fail = spooks.fn({ name: 'fail', log: log, callback: done });
          tryer({ when: predicate, action: action, fail: fail, interval: 0, limit: 5 });
        });
  
        test('predicate was called five times', function () {
          assert.strictEqual(log.counts.predicate, 5);
        });
  
        test('action was not called', function () {
          assert.strictEqual(log.counts.action, 0);
        });
  
        test('fail was called once', function () {
          assert.strictEqual(log.counts.fail, 1);
        });
      });
  
      suite('when failing exponentially:', function () {
        var log, timestamps, predicate, action, fail;
  
        setup(function (done) {
          log = {};
          timestamps = [];
          predicate = spooks.fn({
            name: 'predicate',
            log: log,
            results: [ false ],
            callback: function () {
              timestamps.push(Date.now());
            }
          });
          action = spooks.fn({ name: 'action', log: log, callback: done });
          fail = spooks.fn({ name: 'fail', log: log, callback: done });
          timestamps.push(Date.now());
          tryer({ when: predicate, action: action, fail: fail, interval: -10, limit: 4 });
        });
  
        test('five timestamps were recorded', function () {
          assert.lengthOf(timestamps, 5);
        });
  
        test('first interval is immediate', function () {
          assert.isTrue(timestamps[1] < timestamps[0] + 5);
        });
  
        test('second interval is about 10 ms', function () {
          assert.isTrue(timestamps[2] >= timestamps[1] + 10);
          assert.isTrue(timestamps[2] < timestamps[1] + 15);
        });
  
        test('third interval is about 20 ms', function () {
          assert.isTrue(timestamps[3] >= timestamps[2] + 20);
          assert.isTrue(timestamps[3] < timestamps[2] + 30);
        });
  
        test('fourth interval is about 40 ms', function () {
          assert.isTrue(timestamps[4] >= timestamps[3] + 40);
          assert.isTrue(timestamps[4] < timestamps[3] + 50);
        });
      });
  
      suite('until passing immediately:', function () {
        var log, predicate, action, fail, pass;
  
        setup(function (done) {
          log = {};
          predicate = spooks.fn({ name: 'predicate', log: log, results: [ true ] });
          action = spooks.fn({ name: 'action', log: log });
          fail = spooks.fn({ name: 'fail', log: log, callback: done });
          pass = spooks.fn({ name: 'pass', log: log, callback: done });
          tryer({
            until: predicate,
            action: action,
            fail: fail,
            pass: pass,
            interval: 0,
            limit: 3
          });
        });
  
        test('predicate was called once', function () {
          assert.strictEqual(log.counts.predicate, 1);
        });
  
        test('action was called once', function () {
          assert.strictEqual(log.counts.action, 1);
        });
  
        test('fail was not called', function () {
          assert.strictEqual(log.counts.fail, 0);
        });
  
        test('pass was called once', function () {
          assert.strictEqual(log.counts.pass, 1);
        });
  
        test('pass was called once', function () {
          assert.strictEqual(log.counts.pass, 1);
        });
      });
  
      suite('until failing three times:', function () {
        var log, predicate, action, fail, pass;
  
        setup(function (done) {
          log = {};
          predicate = spooks.fn({ name: 'predicate', log: log, results: [ false ] });
          action = spooks.fn({ name: 'action', log: log });
          fail = spooks.fn({ name: 'fail', log: log, callback: done });
          pass = spooks.fn({ name: 'pass', log: log, callback: done });
          tryer({
            until: predicate,
            action: action,
            fail: fail,
            pass: pass,
            interval: 0,
            limit: 3
          });
        });
  
        test('predicate was called three times', function () {
          assert.strictEqual(log.counts.predicate, 3);
        });
  
        test('action was called three times', function () {
          assert.strictEqual(log.counts.action, 3);
        });
  
        test('fail was called once', function () {
          assert.strictEqual(log.counts.fail, 1);
        });
  
        test('pass was not called', function () {
          assert.strictEqual(log.counts.pass, 0);
        });
      });
  
      suite('until failing five times:', function () {
        var log, predicate, action, fail;
  
        setup(function (done) {
          log = {};
          predicate = spooks.fn({ name: 'predicate', log: log, results: [ false ] });
          action = spooks.fn({ name: 'action', log: log });
          fail = spooks.fn({ name: 'fail', log: log, callback: done });
          tryer({ until: predicate, action: action, fail: fail, interval: 0, limit: 5 });
        });
  
        test('predicate was called five times', function () {
          assert.strictEqual(log.counts.predicate, 5);
        });
  
        test('action was called five times', function () {
          assert.strictEqual(log.counts.action, 5);
        });
  
        test('fail was called once', function () {
          assert.strictEqual(log.counts.fail, 1);
        });
      });
  
      suite('until failing exponentially:', function () {
        var log, timestamps, predicate, action, fail;
  
        setup(function (done) {
          log = {};
          timestamps = [];
          predicate = spooks.fn({
            name: 'predicate',
            log: log,
            results: [ false ],
            callback: function () {
              timestamps.push(Date.now());
            }
          });
          action = spooks.fn({ name: 'action', log: log });
          fail = spooks.fn({ name: 'fail', log: log, callback: done });
          timestamps.push(Date.now());
          tryer({ until: predicate, action: action, fail: fail, interval: -10, limit: 4 });
        });
  
        test('five timestamps were recorded', function () {
          assert.lengthOf(timestamps, 5);
        });
  
        test('first interval is immediate', function () {
          assert.isTrue(timestamps[1] < timestamps[0] + 5);
        });
  
        test('second interval is about 10 ms', function () {
          assert.isTrue(timestamps[2] >= timestamps[1] + 10);
          assert.isTrue(timestamps[2] < timestamps[1] + 20);
        });
  
        test('third interval is about 20 ms', function () {
          assert.isTrue(timestamps[3] >= timestamps[2] + 20);
          assert.isTrue(timestamps[3] < timestamps[2] + 30);
        });
  
        test('fourth interval is about 40 ms', function () {
          assert.isTrue(timestamps[4] >= timestamps[3] + 40);
          assert.isTrue(timestamps[4] < timestamps[3] + 50);
        });
      });
  
      suite('when failing once then passing and until failing twice then passing', function () {
        var log, predicateLoggers, predicates, action, fail, pass;
  
        setup(function (done) {
          log = {};
          predicateLoggers = {
            when: spooks.fn({ name: 'when', log: log }),
            until: spooks.fn({ name: 'until', log: log })
          };
          predicates = {
            when: function () {
              predicateLoggers.when.apply(this, arguments);
              if (log.counts.when === 1) {
                return false;
              }
              return true;
            },
            until: function () {
              predicateLoggers.until.apply(this, arguments);
              if (log.counts.until < 3) {
                return false;
              }
              return true;
            }
          };
          action = spooks.fn({ name: 'action', log: log });
          fail = spooks.fn({ name: 'fail', log: log, callback: done });
          pass = spooks.fn({ name: 'pass', log: log, callback: done });
          tryer({
            when: predicates.when,
            until: predicates.until,
            action: action,
            fail: fail,
            pass: pass,
            interval: 0,
            limit: 4
          });
        });
  
        test('when was called twice', function () {
          assert.strictEqual(log.counts.when, 2);
        });
  
        test('action was called three times', function () {
          assert.strictEqual(log.counts.action, 3);
        });
  
        test('until was called three times', function () {
          assert.strictEqual(log.counts.until, 3);
        });
  
        test('fail was not called', function () {
          assert.strictEqual(log.counts.fail, 0);
        });
  
        test('pass was called once', function () {
          assert.strictEqual(log.counts.pass, 1);
        });
      });
  
      suite('asynchronous action:', function () {
        var log, timestamps, predicate, action;
  
        setup(function (done) {
          log = {};
          timestamps = [];
          predicate = function () {
            timestamps.push(Date.now());
            return false;
          };
          action = function (tryerDone) {
            setTimeout(tryerDone, 10);
          };
          timestamps.push(Date.now());
          tryer({ until: predicate, action: action, fail: done, interval: 0, limit: 3 });
        });
  
        test('four timestamps were recorded', function () {
          assert.lengthOf(timestamps, 4);
        });
  
        test('first interval is about 10 ms', function () {
          assert.isTrue(timestamps[1] >= timestamps[0] + 10);
          assert.isTrue(timestamps[1] < timestamps[0] + 20);
        });
  
        test('second interval is about 10 ms', function () {
          assert.isTrue(timestamps[2] >= timestamps[1] + 10);
          assert.isTrue(timestamps[2] < timestamps[1] + 20);
        });
  
        test('third interval is about 10 ms', function () {
          assert.isTrue(timestamps[3] >= timestamps[2] + 10);
          assert.isTrue(timestamps[3] < timestamps[2] + 20);
        });
      });
  
      if (typeof Promise === 'function') {
        suite('promise-resolving action:', function () {
          var log, timestamps, predicate, action;
  
          setup(function (done) {
            log = {};
            timestamps = [];
            predicate = function () {
              timestamps.push(Date.now());
              return false;
            };
            action = function () {
              return new Promise(function (resolve) {
                setTimeout(resolve, 10);
              });
            };
            timestamps.push(Date.now());
            tryer({ until: predicate, action: action, fail: done, interval: 0, limit: 3 });
          });
  
          test('four timestamps were recorded', function () {
            assert.lengthOf(timestamps, 4);
          });
  
          test('first interval is about 10 ms', function () {
            assert.isTrue(timestamps[1] >= timestamps[0] + 10);
            assert.isTrue(timestamps[1] < timestamps[0] + 20);
          });
  
          test('second interval is about 10 ms', function () {
            assert.isTrue(timestamps[2] >= timestamps[1] + 10);
            assert.isTrue(timestamps[2] < timestamps[1] + 20);
          });
  
          test('third interval is about 10 ms', function () {
            assert.isTrue(timestamps[3] >= timestamps[2] + 10);
            assert.isTrue(timestamps[3] < timestamps[2] + 20);
          });
        });

        suite('promise-rejecting action:', function () {
          var log, timestamps, predicate, action;
  
          setup(function (done) {
            log = {};
            timestamps = [];
            predicate = function () {
              timestamps.push(Date.now());
              return false;
            };
            action = function () {
              return new Promise(function (_, reject) {
                setTimeout(reject, 10);
              });
            };
            timestamps.push(Date.now());
            tryer({ until: predicate, action: action, fail: done, interval: 0, limit: 3 });
          });
  
          test('four timestamps were recorded', function () {
            assert.lengthOf(timestamps, 4);
          });
  
          test('first interval is about 10 ms', function () {
            assert.isTrue(timestamps[1] >= timestamps[0] + 10);
            assert.isTrue(timestamps[1] < timestamps[0] + 20);
          });
  
          test('second interval is about 10 ms', function () {
            assert.isTrue(timestamps[2] >= timestamps[1] + 10);
            assert.isTrue(timestamps[2] < timestamps[1] + 20);
          });
  
          test('third interval is about 10 ms', function () {
            assert.isTrue(timestamps[3] >= timestamps[2] + 10);
            assert.isTrue(timestamps[3] < timestamps[2] + 20);
          });
        });
      }
    });
  });
}(
  typeof require === 'function' ? require : undefined,
  typeof spooks === 'object' ? spooks : undefined)
);
  
