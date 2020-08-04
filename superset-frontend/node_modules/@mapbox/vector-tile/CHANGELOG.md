## vector-tile-js changelog

### 1.3.1 (2017-03-02)

- Fix bug causing infinite loop when parsing ClosePath command (#61) h/t @sanjin-saric
- Pin node-mapnik dependency to `~3.6.0` (#62, see also https://github.com/mapnik/node-mapnik/issues/848)

### 1.3.0 (2016-07-18)

- Added "id" property to VectorTileFeature (#43)

### 1.2.1 (2016-05-18)

- Fixed geometry structure of MultiPoints, Polygons, and MultiPolygons in toGeoJSON()

### 1.2.0 (2015-12-10)

- Added "id" property to toGeoJSON() output

### 1.1.3 (2015-06-15)

- Workaround for https://github.com/mapbox/mapnik-vector-tile/issues/90

### 1.1.2 (2015-03-05)

- Fixed decoding of negative values in feature properties

### 1.1.1 (2015-02-25)

- Remove sphericalmercator dependency
- Correctly handle MultiPoint and MultiLineString features in toGeoJSON()

### 1.1.0 (2015-02-21)

- Added VectorTileFeature#toGeoJSON()

### 1.0.0 (2014-12-26)

### 0.0.1 (2014-04-13)

- Initial release
