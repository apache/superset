#!/usr/bin/env node

var path = require("path"),
    rw = require("rw").dash,
    d3 = require("d3"),
    optimist = require("optimist"),
    shapefile = require("shapefile"),
    queue = require("d3-queue").queue,
    topojson = require("../");

require("d3-geo-projection")(d3);

var filterModes = ["none", "small", "small-detached"];

var argv = optimist
    .usage("Usage: \033[1mtopojson\033[0m [options] -- [file …]\n\n"

+ "Version: " + topojson.version + "\n\n"

+ "Converts the specified input shapefile, GeoJSON or TopoJSON objects to\n"
+ "TopoJSON, outputting a single TopoJSON topology object. The `objects`\n"
+ "property of the output topology is a map from input file name to geometry\n"
+ "object.")

    .options("o", {
      alias: "out",
      describe: "output TopoJSON file name",
      default: "-"
    })
    .options("q", {
      alias: "quantization",
      describe: "convenience option for setting pre- and post-quantization",
      default: undefined
    })
    .options("q0", {
      alias: "pre-quantization",
      describe: "maximum number of differentiable points along either dimension",
      default: 1e6
    })
    .options("q1", {
      alias: "post-quantization",
      describe: "maximum number of differentiable points along either dimension",
      default: 1e4
    })
    .options("s", {
      alias: "simplify",
      describe: "area threshold for simplification (steradians for spherical coordinates)",
      default: 0
    })
    .options("simplify-proportion", {
      describe: "proportion of points to retain for simplification",
      default: 0
    })
    .options("cartesian", {
      describe: "assume Cartesian input coordinates",
      type: "boolean",
      default: false
    })
    .options("spherical", {
      describe: "assume spherical input coordinates",
      type: "boolean",
      default: false
    })
    .options("force-clockwise", {
      describe: "force clockwise exterior rings and counterclockwise interior rings",
      type: "boolean",
      default: true
    })
    .options("stitch-poles", {
      describe: "splice antimeridian cuts for polygons that encompass a pole",
      type: "boolean",
      default: true
    })
    .options("filter", {
      describe: "which rings to remove after simplifying; one of {" + filterModes.join(",") + "}",
      type: "string",
      default: "small-detached"
    })
    .options("allow-empty", {
      describe: "deprecated; use --filter=none instead",
      type: "boolean",
      default: false
    })
    .options("id-property", {
      describe: "name of feature property to promote to geometry id",
      default: null
    })
    .options("p", {
      alias: "properties",
      describe: "feature properties to preserve; no name preserves all properties",
      default: false
    })
    .options("e", {
      alias: "external-properties",
      describe: "CSV or TSV file to join properties (by id) to output features"
    })
    .options("shapefile-encoding", {
      describe: "character encoding for reading shapefile properties",
      default: null
    })
    .options("ignore-shapefile-properties", {
      describe: "skip reading shapefile properties (.dbf) for faster performance",
      type: "boolean",
      default: false
    })
    .options("x", {
      alias: "longitude",
      describe: "name of the x (longitude) property for CSV or TSV geometry input",
      default: "longitude"
    })
    .options("y", {
      alias: "latitude",
      describe: "name of the y (latitude) property for CSV or TSV geometry input",
      default: "latitude"
    })
    .options("projection", {
      describe: "name of a projection to apply (implies spherical input)",
      default: null
    })
    .options("width", {
      describe: "scale and translate to fit a viewport of the specified width",
      default: null
    })
    .options("height", {
      describe: "scale and translate to fit a viewport of the specified height",
      default: null
    })
    .options("margin", {
      describe: "pixels of margin to reserve when scaling to fit a viewport",
      default: 0
    })
    .options("invert", {
      describe: "in conjunction with --width or --height, whether to invert y",
      type: "boolean",
      default: "auto"
    })
    .options("bbox", {
      describe: "include bbox property in generated topology",
      type: "boolean",
      default: false
    })
    .options("help", {
      describe: "display this helpful message",
      type: "boolean",
      default: false
    })
    .options("version", {
      describe: "print the version number and exit",
      type: "boolean",
      default: false
    })
    .check(function(argv) {
      if (argv.help) return;
      if (argv.version) return process.stdout.write(topojson.version + "\n"), process.exit(0);
      if (!argv._.length) argv._ = ["-"];
      if (+argv.s && +argv["simplify-proportion"]) throw new Error("--simplify and --simplify-proportion are exclusive");
      if (+argv["simplify-proportion"] < 0 || +argv["simplify-proportion"] >= 1) throw new Error("--simplify-proportion must be between 0 and 1");
      if (argv["allow-empty"]) argv.filter = "none";
      if (argv.projection) argv.spherical = false, argv.cartesian = true, argv.projection = new Function("d3", "return " + argv.projection)(d3);
      if (argv.cartesian && argv.spherical) throw new Error("--spherical and --cartesian are exclusive");
      if (argv.spherical && (+argv.width || +argv.height)) throw new Error("--width and --height requires Cartesian coordinates");
      if (argv.invert === "auto") argv.invert = !argv.projection;
      if (filterModes.indexOf(argv.filter) < 0) throw new Error("unknown --filter value: " + argv.filter);
      if (typeof argv.p === "string") argv.p = argv.p.split(",");
      if (argv.q !== undefined) argv.q0 = argv.q1 = argv.q;
      argv.width = +argv.width;
      argv.height = +argv.height;
      argv.margin = +argv.margin;
    })
    .argv;

if (argv.help) return optimist.showHelp();

var objects = {},
    id = argv["id-property"];

// Create a property-to-identifier function.
id = id == null
    ? function(d) { return d.id; }
    : parsePropertyId(typeof id === "string" ? id.split(",") : id);

// Create the property transform function.
var propertyTransform = argv.p === true ? joinExternalProperties
    : argv.p === false ? function() {}
    : parsePropertyTransform(argv.p);

// Load any external properties.
var externalProperties = {};
if (typeof argv.e === "string") argv.e = [argv.e];
if (argv.e) argv.e.forEach(readExternalProperties);

// Create a map from basename to JSON object.
// Convert TopoJSON back to GeoJSON in preparation for merge, as needed.
var q = queue(1);
argv._.forEach(function(file) {
  q.defer(/\.shp$/i.test(file) ? inputShapefile
      : /\.csv$/i.test(file) ? inputDsv(d3.csv)
      : /\.tsv$/i.test(file) ? inputDsv(d3.tsv)
      : inputJson, file);
});
q.await(output);

function inputDsv(dsv) {
  return function(file, callback) {
    file = qualify(file);
    rw.readFile(file.path, "utf8", function(error, text) {
      if (error) return callback(error);

      objects[file.name] = {
        type: "FeatureCollection",
        features: dsv.parse(text).map(function(row) {
          var x = row[argv.x],
              y = row[argv.y];
          delete row[argv.x];
          delete row[argv.y];
          return {
            type: "Feature",
            id: id({id: row.id, properties: row}),
            properties: row,
            geometry: !x || !y || isNaN(x) || isNaN(y) ? null : {
              type: "Point",
              coordinates: [+x, +y]
            }
          };
        })
      };

      callback(null);
    });
  };
}

function inputShapefile(file, callback) {
  file = qualify(file);
  shapefile.read(file.path, {encoding: argv["shapefile-encoding"], "ignore-properties": !!argv["ignore-shapefile-properties"]}, function(error, collection) {
    if (error) return callback(error);
    objects[file.name] = collection;
    callback(null);
  });
}

function inputJson(file, callback) {
  file = qualify(file);

  var object = JSON.parse(rw.readFileSync(file.path, "utf8"));

  if (object.type === "Topology") {
    for (var key in object.objects) {
      objects[key] = topojson.feature(object, object.objects[key]);
    }
  } else {
    objects[file.name] = object;
  }

  callback(null);
}

function output(error) {
  if (error) throw error;

  var options = {
    "verbose": true,
    "pre-quantization": +argv.q0,
    "post-quantization": +argv.q1,
    "coordinate-system": argv.spherical ? "spherical" : argv.cartesian ? "cartesian" : "auto",
    "stitch-poles": argv["stitch-poles"],
    "id": id,
    "property-transform": propertyTransform,
    "minimum-area": +argv.s,
    "preserve-attached": argv.filter !== "small",
    "retain-proportion": +argv["simplify-proportion"],
    "force-clockwise": false
  };

  // Reproject (and force inputs to be clockwise before projecting, if needed).
  if (argv.projection) {
    if (!!argv["stitch-poles"]) topojson.stitch(objects);
    for (var key in objects) {
      if (!!argv["force-clockwise"]) topojson.clockwise(objects[key], {"verbose": true, "coordinate-system": "spherical"});
      objects[key] = d3.geo.project(objects[key], argv.projection);
    }
  }

  // Convert GeoJSON to TopoJSON.
  var object = topojson.topology(objects, options);

  // Clear the input objects hash to allow garbage collection.
  objects = null;

  // Translate and scale to fit the viewport.
  if (argv.width || argv.height) {
    if (options["coordinate-system"] !== "cartesian") throw new Error("--width and --height require Cartesian coordinates");
    topojson.scale(object, {
      width: argv.width,
      height: argv.height,
      margin: argv.margin,
      invert: argv.invert
    });
  }

  // Simplify.
  if (+argv.s > 0 || +argv["simplify-proportion"] > 0) topojson.simplify(object, options);

  // Force clockwise polygons, as appropriate.
  if (!!argv["force-clockwise"]) topojson.clockwise(object, options);

  // Remove empty (collapsed) features.
  if (argv["filter"] !== "none") topojson.filter(object, options);

  // Delete the bbox if not desired.
  if (!argv["bbox"]) delete object.bbox;

  // Output JSON.
  rw.writeFileSync(argv.o, JSON.stringify(object), "utf8");
}

function qualify(file) {
  var i = file.indexOf("=");
  return {
    name: i >= 0 ? file.substring(0, i) : path.basename(file, path.extname(file)),
    path: i >= 0 ? file.substring(i + 1) : file
  };
}

function parsePropertyExpression(property) {
  return new Function("d", "with(d.properties) return " + property);
}

function parsePropertyId(properties) {
  properties = properties.map(parsePropertyExpression);
  return function(d) {
    var id;
    properties.some(function(p) {
      try { id = p(d); } catch (e) { return; }
      if (typeof id === "number") return !isNaN(id);
      if (id != null) return id += "", true;
    });
    return id;
  };
}

function parsePropertyTransform(expressions) {
  var evaluators = {};

  expressions.forEach(function(target) {
    var i = target.indexOf("="),
        source = target;

    if (i >= 0) {
      source = target.substring(i + 1);
      target = target.substring(0, i);
    } else if (/^\+/.test(source)) {
      target = source.substring(1);
    }

    evaluators[target] = parsePropertyExpression(source);
  });

  return function(object) {
    var outputProperties = {};
    object.properties = joinExternalProperties(object);
    for (var key in evaluators) {
      try {
        outputProperties[key] = evaluators[key](object);
      } catch (ignore) {}
    }
    return outputProperties;
  };
}

function joinExternalProperties(object) {
  var objectId = id(object),
      objectExternals = objectId != null && externalProperties[objectId],
      objectProperties = object.properties || {};
  if (objectExternals) for (var key in objectExternals) objectProperties[key] = objectExternals[key];
  return objectProperties;
}

function readExternalProperties(file) {
  var text = rw.readFileSync(file, "utf8");

  // Infer the file type from the name.
  // If that doesn't work, look for a tab and hope for the best!
  var type = /\.tsv$/i.test(file) ? d3.tsv
        : /\.csv$/i.test(file) ? d3.csv
        : text.indexOf("\t") ? d3.tsv
        : d3.csv;

  type.parse(text).forEach(function(row) {
    var i = id({id: row.id, properties: row}), properties = externalProperties[i];
    if (properties) for (var key in row) properties[key] = row[key];
    else externalProperties[i] = row;
  });
}
