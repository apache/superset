var smash = require("smash"),
    d3 = require("d3");

module.exports = function() {
  var files = [].slice.call(arguments).map(function(d) { return "src/" + d; }),
      sandbox = {d3: d3};
  files.unshift("src/start");
  files.push("src/end");

  function topic() {
    smash.load(files, "d3.geo", sandbox, this.callback);
  }

  topic.sandbox = function(_) {
    sandbox = _;
    return topic;
  };

  return topic;
};
