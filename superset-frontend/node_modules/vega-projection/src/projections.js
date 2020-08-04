import {
  geoAlbers,
  geoAlbersUsa,
  geoAzimuthalEqualArea,
  geoAzimuthalEquidistant,
  geoConicConformal,
  geoConicEqualArea,
  geoConicEquidistant,
  geoEqualEarth,
  geoEquirectangular,
  geoGnomonic,
  geoIdentity,
  geoMercator,
  geoNaturalEarth1,
  geoOrthographic,
  geoPath,
  geoStereographic,
  geoTransverseMercator
} from 'd3-geo';

import {
  geoMollweide
} from 'd3-geo-projection';

var defaultPath = geoPath();

export var projectionProperties = [
  // standard properties in d3-geo
  'clipAngle',
  'clipExtent',
  'scale',
  'translate',
  'center',
  'rotate',
  'parallels',
  'precision',
  'reflectX',
  'reflectY',

  // extended properties in d3-geo-projections
  'coefficient',
  'distance',
  'fraction',
  'lobes',
  'parallel',
  'radius',
  'ratio',
  'spacing',
  'tilt'
];

/**
 * Augment projections with their type and a copy method.
 */
function create(type, constructor) {
  return function projection() {
    var p = constructor();

    p.type = type;

    p.path = geoPath().projection(p);

    p.copy = p.copy || function() {
      var c = projection();
      projectionProperties.forEach(function(prop) {
        if (p[prop]) c[prop](p[prop]());
      });
      c.path.pointRadius(p.path.pointRadius());
      return c;
    };

    return p;
  };
}

export function projection(type, proj) {
  if (!type || typeof type !== 'string') {
    throw new Error('Projection type must be a name string.');
  }
  type = type.toLowerCase();
  if (arguments.length > 1) {
    projections[type] = create(type, proj);
    return this;
  } else {
    return projections[type] || null;
  }
}

export function getProjectionPath(proj) {
  return (proj && proj.path) || defaultPath;
}

var projections = {
  // base d3-geo projection types
  albers:               geoAlbers,
  albersusa:            geoAlbersUsa,
  azimuthalequalarea:   geoAzimuthalEqualArea,
  azimuthalequidistant: geoAzimuthalEquidistant,
  conicconformal:       geoConicConformal,
  conicequalarea:       geoConicEqualArea,
  conicequidistant:     geoConicEquidistant,
  equalEarth:           geoEqualEarth,
  equirectangular:      geoEquirectangular,
  gnomonic:             geoGnomonic,
  identity:             geoIdentity,
  mercator:             geoMercator,
  mollweide:            geoMollweide,
  naturalEarth1:        geoNaturalEarth1,
  orthographic:         geoOrthographic,
  stereographic:        geoStereographic,
  transversemercator:   geoTransverseMercator
};

for (var key in projections) {
  projection(key, projections[key]);
}
