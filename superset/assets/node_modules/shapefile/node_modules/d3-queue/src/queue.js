import {slice} from "./array";
import noop from "./noop";

var noabort = {};

function newQueue(concurrency) {
  if (!(concurrency >= 1)) throw new Error;

  var q,
      tasks = [],
      results = [],
      waiting = 0,
      active = 0,
      ended = 0,
      starting, // inside a synchronous task callback?
      error = null,
      notify = noop;

  function poke() {
    if (!starting) try { start(); } // let the current task complete
    catch (e) { if (tasks[ended + active - 1]) abort(e); } // task errored synchronously
  }

  function start() {
    while (starting = waiting && active < concurrency) {
      var i = ended + active,
          t = tasks[i],
          j = t.length - 1,
          c = t[j];
      t[j] = end(i);
      --waiting, ++active;
      t = c.apply(null, t);
      if (!tasks[i]) continue; // task finished synchronously
      tasks[i] = t || noabort;
    }
  }

  function end(i) {
    return function(e, r) {
      if (!tasks[i]) return; // ignore multiple callbacks
      --active, ++ended;
      tasks[i] = null;
      if (error != null) return; // ignore secondary errors
      if (e != null) {
        abort(e);
      } else {
        results[i] = r;
        if (waiting) poke();
        else if (!active) notify(error, results);
      }
    };
  }

  function abort(e) {
    var i = tasks.length, t;
    error = e; // ignore active callbacks
    results = undefined; // allow gc
    waiting = NaN; // prevent starting

    while (--i >= 0) {
      if (t = tasks[i]) {
        tasks[i] = null;
        if (t.abort) try { t.abort(); }
        catch (e) { /* ignore */ }
      }
    }

    active = NaN; // allow notification
    notify(error, results);
  }

  return q = {
    defer: function(callback) {
      if (typeof callback !== "function" || notify !== noop) throw new Error;
      if (error != null) return q;
      var t = slice.call(arguments, 1);
      t.push(callback);
      ++waiting, tasks.push(t);
      poke();
      return q;
    },
    abort: function() {
      if (error == null) abort(new Error("abort"));
      return q;
    },
    await: function(callback) {
      if (typeof callback !== "function" || notify !== noop) throw new Error;
      notify = function(error, results) { callback.apply(null, [error].concat(results)); };
      if (!active) notify(error, results);
      return q;
    },
    awaitAll: function(callback) {
      if (typeof callback !== "function" || notify !== noop) throw new Error;
      notify = callback;
      if (!active) notify(error, results);
      return q;
    }
  };
}

export default function(concurrency) {
  return newQueue(arguments.length ? +concurrency : Infinity);
}
