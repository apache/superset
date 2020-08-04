// Conditional and repeated task invocation for node and browser.

/*globals setTimeout, define, module */

(function (globals) {
  'use strict';

  if (typeof define === 'function' && define.amd) {
    define(function () {
      return tryer;
    });
  } else if (typeof module !== 'undefined' && module !== null) {
    module.exports = tryer;
  } else {
    globals.tryer = tryer;
  }

  // Public function `tryer`.
  //
  // Performs some action when pre-requisite conditions are met and/or until
  // post-requisite conditions are satisfied.
  //
  // @option action {function} The function that you want to invoke. Defaults to `() => {}`.
  //                           If `action` returns a promise, iterations will not end until
  //                           the promise is resolved or rejected. Alternatively, `action`
  //                           may take a callback argument, `done`, to signal that it is
  //                           asynchronous. In that case, you are responsible for calling
  //                           `done` when the action is finished.
  //
  // @option when {function}   Predicate used to test pre-conditions. Should return `false`
  //                           to postpone `action` or `true` to perform it. Defaults to
  //                           `() => true`.
  //
  // @option until {function}  Predicate used to test post-conditions. Should return `false`
  //                           to retry `action` or `true` to terminate it. Defaults to
  //                           `() => true`.
  //
  // @option fail {function}   Callback to be invoked if `limit` tries are reached. Defaults
  //                           to `() => {}`.
  //
  // @option pass {function}   Callback to be invoked after `until` has returned truthily.
  //                           Defaults to `() => {}`.
  //
  // @option interval {number} Retry interval in milliseconds. A negative number indicates
  //                           that subsequent retries should wait for double the interval
  //                           from the preceding iteration (exponential backoff). Defaults
  //                           to -1000.
  //
  // @option limit {number}    Maximum retry count, at which point the call fails and retries
  //                           will cease. A negative number indicates that retries should
  //                           continue indefinitely. Defaults to -1.
  //
  // @example
  //   tryer({
  //     when: () => db.isConnected,
  //     action: () => db.insert(user),
  //     fail () {
  //       log.error('No database connection, terminating.');
  //       process.exit(1);
  //     },
  //     interval: 1000,
  //     limit: 10
  //   });
  //
  // @example
  //   let sent = false;
  //   tryer({
  //     until: () => sent,
  //     action: done => {
  //       smtp.send(email, error => {
  //         if (! error) {
  //           sent = true;
  //         }
  //         done();
  //       });
  //     },
  //     pass: next,
  //     interval: -1000,
  //     limit: -1
  //   });
  function tryer (options) {
    options = normaliseOptions(options);

    iterateWhen();

    function iterateWhen () {
      if (preRecur()) {
        iterateUntil();
      }
    }

    function preRecur () {
      return conditionallyRecur('when', iterateWhen);
    }

    function conditionallyRecur (predicateKey, iterate) {
      if (! options[predicateKey]()) {
        incrementCount(options);

        if (shouldFail(options)) {
          options.fail();
        }  else {
          recur(iterate, postIncrementInterval(options));
        }

        return false;
      }

      return true;
    }

    function iterateUntil () {
      var result;

      if (isActionSynchronous(options)) {
        result = options.action();

        if (result && isFunction(result.then)) {
          return result.then(postRecur, postRecur);
        }

        return postRecur();
      }

      options.action(postRecur);
    }

    function postRecur () {
      if (conditionallyRecur('until', iterateUntil)) {
        options.pass();
      }
    }
  }

  function normaliseOptions (options) {
    options = options || {};
    return {
      count: 0,
      when: normalisePredicate(options.when),
      until: normalisePredicate(options.until),
      action: normaliseFunction(options.action),
      fail: normaliseFunction(options.fail),
      pass: normaliseFunction(options.pass),
      interval: normaliseNumber(options.interval, -1000),
      limit: normaliseNumber(options.limit, -1)
    };
  }

  function normalisePredicate (fn) {
    return normalise(fn, isFunction, yes);
  }

  function isFunction (fn) {
    return typeof fn === 'function';
  }

  function yes () {
    return true;
  }

  function normaliseFunction (fn) {
    return normalise(fn, isFunction, nop);
  }

  function nop () {
  }

  function normalise (thing, predicate, defaultValue) {
    if (predicate(thing)) {
      return thing;
    }

    return defaultValue;
  }

  function normaliseNumber (number, defaultNumber) {
    return normalise(number, isNumber, defaultNumber);
  }

  function isNumber (number) {
    return typeof number === 'number' && number === number;
  }

  function isActionSynchronous (options) {
    return options.action.length === 0;
  }

  function incrementCount (options) {
    options.count += 1;
  }

  function shouldFail (options) {
    return options.limit >= 0 && options.count >= options.limit;
  }

  function postIncrementInterval (options) {
    var currentInterval = options.interval;

    if (options.interval < 0) {
      options.interval *= 2;
    }

    return currentInterval;
  }

  function recur (fn, interval) {
    setTimeout(fn, Math.abs(interval));
  }
}(this));

