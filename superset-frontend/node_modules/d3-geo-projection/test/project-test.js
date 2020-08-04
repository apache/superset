var vows = require("vows"),
    assert = require("./assert"),
    load = require("./load"),
    _ = require("d3");

var suite = vows.describe("d3.geo.project");

suite.addBatch({
  "project": {
    topic: load("project"),
    "equirectangular": {
      topic: function(geo) {
        var equirectangular = _.geo.equirectangular().translate([0, 0]).scale(180 / Math.PI);
        return function(object) { return geo.project(object, equirectangular); };
      },
      "when projecting polygons": {
        "inserts a closing point": function(project) {
          assert.deepEqual(project({type: "Polygon", coordinates: [
            [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]
          ]}), {type: "Polygon", coordinates: [
            [[0, 0], [0, -1], [1, -1], [1, 0], [0, 0]]
          ]});
        }
      }
    }
  }
});

suite.export(module);
