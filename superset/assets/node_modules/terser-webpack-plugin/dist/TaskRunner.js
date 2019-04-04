'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _cacache = require('cacache');

var _cacache2 = _interopRequireDefault(_cacache);

var _findCacheDir = require('find-cache-dir');

var _findCacheDir2 = _interopRequireDefault(_findCacheDir);

var _workerFarm = require('worker-farm');

var _workerFarm2 = _interopRequireDefault(_workerFarm);

var _serializeJavascript = require('serialize-javascript');

var _serializeJavascript2 = _interopRequireDefault(_serializeJavascript);

var _minify = require('./minify');

var _minify2 = _interopRequireDefault(_minify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const worker = require.resolve('./worker');

class TaskRunner {
  constructor(options = {}) {
    const { cache, parallel } = options;
    this.cacheDir = cache === true ? (0, _findCacheDir2.default)({ name: 'terser-webpack-plugin' }) : cache;
    // In some cases cpus() returns undefined
    // https://github.com/nodejs/node/issues/19022
    const cpus = _os2.default.cpus() || { length: 1 };
    this.maxConcurrentWorkers = parallel === true ? cpus.length - 1 : Math.min(Number(parallel) || 0, cpus.length - 1);
  }

  run(tasks, callback) {
    /* istanbul ignore if */
    if (!tasks.length) {
      callback(null, []);
      return;
    }

    if (this.maxConcurrentWorkers > 1) {
      const workerOptions = process.platform === 'win32' ? {
        maxConcurrentWorkers: this.maxConcurrentWorkers,
        maxConcurrentCallsPerWorker: 1
      } : { maxConcurrentWorkers: this.maxConcurrentWorkers };
      this.workers = (0, _workerFarm2.default)(workerOptions, worker);
      this.boundWorkers = (options, cb) => this.workers((0, _serializeJavascript2.default)(options), cb);
    } else {
      this.boundWorkers = (options, cb) => {
        try {
          cb(null, (0, _minify2.default)(options));
        } catch (error) {
          cb(error);
        }
      };
    }

    let toRun = tasks.length;
    const results = [];
    const step = (index, data) => {
      toRun -= 1;
      results[index] = data;

      if (!toRun) {
        callback(null, results);
      }
    };

    tasks.forEach((task, index) => {
      const enqueue = () => {
        this.boundWorkers(task, (error, data) => {
          const result = error ? { error } : data;
          const done = () => step(index, result);

          if (this.cacheDir && !result.error) {
            _cacache2.default.put(this.cacheDir, (0, _serializeJavascript2.default)(task.cacheKeys), JSON.stringify(data)).then(done, done);
          } else {
            done();
          }
        });
      };

      if (this.cacheDir) {
        _cacache2.default.get(this.cacheDir, (0, _serializeJavascript2.default)(task.cacheKeys)).then(({ data }) => step(index, JSON.parse(data)), enqueue);
      } else {
        enqueue();
      }
    });
  }

  exit() {
    if (this.workers) {
      _workerFarm2.default.end(this.workers);
    }
  }
}
exports.default = TaskRunner;