'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /* eslint-disable no-console */

var _child_process = require('child_process');

var _child_process2 = _interopRequireDefault(_child_process);

var _queue = require('async/queue');

var _queue2 = _interopRequireDefault(_queue);

var _mapSeries = require('async/mapSeries');

var _mapSeries2 = _interopRequireDefault(_mapSeries);

var _readBuffer2 = require('./readBuffer');

var _readBuffer3 = _interopRequireDefault(_readBuffer2);

var _WorkerError = require('./WorkerError');

var _WorkerError2 = _interopRequireDefault(_WorkerError);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var workerPath = require.resolve('./worker');

var workerId = 0;

var PoolWorker = function () {
  function PoolWorker(options, onJobDone) {
    _classCallCheck(this, PoolWorker);

    this.nextJobId = 0;
    this.jobs = Object.create(null);
    this.activeJobs = 0;
    this.onJobDone = onJobDone;
    this.id = workerId;
    workerId += 1;
    this.worker = _child_process2.default.spawn(process.execPath, [].concat(options.nodeArgs || []).concat(workerPath, options.parallelJobs), {
      stdio: ['ignore', 1, 2, 'pipe', 'pipe']
    });

    var _worker$stdio = _slicedToArray(this.worker.stdio, 5),
        readPipe = _worker$stdio[3],
        writePipe = _worker$stdio[4];

    this.readPipe = readPipe;
    this.writePipe = writePipe;
    this.readNextMessage();
  }

  _createClass(PoolWorker, [{
    key: 'run',
    value: function run(data, callback) {
      var jobId = this.nextJobId;
      this.nextJobId += 1;
      this.jobs[jobId] = { data, callback };
      this.activeJobs += 1;
      this.writeJson({
        type: 'job',
        id: jobId,
        data
      });
    }
  }, {
    key: 'warmup',
    value: function warmup(requires) {
      this.writeJson({
        type: 'warmup',
        requires
      });
    }
  }, {
    key: 'writeJson',
    value: function writeJson(data) {
      var lengthBuffer = new Buffer(4);
      var messageBuffer = new Buffer(JSON.stringify(data), 'utf-8');
      lengthBuffer.writeInt32BE(messageBuffer.length, 0);
      this.writePipe.write(lengthBuffer);
      this.writePipe.write(messageBuffer);
    }
  }, {
    key: 'writeEnd',
    value: function writeEnd() {
      var lengthBuffer = new Buffer(4);
      lengthBuffer.writeInt32BE(0, 0);
      this.writePipe.write(lengthBuffer);
    }
  }, {
    key: 'readNextMessage',
    value: function readNextMessage() {
      var _this = this;

      this.state = 'read length';
      this.readBuffer(4, function (lengthReadError, lengthBuffer) {
        if (lengthReadError) {
          console.error(`Failed to communicate with worker (read length) ${lengthReadError}`);
          return;
        }
        _this.state = 'length read';
        var length = lengthBuffer.readInt32BE(0);
        _this.state = 'read message';
        _this.readBuffer(length, function (messageError, messageBuffer) {
          if (messageError) {
            console.error(`Failed to communicate with worker (read message) ${messageError}`);
            return;
          }
          _this.state = 'message read';
          var messageString = messageBuffer.toString('utf-8');
          var message = JSON.parse(messageString);
          _this.state = 'process message';
          _this.onWorkerMessage(message, function (err) {
            if (err) {
              console.error(`Failed to communicate with worker (process message) ${err}`);
              return;
            }
            _this.state = 'soon next';
            setImmediate(function () {
              return _this.readNextMessage();
            });
          });
        });
      });
    }
  }, {
    key: 'onWorkerMessage',
    value: function onWorkerMessage(message, finalCallback) {
      var _this2 = this;

      var type = message.type,
          id = message.id;

      switch (type) {
        case 'job':
          {
            var data = message.data,
                error = message.error,
                result = message.result;

            (0, _mapSeries2.default)(data, function (length, callback) {
              return _this2.readBuffer(length, callback);
            }, function (eachErr, buffers) {
              var jobCallback = _this2.jobs[id].callback;

              var callback = function callback(err, arg) {
                if (jobCallback) {
                  delete _this2.jobs[id];
                  _this2.activeJobs -= 1;
                  _this2.onJobDone();
                  if (err) {
                    jobCallback(err instanceof Error ? err : new Error(err), arg);
                  } else {
                    jobCallback(null, arg);
                  }
                }
                finalCallback();
              };
              if (eachErr) {
                callback(eachErr);
                return;
              }
              var bufferPosition = 0;
              if (result.result) {
                result.result = result.result.map(function (r) {
                  if (r.buffer) {
                    var buffer = buffers[bufferPosition];
                    bufferPosition += 1;
                    if (r.string) {
                      return buffer.toString('utf-8');
                    }
                    return buffer;
                  }
                  return r.data;
                });
              }
              if (error) {
                callback(_this2.fromErrorObj(error), result);
                return;
              }
              callback(null, result);
            });
            break;
          }
        case 'resolve':
          {
            var context = message.context,
                request = message.request,
                questionId = message.questionId;
            var _data = this.jobs[id].data;

            _data.resolve(context, request, function (error, result) {
              _this2.writeJson({
                type: 'result',
                id: questionId,
                error: error ? {
                  message: error.message,
                  details: error.details,
                  missing: error.missing
                } : null,
                result
              });
            });
            finalCallback();
            break;
          }
        case 'emitWarning':
          {
            var _data2 = message.data;
            var jobData = this.jobs[id].data;

            jobData.emitWarning(this.fromErrorObj(_data2));
            finalCallback();
            break;
          }
        case 'emitError':
          {
            var _data3 = message.data;
            var _jobData = this.jobs[id].data;

            _jobData.emitError(this.fromErrorObj(_data3));
            finalCallback();
            break;
          }
        default:
          {
            console.error(`Unexpected worker message ${type} in WorkerPool.`);
            finalCallback();
            break;
          }
      }
    }
  }, {
    key: 'fromErrorObj',
    value: function fromErrorObj(arg) {
      var obj = void 0;
      if (typeof arg === 'string') {
        obj = { message: arg };
      } else {
        obj = arg;
      }
      return new _WorkerError2.default(obj, this.id);
    }
  }, {
    key: 'readBuffer',
    value: function readBuffer(length, callback) {
      (0, _readBuffer3.default)(this.readPipe, length, callback);
    }
  }, {
    key: 'dispose',
    value: function dispose() {
      this.writeEnd();
    }
  }]);

  return PoolWorker;
}();

var WorkerPool = function () {
  function WorkerPool(options) {
    _classCallCheck(this, WorkerPool);

    this.options = options || {};
    this.numberOfWorkers = options.numberOfWorkers;
    this.poolTimeout = options.poolTimeout;
    this.workerNodeArgs = options.workerNodeArgs;
    this.workerParallelJobs = options.workerParallelJobs;
    this.workers = new Set();
    this.activeJobs = 0;
    this.timeout = null;
    this.poolQueue = (0, _queue2.default)(this.distributeJob.bind(this), options.poolParallelJobs);
  }

  _createClass(WorkerPool, [{
    key: 'run',
    value: function run(data, callback) {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
      this.activeJobs += 1;
      this.poolQueue.push(data, callback);
    }
  }, {
    key: 'distributeJob',
    value: function distributeJob(data, callback) {
      // use worker with the fewest jobs
      var bestWorker = void 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.workers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var worker = _step.value;

          if (!bestWorker || worker.activeJobs < bestWorker.activeJobs) {
            bestWorker = worker;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      if (bestWorker && (bestWorker.activeJobs === 0 || this.workers.size >= this.numberOfWorkers)) {
        bestWorker.run(data, callback);
        return;
      }
      var newWorker = this.createWorker();
      newWorker.run(data, callback);
    }
  }, {
    key: 'createWorker',
    value: function createWorker() {
      var _this3 = this;

      // spin up a new worker
      var newWorker = new PoolWorker({
        nodeArgs: this.workerNodeArgs,
        parallelJobs: this.workerParallelJobs
      }, function () {
        return _this3.onJobDone();
      });
      this.workers.add(newWorker);
      return newWorker;
    }
  }, {
    key: 'warmup',
    value: function warmup(requires) {
      while (this.workers.size < this.numberOfWorkers) {
        this.createWorker().warmup(requires);
      }
    }
  }, {
    key: 'onJobDone',
    value: function onJobDone() {
      var _this4 = this;

      this.activeJobs -= 1;
      if (this.activeJobs === 0 && isFinite(this.poolTimeout)) {
        this.timeout = setTimeout(function () {
          return _this4.disposeWorkers();
        }, this.poolTimeout);
      }
    }
  }, {
    key: 'disposeWorkers',
    value: function disposeWorkers() {
      if (this.activeJobs === 0) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = this.workers[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var worker = _step2.value;

            worker.dispose();
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }

        this.workers.clear();
      }
    }
  }]);

  return WorkerPool;
}();

exports.default = WorkerPool;