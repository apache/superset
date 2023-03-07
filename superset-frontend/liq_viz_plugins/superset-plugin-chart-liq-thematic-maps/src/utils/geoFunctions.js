const createGeoJSONRadius = (center, radius, nPoints) => {
  //source: https://stackoverflow.com/questions/37599561/drawing-a-circle-with-the-radius-in-miles-meters-with-mapbox-gl-js
  if (!nPoints) nPoints = 64;
  const coords = {latitude: center[1], longitude: center[0]};
  const distanceX = radius/(111.320 * Math.cos(coords.latitude * Math.PI / 180));
  const distanceY = radius/110.574;

  let ret = [];
  var theta, x, y;
  for(var i = 0; i < nPoints; i++) {
    theta = (i / nPoints) * (2 * Math.PI);
    x = distanceX * Math.cos(theta);
    y = distanceY * Math.sin(theta);
    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]);
  return {
    "type": 'FeatureCollection',
    "features": [{
      "type": 'Feature',
      "properties": {"id": 0},
      "geometry": {
        "type": 'Polygon',
        "coordinates": [ret]
      }
    }]
  }
};

module.exports = {
  createGeoJSONRadius
}