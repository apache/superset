'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getPool = undefined;

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _WorkerPool = require('./WorkerPool');

var _WorkerPool2 = _interopRequireDefault(_WorkerPool);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var workerPools = Object.create(null);

function getPool(options) {
  var workerPoolOptions = {
    name: options.name || '',
    numberOfWorkers: options.workers || _os2.default.cpus().length,
    workerNodeArgs: options.workerNodeArgs,
    workerParallelJobs: options.workerParallelJobs || 20,
    poolTimeout: options.poolTimeout || 500,
    poolParallelJobs: options.poolParallelJobs || 200
  };
  var tpKey = JSON.stringify(workerPoolOptions);
  workerPools[tpKey] = workerPools[tpKey] || new _WorkerPool2.default(workerPoolOptions);
  var workerPool = workerPools[tpKey];
  return workerPool;
}

exports.getPool = getPool; // eslint-disable-line import/prefer-default-export