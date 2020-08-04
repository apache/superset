var fs = require("fs"),
    vows = require("vows"),
    assert = require("assert");

var shapefile = require("../");

var suite = vows.describe("shapefile");

suite.addBatch({
  "An empty shapefile": testConversion("empty"),
  "A shapefile with boolean properties": testConversion("boolean-property"),
  "A shapefile with numeric properties": testConversion("number-property"),
  "A shapefile with string properties": testConversion("string-property"),
  "A shapefile with mixed properties": testConversion("mixed-properties"),
  "A shapefile with date properties": testConversion("date-property"),
  "A shapefile with UTF-8 property names": testConversion("utf8-property", {encoding: "utf-8"}),
  "A shapefile with ISO-8859-1 property names": testConversion("latin1-property"),
  "A shapefile of points": testConversion("points"),
  "A shapefile of multipoints": testConversion("multipoints"),
  "A shapefile of polylines": testConversion("polylines"),
  "A shapefile of polygons": testConversion("polygons"),
  "A shapefile of null features": testConversion("null"),
  "ignoring properties": testConversion("ignore-properties", {"ignore-properties": true})
});

function fixActualProperties(feature) {
  for (var key in feature.properties) {
    if (feature.properties[key] == null) {
      delete feature.properties[key];
    }
  }
  delete feature.properties.FID; // ogr2ogr built-in?
}

function fixExpectedProperties(feature) {
  var d = feature.properties.date;
  if (d) feature.properties.date = new Date(+d.substring(0, 4), d.substring(4, 6) - 1, +d.substring(6, 8));
}

function testConversion(name, options) {
  return {
    topic: readCollection(name, options),
    "has the expected features": function(actual) {
      var expected = JSON.parse(fs.readFileSync("./test/" + name + ".json", "utf-8"));
      actual.features.forEach(fixActualProperties);
      expected.features.forEach(fixExpectedProperties);
      assert.deepEqual(actual, expected);
    }
  };
}

function readCollection(name, options) {
  return function() {
    shapefile.read("./test/" + name + ".shp", options, this.callback);
  };
}

suite.export(module);
