import {interval} from 'd3-timer';

export default function(callback, delay) {
  function tick(elapsed) {
    callback({timestamp: Date.now(), elapsed: elapsed});
  }
  this._timers.push(interval(tick, delay));
}
