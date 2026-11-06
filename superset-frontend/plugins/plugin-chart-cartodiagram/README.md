<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

## @superset-ui/plugin-chart-cartodiagram

This plugin allows visualizing charts on a map. To do so, the plugin makes use of existing charts and renders them on the
provided locations.

Configuring the charts: Charts will be configured in their respective editors. So all configuration options of any chart are supported.

Configuring the map: For the map, an arbitrary number of background layers (WMS, WFS, XYZ), the initial map extent, the chart background color and border radius, as well as the chart size (per zoom level) can be configured.

### Usage

The plugin is registered in `superset-frontend/src/visualizations/presets/MainPreset.js`.

```js
import { CartodiagramPlugin } from '@superset-ui/plugin-chart-cartodiagram';

new CartodiagramPlugin().configure({ key: 'cartodiagram' }).register();
```

### Configuration

The plugin is configured in `superset_config.py`. The settings are passed to the frontend as bootstrap data.

#### `MAP_DEFAULT_LAYERS`

A list of layers that are added to each new chart by default (editors can remove them). Supported layer types are `WMS`, `WFS` and `XYZ`.
See `./src/types.ts` for the definitions of `WmsLayerConf`, `WfsLayerConf` and `XyzLayerConf`.

Example for an XYZ default layer:

```python
MAP_DEFAULT_LAYERS = [
    {
        "type": "XYZ",
        "url": "example.com/path/to/xyz/layer",
        "title": "my default layer title",
        "attribution": "my default layer attribution",
    },
]
```

Please note that by default, Superset rejects requests to third-party domains. If you want to include
layers from those, you have to adjust the CSP settings. See also docs/admin_docs/security/security.mdx.

**Deprecated:** passing `defaultLayers` to the `CartodiagramPlugin` constructor in `MainPreset.js` still works, but logs a
console warning and takes precedence over `MAP_DEFAULT_LAYERS`. Move such layers to `MAP_DEFAULT_LAYERS`.

#### `MAP_PROJECTIONS`

A mapping of `EPSG:<code>` to a Proj.4 definition. Only `EPSG:3857` and `EPSG:4326` are available without it.
Register every other projection used by your EWKB/EWKT geometries (see below). Definitions can be found in the Proj.4 section of https://epsg.io.

```python
MAP_PROJECTIONS = {
    "EPSG:25832": (
        "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m "
        "+no_defs +type=crs"
    ),
}
```

#### `MAP_GEOSTYLER_COMPOSITION`

Controls which fields are visible in the GeoStyler style editors used for layer styling. Use it to hide fields that are not
relevant for your use case:

```python
MAP_GEOSTYLER_COMPOSITION = {
    "FillEditor": {
        "opacityField": {
            "visibility": False,
        },
    },
}
```

For the available editors and fields, see the
[GeoStylerContext](https://github.com/geostyler/geostyler/blob/main/src/context/GeoStylerContext/GeoStylerContext.tsx#L36).

### Geometry Column

The plugin requires the selection of a geometry column and its format for a dataset:

- **GeoJSON** (default): a GeoJSON geometry string in WGS 84 (EPSG:4326).
- **EWKB**: a hex-encoded string. The SRID is read from the data. If it is not `EPSG:3857` or `EPSG:4326`, the projection has to be
  registered via `MAP_PROJECTIONS`, otherwise the coordinates are not reprojected.
- **EWKT**: a WKT string with an optional `SRID=<code>;` prefix, e.g. `SRID=25832;POINT(363000 5621000)`. Without a prefix,
  EPSG:4326 is assumed. A non-default SRID has to be registered via `MAP_PROJECTIONS`.

Rows with malformed or empty geometries are skipped.
