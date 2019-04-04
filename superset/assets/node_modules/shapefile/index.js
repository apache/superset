var shp = require("./shp"),
    dbf = require("./dbf");

exports.version = require("./package.json").version;
exports.read = read;
exports.reader = reader;

var readInternal = require("./read")(reader);

function read(filename, options, callback) {
  if (arguments.length < 3) callback = options, options = null;
  readInternal(filename, options, function(error, header, records) {
    if (error) return callback(error);
    callback(null, {
      type: "FeatureCollection",
      bbox: header.bbox,
      features: records
    });
  });
}

function reader(filename, options) {
  var convertProperties,
      convertGeometry,
      encoding = null,
      ignoreProperties = false,
      dbfReader,
      shpReader;

  if (typeof options === "string") options = {encoding: options};

  if (options)
    "encoding" in options && (encoding = options["encoding"]),
    "ignore-properties" in options && (ignoreProperties = !!options["ignore-properties"]);

  if (/\.shp$/.test(filename)) filename = filename.substring(0, filename.length - 4);

  if (!ignoreProperties) dbfReader = dbf.reader(filename + ".dbf", encoding);
  shpReader = shp.reader(filename + ".shp");

  function readHeader(callback) {
    dbfReader.readHeader(function(error, header) {
      if (header === end) error = new Error("unexpected EOF");
      if (error) return callback(error);
      convertProperties = new Function("d", "return {"
          + header.fields.map(function(field, i) { return JSON.stringify(field.name) + ":d[" + i + "]"; })
          + "};");
      readShpHeader(callback);
    });
    return this;
  }

  function readShpHeader(callback) {
    shpReader.readHeader(function(error, header) {
      if (header === end) error = new Error("unexpected EOF");
      if (error) return callback(error);
      convertGeometry = convertGeometryTypes[header.shapeType];
      callback(null, {bbox: header.box});
    });
    return this;
  }

  function readRecord(callback) {
    dbfReader.readRecord(function(error, dbfRecord) {
      if (dbfRecord === end) return callback(null, end);
      if (error) return callback(error);
      shpReader.readRecord(function(error, shpRecord) {
        if (shpRecord === end) error = new Error("unexpected EOF");
        if (error) return callback(error);
        callback(null, {
          type: "Feature",
          properties: convertProperties(dbfRecord),
          geometry: shpRecord == null ? null : convertGeometry(shpRecord)
        });
      });
    });
    return this;
  }

  function readShpRecord(callback) {
    shpReader.readRecord(function(error, shpRecord) {
      if (shpRecord === end) return callback(null, end);
      if (error) return callback(error);
      callback(null, {
        type: "Feature",
        properties: {},
        geometry: shpRecord == null ? null : convertGeometry(shpRecord)
      });
    });
    return this;
  }

  function close(callback) {
    dbfReader.close(function(error) {
      if (error) return callback(error);
      closeShp(callback);
    });
    return this;
  }

  function closeShp(callback) {
    shpReader.close(callback);
    return this;
  }

  return dbfReader ? {
    readHeader: readHeader,
    readRecord: readRecord,
    close: close
  } : {
    readHeader: readShpHeader,
    readRecord: readShpRecord,
    close: closeShp
  };
}

var end = exports.end = shp.end;

var convertGeometryTypes = {
  1: convertPoint,
  3: convertPolyLine,
  5: convertPolygon,
  8: convertMultiPoint,
  11: convertPoint, // PointZ
  13: convertPolyLine, // PolyLineZ
  15: convertPolygon, // PolygonZ
  18: convertMultiPoint // MultiPointZ
};

function readEmptyNextProperties(callback) {
  callback(null, {});
}

function convertPoint(record) {
  return {
    type: "Point",
    coordinates: [record.x, record.y]
  };
}

function convertPolyLine(record) {
  return record.parts.length === 1 ? {
    type: "LineString",
    coordinates: record.points
  } : {
    type: "MultiLineString",
    coordinates: record.parts.map(function(i, j) {
      return record.points.slice(i, record.parts[j + 1]);
    })
  };
}

function convertPolygon(record) {
  var parts = record.parts.map(function(i, j) { return record.points.slice(i, record.parts[j + 1]); }),
      polygons = [],
      holes = [];

  parts.forEach(function(part) {
    if (ringClockwise(part)) polygons.push([part]);
    else holes.push(part);
  });

  holes.forEach(function(hole) {
    var point = hole[0];
    polygons.some(function(polygon) {
      if (ringContains(polygon[0], point)) {
        polygon.push(hole);
        return true;
      }
    }) || polygons.push([hole]);
  });

  return polygons.length > 1
      ? {type: "MultiPolygon", coordinates: polygons}
      : {type: "Polygon", coordinates: polygons[0]};
}

function convertMultiPoint(record) {
  return {
    type: "MultiPoint",
    coordinates: record.points
  };
}

function ringClockwise(ring) {
  if ((n = ring.length) < 4) return false;
  var i = 0,
      n,
      area = ring[n - 1][1] * ring[0][0] - ring[n - 1][0] * ring[0][1];
  while (++i < n) area += ring[i - 1][1] * ring[i][0] - ring[i - 1][0] * ring[i][1];
  return area >= 0;
}

function ringContains(ring, point) {
  var x = point[0],
      y = point[1],
      contains = false;
  for (var i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    var pi = ring[i], xi = pi[0], yi = pi[1],
        pj = ring[j], xj = pj[0], yj = pj[1];
    if (((yi > y) ^ (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) contains = !contains;
  }
  return contains;
}
