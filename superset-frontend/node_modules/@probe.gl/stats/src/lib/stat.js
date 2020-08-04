import getHiResTimestamp from '../utils/hi-res-timestamp';

export default class Stat {
  constructor(name, type) {
    this.name = name;
    this.type = type;
    this.sampleSize = 1;
    this.reset();
  }

  setSampleSize(samples) {
    this.sampleSize = samples;

    return this;
  }

  // Call to increment count (+1)
  incrementCount() {
    this.addCount(1);

    return this;
  }

  // Call to decrement count (-1)
  decrementCount() {
    this.subtractCount(1);

    return this;
  }

  // Increase count
  addCount(value) {
    this._count += value;
    this._samples++;
    this._checkSampling();

    return this;
  }

  // Decrease count
  subtractCount(value) {
    this._count -= value;
    this._samples++;
    this._checkSampling();

    return this;
  }

  // Add an arbitrary timing and bump the count
  addTime(time) {
    this._time += time;
    this.lastTiming = time;
    this._samples++;
    this._checkSampling();

    return this;
  }

  // Start a timer
  timeStart() {
    this._startTime = getHiResTimestamp();
    this._timerPending = true;

    return this;
  }

  // End a timer. Adds to time and bumps the timing count.
  timeEnd() {
    if (!this._timerPending) {
      return this;
    }

    this.addTime(getHiResTimestamp() - this._startTime);
    this._timerPending = false;
    this._checkSampling();

    return this;
  }

  getSampleAverageCount() {
    return this.sampleSize > 0 ? this.lastSampleCount / this.sampleSize : 0;
  }

  // Calculate average time / count for the previous window
  getSampleAverageTime() {
    return this.sampleSize > 0 ? this.lastSampleTime / this.sampleSize : 0;
  }

  // Calculate counts per second for the previous window
  getSampleHz() {
    return this.lastSampleTime > 0 ? this.sampleSize / (this.lastSampleTime / 1000) : 0;
  }

  getAverageCount() {
    return this.samples > 0 ? this.count / this.samples : 0;
  }

  // Calculate average time / count
  getAverageTime() {
    return this.samples > 0 ? this.time / this.samples : 0;
  }

  // Calculate counts per second
  getHz() {
    return this.time > 0 ? this.samples / (this.time / 1000) : 0;
  }

  reset() {
    this.time = 0;
    this.count = 0;
    this.samples = 0;
    this.lastTiming = 0;
    this.lastSampleTime = 0;
    this.lastSampleCount = 0;
    this._count = 0;
    this._time = 0;
    this._samples = 0;
    this._startTime = 0;
    this._timerPending = false;

    return this;
  }

  _checkSampling() {
    if (this._samples === this.sampleSize) {
      this.lastSampleTime = this._time;
      this.lastSampleCount = this._count;
      this.count += this._count;
      this.time += this._time;
      this.samples += this._samples;
      this._time = 0;
      this._count = 0;
      this._samples = 0;
    }
  }
}
