'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var stack = function stack(err, worker, workerId) {
  var originError = (err.stack || '').split('\n').filter(function (line) {
    return line.trim().startsWith('at');
  });

  var workerError = worker.split('\n').filter(function (line) {
    return line.trim().startsWith('at');
  });

  var diff = workerError.slice(0, workerError.length - originError.length).join('\n');

  originError.unshift(diff);
  originError.unshift(err.message);
  originError.unshift(`Thread Loader (Worker ${workerId})`);

  return originError.join('\n');
};

var WorkerError = function (_Error) {
  _inherits(WorkerError, _Error);

  function WorkerError(err, workerId) {
    _classCallCheck(this, WorkerError);

    var _this = _possibleConstructorReturn(this, (WorkerError.__proto__ || Object.getPrototypeOf(WorkerError)).call(this, err));

    _this.name = err.name;
    _this.message = err.message;

    Error.captureStackTrace(_this, _this.constructor);

    _this.stack = stack(err, _this.stack, workerId);
    return _this;
  }

  return WorkerError;
}(Error);

exports.default = WorkerError;