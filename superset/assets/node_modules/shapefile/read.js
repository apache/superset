var queue = require("d3-queue");

var file = require("./file");

module.exports = function(reader) {
  return function() {
    var argv = [].slice.call(arguments),
        callback = argv.pop(),
        r = reader.apply(null, argv);

    queue(1)
        .defer(r.readHeader)
        .defer(function(callback) {
          var records = [];
          (function readNextRecord() {
            r.readRecord(function(error, record) {
              if (error) return callback(error);
              if (record === file.end) return callback(null, records);
              records.push(record);
              process.nextTick(readNextRecord);
            });
          })();
        })
        .defer(r.close)
        .await(function(error, header, records) {
          if (error) return callback(error);
          callback(null, header, records);
        });
  };
};
