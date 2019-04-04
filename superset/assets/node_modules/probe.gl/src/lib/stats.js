import {getTimestamp} from './utils/timestamp';
import {formatTime} from './utils/formatters';

// const MAX_FPS = 70;

export default class Stats {

  constructor({id}) {
    this.id = id;
    this.time = getTimestamp();
    this.counters = {};
    Object.seal(this);
  }

  // Initialize a new counter
  addCounter(name) {
    this._getCounter(name);
    return this;
  }

  // Call to bump a counter (+1)
  bump(name) {
    const counter = this._getCounter(name);
    counter.call++;
    counter.count++;
    return this;
  }

  // Call to bump a counter
  increment(name, count) {
    const counter = this._getCounter(name);
    counter.call++;
    counter.count += count;
    return this;
  }

  addTimer(name) {
    const timer = this._getCounter(name);
    timer.time = 0;
    return this;
  }

  addTime(name, time) {
    const timer = this._getCounter(name);
    timer.time += time;
    timer.count++;
    return this;
  }

  timeStart(name, subname) {
    const timer = this._getCounter(name);
    timer._startTime = getTimestamp();
  }

  timeEnd(name, subname) {
    const timer = this._getCounter(name);
    this.addTime(name, getTimestamp() - timer._startTime);
  }

  // Reset all timers
  reset() {
    this.time = getTimestamp();
    for (const key in this.counters) {
      const counter = this.counters[key];
      counter.count = 0;
      counter.time = 0;
    }
    return this;
  }

  // ACCESSORS

  hasTimeElapsed(deltaTime = 1000) {
    return (getTimestamp() - this.time) > 1000;
  }

  getStats() {
    const deltaTime = (getTimestamp() - this.time) / 1000;
    const stats = {};
    for (const key in this.counters) {
      const counter = this.counters[key];
      stats[counter.title] = {
        total: counter.count,
        fps: Math.round(counter.count / deltaTime)
      };
      if (counter.time) {
        stats[counter.title].totalTime = formatTime(counter.time);
        stats[counter.title].avgTime = formatTime(counter.time / counter.count);
      }
    }
    return stats;
  }

  // Return stats in a "table format" suitable for console.table() or Log.table()
  getStatsTable() {
    const stats = this.getStats();
    for (const key in stats) {
      if (stats[key].total === 0) {
        delete stats[key];
      }
    }
    return stats;
  }

  // Returns the names of all registered stats, enables iteration
  getStatNames() {
    return Object.keys(this.counters);
  }

  get(name) {
    const counter = this._getCounter(name);
    return counter.count;
  }

  getCount(name) {
    const counter = this._getCounter(name);
    return counter.count;
  }

  getFPS(name) {
    const counter = this._getCounter(name);
    const deltaTime = (getTimestamp() - this.time) / 1000;
    return Math.round(counter.count / deltaTime);
  }

  // DEPRECATED METHODS

  getTimeString() {
    return `${this.id}:${formatTime(this.time)}(${this.count})`;
  }

  oneSecondPassed(deltaTime = 1000) {
    return this.hasTimeElapsed(deltaTime);
  }

  // PRIVATE METHODS

  _getCounter(name) {
    let counter = this.counters[name];
    if (!counter) {
      counter = {
        title: name,
        unit: '',
        timer: false,
        count: 0,
        time: 0,
        totalTime: 0,
        averageTime: 0
      };
      this.counters[name] = counter;
    }
    return counter;
  }

  _incrementTimer(counter, time, count) {
    counter.count += count;
    counter.totalTime += time;
    counter.averageTime = counter.totalTime / count;
  }
}
