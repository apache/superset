var fs = require("fs");

exports.reader = function(filename) {
  var error,
      fd,
      position = 0,
      buffer = new Buffer(40 * 1024),
      next = noop;

  fs.open(filename, "r", function(_error, _fd) {
    if (_error) error = _error;
    else fd = _fd;
    next();
  });

  return {
    read: function read(bytes, callback) {
      if (error) return callback(error), this;
      if (!fd) return next = function() { read(bytes, callback); }, this;
      if (buffer.length < bytes) buffer = new Buffer(1 << Math.ceil(Math.log(bytes) / Math.LN2));
      (function readRemaining(offset) {
        fs.read(fd, buffer, offset, bytes - offset, position, function(error, bytesRead) {
          if (error) return fs.close(fd, function() { callback(error); }); // auto close on error
          if (!bytesRead) return callback(null, end);
          position += bytesRead;
          if (offset + bytesRead < bytes) return readRemaining(offset + bytesRead);
          callback(null, buffer);
        });
      })(0);
      return this;
    },
    close: function close(callback) {
      if (error) return callback(error), this;
      if (!fd) return next = function() { close(callback); }, this;
      fs.close(fd, callback);
      return this;
    }
  };
};

var end = exports.end = {};

function noop() {}
