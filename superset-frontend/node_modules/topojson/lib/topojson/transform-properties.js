// Given a hash of GeoJSON objects, transforms any properties on features using
// the specified transform function. If no properties are propagated to the new
// properties hash, the properties hash will be deleted.
module.exports = function(objects, propertyTransform) {
  if (arguments.length < 2) propertyTransform = function() {};

  function transformObject(object) {
    if (object && transformObjectType.hasOwnProperty(object.type)) transformObjectType[object.type](object);
  }

  function transformFeature(feature) {
    if (feature.properties == null) feature.properties = {};
    var properties = feature.properties = propertyTransform(feature);
    if (properties) for (var key in properties) return;
    delete feature.properties;
  }

  var transformObjectType = {
    Feature: transformFeature,
    FeatureCollection: function(collection) { collection.features.forEach(transformFeature); }
  };

  for (var key in objects) {
    transformObject(objects[key]);
  }

  return objects;
};
