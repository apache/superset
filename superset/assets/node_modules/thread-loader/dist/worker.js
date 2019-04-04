'use strict';

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _module = require('module');

var _module2 = _interopRequireDefault(_module);

var _loaderRunner = require('loader-runner');

var _loaderRunner2 = _interopRequireDefault(_loaderRunner);

var _queue = require('async/queue');

var _queue2 = _interopRequireDefault(_queue);

var _readBuffer = require('./readBuffer');

var _readBuffer2 = _interopRequireDefault(_readBuffer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var writePipe = _fs2.default.createWriteStream(null, { fd: 3 }); /* global require */
/* eslint-disable no-console */

var readPipe = _fs2.default.createReadStream(null, { fd: 4 });

writePipe.on('error', console.error.bind(console));
readPipe.on('error', console.error.bind(console));

var PARALLEL_JOBS = +process.argv[2];

var nextQuestionId = 0;
var callbackMap = Object.create(null);

function toErrorObj(err) {
  return {
    message: err.message,
    details: err.details,
    stack: err.stack,
    hideStack: err.hideStack
  };
}

function toNativeError(obj) {
  if (!obj) return null;
  var err = new Error(obj.message);
  err.details = obj.details;
  err.missing = obj.missing;
  return err;
}

function writeJson(data) {
  writePipe.cork();
  process.nextTick(function () {
    return writePipe.uncork();
  });
  var lengthBuffer = new Buffer(4);
  var messageBuffer = new Buffer(JSON.stringify(data), 'utf-8');
  lengthBuffer.writeInt32BE(messageBuffer.length, 0);
  writePipe.write(lengthBuffer);
  writePipe.write(messageBuffer);
}

var queue = (0, _queue2.default)(function (_ref, taskCallback) {
  var id = _ref.id,
      data = _ref.data;

  try {
    _loaderRunner2.default.runLoaders({
      loaders: data.loaders,
      resource: data.resource,
      readResource: _fs2.default.readFile.bind(_fs2.default),
      context: {
        version: 2,
        resolve: function resolve(context, request, callback) {
          callbackMap[nextQuestionId] = callback;
          writeJson({
            type: 'resolve',
            id,
            questionId: nextQuestionId,
            context,
            request
          });
          nextQuestionId += 1;
        },
        emitWarning: function emitWarning(warning) {
          writeJson({
            type: 'emitWarning',
            id,
            data: toErrorObj(warning)
          });
        },
        emitError: function emitError(error) {
          writeJson({
            type: 'emitError',
            id,
            data: toErrorObj(error)
          });
        },
        exec: function exec(code, filename) {
          var module = new _module2.default(filename, undefined);
          module.paths = _module2.default._nodeModulePaths(undefined.context); // eslint-disable-line no-underscore-dangle
          module.filename = filename;
          module._compile(code, filename); // eslint-disable-line no-underscore-dangle
          return module.exports;
        },
        options: {
          context: data.optionsContext
        },
        webpack: true,
        'thread-loader': true,
        sourceMap: data.sourceMap,
        target: data.target,
        minimize: data.minimize,
        resourceQuery: data.resourceQuery
      }
    }, function (err, lrResult) {
      var result = lrResult.result,
          cacheable = lrResult.cacheable,
          fileDependencies = lrResult.fileDependencies,
          contextDependencies = lrResult.contextDependencies;

      var buffersToSend = [];
      var convertedResult = Array.isArray(result) && result.map(function (item) {
        var isBuffer = Buffer.isBuffer(item);
        if (isBuffer) {
          buffersToSend.push(item);
          return {
            buffer: true
          };
        }
        if (typeof item === 'string') {
          var stringBuffer = new Buffer(item, 'utf-8');
          buffersToSend.push(stringBuffer);
          return {
            buffer: true,
            string: true
          };
        }
        return {
          data: item
        };
      });
      writeJson({
        type: 'job',
        id,
        error: err && toErrorObj(err),
        result: {
          result: convertedResult,
          cacheable,
          fileDependencies,
          contextDependencies
        },
        data: buffersToSend.map(function (buffer) {
          return buffer.length;
        })
      });
      buffersToSend.forEach(function (buffer) {
        writePipe.write(buffer);
      });
      setImmediate(taskCallback);
    });
  } catch (e) {
    writeJson({
      type: 'job',
      id,
      error: toErrorObj(e)
    });
    taskCallback();
  }
}, PARALLEL_JOBS);

function onMessage(message) {
  try {
    var type = message.type,
        id = message.id;

    switch (type) {
      case 'job':
        {
          queue.push(message);
          break;
        }
      case 'result':
        {
          var error = message.error,
              result = message.result;

          var callback = callbackMap[id];
          if (callback) {
            var nativeError = toNativeError(error);
            callback(nativeError, result);
          } else {
            console.error(`Worker got unexpected result id ${id}`);
          }
          delete callbackMap[id];
          break;
        }
      case 'warmup':
        {
          var requires = message.requires;
          // load modules into process

          requires.forEach(function (r) {
            return require(r);
          }); // eslint-disable-line import/no-dynamic-require, global-require
          break;
        }
      default:
        {
          console.error(`Worker got unexpected job type ${type}`);
          break;
        }
    }
  } catch (e) {
    console.error(`Error in worker ${e}`);
  }
}

function readNextMessage() {
  (0, _readBuffer2.default)(readPipe, 4, function (lengthReadError, lengthBuffer) {
    if (lengthReadError) {
      console.error(`Failed to communicate with main process (read length) ${lengthReadError}`);
      return;
    }
    var length = lengthBuffer.readInt32BE(0);
    if (length === 0) {
      // worker should exit
      process.exit(0);
      return;
    }
    (0, _readBuffer2.default)(readPipe, length, function (messageError, messageBuffer) {
      if (messageError) {
        console.error(`Failed to communicate with main process (read message) ${messageError}`);
        return;
      }
      var messageString = messageBuffer.toString('utf-8');
      var message = JSON.parse(messageString);
      onMessage(message);
      setImmediate(function () {
        return readNextMessage();
      });
    });
  });
}

// start reading messages from main process
readNextMessage();