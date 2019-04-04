import { MAPBOX_LIMITS } from './map-state';

function decapitalize(s) {
  return s[0].toLowerCase() + s.slice(1);
} // Checks a visibilityConstraints object to see if the map should be displayed
// Returns true if props are within the constraints


export function checkVisibilityConstraints(props) {
  var constraints = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : MAPBOX_LIMITS;

  for (var constraintName in constraints) {
    // in the format of min* or max*
    var type = constraintName.slice(0, 3);
    var propName = decapitalize(constraintName.slice(3));

    if (type === 'min' && props[propName] < constraints[constraintName]) {
      return false;
    }

    if (type === 'max' && props[propName] > constraints[constraintName]) {
      return false;
    }
  }

  return true;
}
//# sourceMappingURL=map-constraints.js.map