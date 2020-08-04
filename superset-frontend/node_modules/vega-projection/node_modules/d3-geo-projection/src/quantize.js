export default function(input, digits) {
  if (!(0 <= (digits = +digits) && digits <= 20)) throw new Error("invalid digits");

  function quantizePoint(input) {
    var n = input.length, i = 2, output = new Array(n);
    output[0] = +input[0].toFixed(digits);
    output[1] = +input[1].toFixed(digits);
    while (i < n) output[i] = input[i], ++i;
    return output;
  }

  function quantizePoints(input) {
    return input.map(quantizePoint);
  }

  function quantizePointsNoDuplicates(input) {
    var point0 = quantizePoint(input[0]);
    var output = [point0];
    for (var i = 1; i < input.length; i++) {
      var point = quantizePoint(input[i]);
      if (point.length > 2 || point[0] != point0[0] || point[1] != point0[1]) {
        output.push(point);
        point0 = point;
      }
    }
    if (output.length === 1 && input.length > 1) {
      output.push(quantizePoint(input[input.length - 1]));
    }
    return output;
  }

  function quantizePolygon(input) {
    return input.map(quantizePointsNoDuplicates);
  }

  function quantizeGeometry(input) {
    if (input == null) return input;
    var output;
    switch (input.type) {
      case "GeometryCollection": output = {type: "GeometryCollection", geometries: input.geometries.map(quantizeGeometry)}; break;
      case "Point": output = {type: "Point", coordinates: quantizePoint(input.coordinates)}; break;
      case "MultiPoint": output = {type: input.type, coordinates: quantizePoints(input.coordinates)}; break;
      case "LineString": output = {type: input.type, coordinates: quantizePointsNoDuplicates(input.coordinates)}; break;
      case "MultiLineString": case "Polygon": output = {type: input.type, coordinates: quantizePolygon(input.coordinates)}; break;
      case "MultiPolygon": output = {type: "MultiPolygon", coordinates: input.coordinates.map(quantizePolygon)}; break;
      default: return input;
    }
    if (input.bbox != null) output.bbox = input.bbox;
    return output;
  }

  function quantizeFeature(input) {
    var output = {type: "Feature", properties: input.properties, geometry: quantizeGeometry(input.geometry)};
    if (input.id != null) output.id = input.id;
    if (input.bbox != null) output.bbox = input.bbox;
    return output;
  }

  if (input != null) switch (input.type) {
    case "Feature": return quantizeFeature(input);
    case "FeatureCollection": {
      var output = {type: "FeatureCollection", features: input.features.map(quantizeFeature)};
      if (input.bbox != null) output.bbox = input.bbox;
      return output;
    }
    default: return quantizeGeometry(input);
  }

  return input;
}
