var fs = require("fs");
var path = require("path");

module.exports = new Function("d3", fs.readFileSync(path.join(__dirname, "d3.geo.projection.js"), "utf-8"));
