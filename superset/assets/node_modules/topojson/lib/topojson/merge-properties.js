module.exports = function() {
  var properties = undefined;

  return {
    merge: function(object) {
      var newProperties = object.properties;

      // If no properties have yet been merged,
      // then we need to initialize the merged properties object.
      if (properties === undefined) {

        // If the first set of properties is null, undefined or empty,
        // then the result of the merge will be the empty set.
        // Otherwise, the new properties can copied into the merged object.
        if (newProperties != null) for (var key in newProperties) {
          properties = {};
          for (var key in newProperties) properties[key] = newProperties[key];
          return;
        }

        properties = null;
        return;
      }

      // If any of the new properties are null or undefined,
      // then the result of the merge will be the empty set.
      if (newProperties == null) properties = null;
      if (properties === null) return;

      // Now mark as inconsistent any of the properties
      // that differ from previously-merged values.
      for (var key in newProperties) {
        if ((key in properties) && (properties[key] !== newProperties[key])) {
          properties[key] = undefined;
        }
      }

      // And mark as inconsistent any of the properties
      // that are missing from this new set of merged values.
      for (var key in properties) {
        if (!(key in newProperties)) {
          properties[key] = undefined;
        }
      }

      return object;
    },
    apply: function(object) {
      var hasProperties = false;

      // Delete any undefined values.
      for (var key in properties) {
        if (properties[key] === undefined) {
          delete properties[key];
        } else {
          hasProperties = true;
        }
      }

      if (hasProperties) object.properties = properties;
      else delete object.properties;

      // Reset the properties object for reuse.
      properties = undefined;

      return object;
    }
  };
};
