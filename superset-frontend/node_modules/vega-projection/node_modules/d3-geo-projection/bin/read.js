var fs = require("fs"),
    readline = require("readline");

module.exports = function(file, newlineDelimited, callback) {
  var index = -1,
      input = file === "-" ? process.stdin : fs.createReadStream(file);

  function readObject() {
    return new Promise(function(resolve, reject) {
      var data = [];
      input
          .on("data", function(d) { data.push(d); })
          .on("end", function() { resolve(JSON.parse(Buffer.concat(data))); })
          .on("error", reject);
    });
  }

  function readNewlineDelimitedObjects() {
    return new Promise(function(resolve, reject) {
      var queue = Promise.resolve();
      readline.createInterface({
        input: input,
        output: null
      }).on("line", function(line) {
        queue = queue.then(function() { return callbackObject(JSON.parse(line)); });
      }).on("close", function() {
        queue.then(function() { resolve(); }, reject);
      }).on("error", reject);
    });
  }

  function callbackObject(object) {
    return callback(object, ++index);
  }

  return newlineDelimited
      ? readNewlineDelimitedObjects()
      : readObject().then(callbackObject);
};
