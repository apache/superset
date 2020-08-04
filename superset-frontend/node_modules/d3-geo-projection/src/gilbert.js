import "math";

d3.geo.gilbert = function(projection) {
  var e = d3.geo.equirectangular().scale(degrees).translate([0, 0]);

  function gilbert(coordinates) {
    return projection([coordinates[0] * .5, asin(Math.tan(coordinates[1] * .5 * radians)) * degrees]);
  }

  if (projection.invert) gilbert.invert = function(coordinates) {
    coordinates = projection.invert(coordinates);
    coordinates[0] *= 2;
    coordinates[1] = 2 * Math.atan(Math.sin(coordinates[1] * radians)) * degrees;
    return coordinates;
  };

  gilbert.stream = function(stream) {
    stream = projection.stream(stream);
    var s = e.stream({
      point: function(λ, φ) {
        stream.point(λ * .5, asin(Math.tan(-φ * .5 * radians)) * degrees);
      },
      lineStart: function() { stream.lineStart(); },
      lineEnd: function() { stream.lineEnd(); },
      polygonStart: function() { stream.polygonStart(); },
      polygonEnd: function() { stream.polygonEnd(); }
    });
    s.sphere = function() { stream.sphere(); };
    s.valid = false;
    return s;
  };

  return gilbert;
};
