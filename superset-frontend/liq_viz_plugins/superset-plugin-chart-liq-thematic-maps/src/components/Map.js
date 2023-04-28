/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useEffect, createRef, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { getSequentialSchemeRegistry } from '@superset-ui/core';

import entity from '../../../liq_data/entity.json';

const defaults = require('../defaultLayerStyles.js');

const iconsSVG = require('../iconSVG.js');

const liqSecrets = require('../../../liq_secrets.js').liqSecrets;
const layerStyles = defaults.defaultLayerStyles;
const iconExprs = defaults.iconExprs;

mapboxgl.accessToken = liqSecrets.mapbox.accessToken;

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

function Map(props, ref) {
  const {
    data, // from databricks/other databases
    groupCol, // index col i.e. SA1 code, entity_id, etc.
    metricCol, // thematic col i.e. Population, a calculated column, GLA, etc.
    height,
    width,
    mapType, // type of map, can be one or more of thematic, trade_area and intranet
    mapStyle, // Mapbox "base map" style, i.e. Streets, Light, etc.
    boundary, // boundary layer for the map, i.e. SA1, POA, etc.
    intranetLayers, // list of intranet layers, i.e. shopping centres, supermarkets, etc.
    linearColorScheme, // color palette for thematic
    breaksMode, // how to break up data
    customMode, // if breaksMode is "custom", user defined breaks 
    numClasses, // number of classes for breaks, i.e. number of ranges
    opacity, // opacity value for thematic
    tradeAreas, // trade area data if any
    tradeAreaSA1s, // trade area SA1 data
    taSectorCentroids, // geojson file for sector centroid points, used to label them in a symbol layer
    intranetData, // data relating to intranet layers
    latitude, // starting lat
    longitude, // starting lng
    zoom, // starting zoom
    taLoc, // location of primary sector centroid of first TA
    newRadiusColor, // color of radius in rgba
    newRadiusBorderColor, // color of radius border in rgba
    radiusBorderWidth, // stroke width of radius border
    newDrivetimeColor, // color of drivetime in rgba
    newDrivetimeBorderColor, // color of drivetime border in rgba
    drivetimeBorderWidth, // stroke width of drivetime border
    newIntersectSa1Color,
    intersectSa1Width,
    mapID, // id of map,
    setDrawerOpen
  } = props;

  const map = useRef(null);
  let hovered = useRef({});

  const mapDivStyle = {
    height: height,
    width: '100%',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0
  }

  const [currBdryIDs, setCurrBdryIDs] = useState([]); // currently rendered boundary tiles
  const [currTileIDs, setCurrTileIDs] = useState([]); // currently rendered intranet tiles
  const [colorMap, setColorMap] = useState({}); // color map based on data via cmap lambda
  const [mapPos, setMapPos] = useState({ lng: longitude, lat: latitude, zoom: zoom });

  /*
    State used to store the names of intranet layers currently rendered onto the map. Since the control
    for adding or removing intranet layers to the map is instantaneous, we need to store state for
    currently rendered layers to manage that
  */
  const [renderedIntranetLayers, setRenderedIntranetLayers] = useState([]);

  // Get the tile IDs and data values for all currently rendered boundary tiles
  const getCurrTileIds = (source) => {
    const bdry_features = map.current.querySourceFeatures(source, {
      sourceLayer: boundary
    });
    let bdryIds = [];
    for (const d in bdry_features) {
      bdryIds.push({
        id: bdry_features[d].id,
        val: bdry_features[d].properties[groupCol],
        metric: bdry_features[d].properties[metricCol]
      });
    }
    return bdryIds;
  }

  // Custom geocoding function for local entity data. Performs just a simple substring search for now
  const forwardGeocoder = (query) => {
    const matchingFeatures = [];
    for (const feature of entity.features) {
      if (feature.properties.name.toLowerCase().includes(query.toLowerCase())) {
        feature['place_name'] = feature.properties.name;
        feature['center'] = feature.geometry.coordinates;
        feature['local'] = true;
        matchingFeatures.push(feature)
      }
    }
    return matchingFeatures;
  }

  // Loads each layer in "layers" onto the map with the default intranet layer styling
  const loadIntranetLayers = (layers) => {
    layers.forEach(l => {
      map.current.addLayer({
        'id': l,
        'type': 'symbol',
        'source': 'intranet_tileset',
        'source-layer': l,
        'layout': {
          'icon-image': iconExprs[l],
          'icon-allow-overlap': true
        }
      });
      map.current.on('mouseenter', l, () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', l, () => {
        map.current.getCanvas().style.cursor = '';
      });
      map.current.on('click', l, (e) => {
        const data = [];
        e.features.map(d => {
          const id = 'entity_id' in d.properties ? d.properties.entity_id : d.properties.tenancy_id;
          if (d.layer.id in intranetData && id in intranetData[d.layer.id]) data.push(intranetData[d.layer.id][id]);
        });
        if (data.length === 0) e.features.map(d => data.push(d.properties));
        setDrawerTitle('Data');
        setDrawerContent(<DataDisplay data={data} />);
        setDrawerOpen(true);
      });
    });
  };

  /*
    Initializes the map. The initialization process consists of:
    1. Instantiating a new Map with the ref to the map container, the map style defined in "mapStyle",
       the current map center defined in "mapPos" and the current map zoom defined in "mapPos"
    2. Setting the projection to flat map mercator and disabling rotation controls
    3. Instantiating and adding the geocoder with custom search functionality to the map
    4. Loading all required icons into the map
    5. Defining the map on load event to add the boundary and intranet tile sources to the map and adding the
       boundary and intranet layers with styling to the map
    6. Defining the map on data event to update the current data tileset IDs and values in state
    7. Defining the map on move event to update the current map postition in state
  */
  const initMap = () => {

    map.current = new mapboxgl.Map({
      container: mapID,
      style: mapStyle ? mapStyle : 'mapbox://styles/mapbox/streets-v12',
      center: [mapPos.lng, mapPos.lat],
      zoom: mapPos.zoom
    });

    // Flat map projection
    map.current.setProjection('mercator');

    // Disable rotating
    map.current.dragRotate.disable();
    map.current.touchZoomRotate.disableRotation();

    // Add geocoder with custom local geocoding and dropdown render
    map.current.addControl(
      new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        countries: 'au',
        marker: {
          color: '#BB1431'
          // element: geocodeMarker
        },
        localGeocoder: forwardGeocoder,
        minLength: 3,
        limit: 10,
        // Define custom render with LIQ pins on the side of the dropdown to distinguish local results
        render: (item) => {
          const src = item.local ?
            '/static/liq_pin_geocode_result.svg' :
            item.properties.maki ?
              `https://unpkg.com/@mapbox/maki@6.1.0/icons/${item.properties.maki}-15.svg` :
              'https://unpkg.com/@mapbox/maki@6.1.0/icons/marker-15.svg';
          return `
            <div class='geocoder-dropdown-item'>
              <img class='geocoder-dropdown-icon' src='${src}' width=24 height=24 />
              <span class='geocoder-dropdown-text'>
                ${item.place_name}
              </span>
            </div>
          `
        },
        collapsed: true
      })
    );

    // Add scale control
    map.current.addControl(new mapboxgl.ScaleControl);

    // Add zoom control
    map.current.addControl(new mapboxgl.NavigationControl);

    // Add location tracker
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      })
    )

    // load marker image
    map.current.loadImage('/static/custom_map_marker.png', (error, img) => {
      if (error) throw error;
      map.current.addImage('marker', img);
    });

    // Load all CSS icon images
    Object.keys(iconsSVG).map(k => {
      map.current.addImage(k, iconsSVG[k]);
    })

    // Load map tiles and their default styles
    map.current.on('load', () => {

      if (tradeAreas && tradeAreas.length > 0) map.current.flyTo({
        center: taLoc,
        zoom: 12,
        essential: true
      });

      map.current.addSource('boundary_tileset', {
        'type': 'vector',
        'url': liqSecrets.mapbox.tilesets.boundary
      });

      map.current.addSource('intranet_tileset', {
        'type': 'vector',
        'url': liqSecrets.mapbox.tilesets.intranet
      });

      map.current.addSource('trade_area_sector_centroids', {
        'type': 'geojson',
        'data': taSectorCentroids
      });

      map.current.addLayer({
        'id': 'boundary_tileset',
        'type': 'fill',
        'source': 'boundary_tileset',
        'source-layer': boundary,
        'layout': {},
        'paint': { ...layerStyles.boundaryStyle, 'fill-opacity': opacity }
      });

      if (mapType.includes('trade_area')) {
        tradeAreas.map(ta => {
          map.current.addLayer({
            'id': ta,
            'type': 'fill',
            'source': 'boundary_tileset',
            'source-layer': boundary,
            'layout': {},
            'paint': {
              'fill-color': [
                'case',
                ['==', ['feature-state', ta], null],
                'transparent',
                ['feature-state', ta]
              ]
            }
          });
          map.current.addLayer({
            'id': `${ta}_outline`,
            'type': 'line',
            'source': 'boundary_tileset',
            'source-layer': boundary,
            'paint': {
              'line-color': [
                'case',
                ['==', ['feature-state', ta], null],
                'transparent',
                newIntersectSa1Color
              ],
              'line-width': [
                'case',
                ['==', ['feature-state', ta], null],
                0,
                parseFloat(intersectSa1Width)
              ]
            },
            filter: ['in', ['get', groupCol], ['literal', Object.keys(tradeAreaSA1s)]]
          });
          map.current.addLayer({
            'id': `${ta}_sector_labels`,
            'type': 'symbol',
            'source': 'trade_area_sector_centroids',
            'layout': {
              'text-field': ['get', 'label'],
              'text-variable-anchor': ['right', 'left', 'top', 'bottom'],
              'text-radial-offset': 1,
              'text-justify': 'auto',
              'text-allow-overlap': true,
              'text-size': 12
            },
            'paint': {
              'text-color': '#000000',
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 1,
              'text-halo-blur': 0
            },
            'filter': ['==', ['get', 'centre'], ta]
          });
        })
      }

      loadIntranetLayers(intranetLayers ? intranetLayers : []);
      setRenderedIntranetLayers(intranetLayers ? [...intranetLayers] : []);

    });

    map.current.on('mousemove', 'boundary_tileset', (e) => {
      if (e.features.length > 0) {
        if (hovered.current['boundary_tileset'] !== null && typeof hovered.current['boundary_tileset'] === 'number') {
          map.current.setFeatureState(
            {
              source: 'boundary_tileset',
              sourceLayer: boundary,
              id: hovered.current['boundary_tileset']
            },
            { hover: false }
          );
        }
      }
      hovered.current['boundary_tileset'] = e.features[0].id;
      map.current.setFeatureState(
        {
          source: 'boundary_tileset',
          sourceLayer: boundary,
          id: hovered.current['boundary_tileset']
        },
        { hover: true }
      );
    });

    map.current.on('mouseleave', 'boundary_tileset', () => {
      if (hovered.current['boundary_tileset'] !== null) {
        map.current.setFeatureState(
          {
            source: 'boundary_tileset',
            sourceLayer: boundary,
            id: hovered.current['boundary_tileset']
          },
          { hover: false }
        );
      }
    });

    // When the map is moved around, store current position in state
    map.current.on('move', () => {
      const { lng, lat } = map.current.getCenter();
      const zoom = map.current.getZoom().toFixed(2);
      const newMapPos = {
        lng: lng.toFixed(4),
        lat: lat.toFixed(4),
        zoom: zoom
      };
      setMapPos({ ...newMapPos });
    });

    // When the map reveices new tile data, get rendered tile features and store them in state for styling
    map.current.on('data', () => {
      if (mapType.includes('thematic') || mapType.includes('trade_area')) {
        const bdryIds = getCurrTileIds('boundary_tileset');
        setCurrBdryIDs([...bdryIds]);
      }
      if (mapType.includes('intranet')) {
        const tileIds = getCurrTileIds('intranet_tileset');
        setCurrTileIDs([...tileIds]);
      }
    });

    // When custom tileset is clicked
    map.current.on('mouseenter', 'custom_tileset', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'custom_tileset', () => {
      map.current.getCanvas().style.cursor = '';
    });
    map.current.on('click', 'custom_tileset', (e) => {
      const data = e.features.map(d => d.properties);
      setDrawerTitle('Data');
      setDrawerContent(<DataDisplay data={data} />);
      setDrawerOpen(true);
    });
  }

  useImperativeHandle(ref, () => ({
    getMap: () => map.current
  }));

  // Force main map initialization hook to trigger, essentially instigating a reload
  const instigateReload = () => {
    map.current.remove();
    map.current = null;
  }

  // When color map settings change, update state and map
  useEffect(() => {

    if (!mapType.includes('thematic')) return;

    setColorMap({});

    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');

    const colors = getSequentialSchemeRegistry().get(linearColorScheme).colors;
    const initParams = {
      'colors': colors,
      'cmap_type': breaksMode,
      'values': data.map(d => d[metricCol]),
      'secret': liqSecrets.lambdaFunctions.cMap.secret
    }
    var raw;

    if (breaksMode === 'custom') {
      raw = JSON.stringify({
        ...initParams,
        'breaks': customMode,
        'n_classes': numClasses
      })
    } else if (breaksMode === 'categorized') {
      raw = JSON.stringify(initParams)
    } else {
      raw = JSON.stringify({
        ...initParams,
        'n_classes': numClasses
      })
    }

    var raw = (!breaksMode || breaksMode === 'custom') ? JSON.stringify({
      'colors': getSequentialSchemeRegistry().get(linearColorScheme).colors,
      'breaks': customMode,
      'values': data.map(d => d[metricCol]),
      'n_classes': numClasses,
      'cmap_type': 'custom',
      'secret': liqSecrets.lambdaFunctions.cMap.secret
    }) : JSON.stringify({
      'colors': getSequentialSchemeRegistry().get(linearColorScheme).colors,
      'values': data.map(d => d[metricCol]),
      'n_classes': numClasses,
      'cmap_type': breaksMode,
      'secret': liqSecrets.lambdaFunctions.cMap.secret
    });

    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    }

    fetch(liqSecrets.lambdaFunctions.cMap.url, requestOptions)
      .then(response => response.json())
      .then(result => {
        var cMap = {};
        data.forEach((d, i) => {
          cMap[d[groupCol]] = result.colors[i]
        });
        setColorMap({ ...cMap });
        setThematicLegend({ ...result.breaks });
      });
  }, [linearColorScheme, breaksMode, customMode, numClasses, data])

  // Make sure map is always resized relative to parent container
  useEffect(() => {
    if (!map.current) return;
    map.current.resize();
  }, [width, height])

  // Refresh map from scratch everytime there is new data or the base style is changed
  useEffect(() => {
    setDrawerOpen(false);
    if (map.current) instigateReload();
  }, [data, mapStyle])

  // Add or remove intranet layers in real time
  useEffect(() => {
    if (!map.current) return;
    renderedIntranetLayers.forEach(l => {
      map.current.removeLayer(l);
    });
    setDrawerOpen(false);
    loadIntranetLayers(intranetLayers);
    setRenderedIntranetLayers([...intranetLayers]);
  }, [intranetLayers])

  // Main map initialization hook
  useEffect(() => {
    if (map.current) return;
    initMap();
  });

  // Hook for styling rendered tiles via feature state, triggered whenever new tiles are rendered
  useEffect(() => {
    if (!map.current.isStyleLoaded()) return;
    for (const i in currBdryIDs) {
      let state = {
        color: colorMap[currBdryIDs[i].val],
        metric: currBdryIDs[i].metric
      }
      const taData = tradeAreaSA1s[currBdryIDs[i].val];
      if (taData) {
        for (const centre of Object.keys(taData)) {
          state[centre] = taData[centre].colour;
          state[`${centre} Sector`] = taData[centre].sector;
        }
      }
      map.current.setFeatureState(
        {
          source: 'boundary_tileset',
          sourceLayer: boundary,
          id: currBdryIDs[i].id
        },
        { ...state }
      );
    }
    if (map.current.getLayer('boundary_tileset')) map.current.setPaintProperty('boundary_tileset', 'fill-opacity', opacity);
  }, [currBdryIDs, colorMap]);

  useEffect(() => {
    if (!map.current.isStyleLoaded()) return;
    for (const x of currTileIDs) {
      intranetLayers.map(l => {
        if (l in intranetData && x.val in intranetData[l]) map.current.setFeatureState(
          {
            source: 'intranet_tileset',
            sourceLayer: l,
            id: x.id
          },
          { ...intranetData[l][x.val] }
        )
      })
    }
  }, [currTileIDs])

  // Hook for changing opacity in real time
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    map.current.setPaintProperty('boundary_tileset', 'fill-opacity', opacity);
  }, [opacity])

  // Hooks for applying radius style settings in real time
  useEffect(() => {
    if (map.current.isStyleLoaded() && 'radius' in map.current.getStyle().sources) {
      map.current.setPaintProperty('radius', 'fill-color', newRadiusColor);
      map.current.setPaintProperty('radius-outline', 'line-color', newRadiusBorderColor);
      map.current.setPaintProperty('radius-outline', 'line-width', parseFloat(radiusBorderWidth));
    }
  }, [newRadiusColor, newRadiusBorderColor, radiusBorderWidth]);

  // Hooks for appling drivetime style settings in real time
  useEffect(() => {
    if (map.current.isStyleLoaded() && 'drivetime' in map.current.getStyle().sources) {
      map.current.setPaintProperty('drivetime', 'fill-color', newDrivetimeColor);
      map.current.setPaintProperty('drivetime-outline', 'line-color', newDrivetimeBorderColor);
      map.current.setPaintProperty('drivetime-outline', 'line-width', parseFloat(drivetimeBorderWidth));
    }
  }, [newDrivetimeColor, newDrivetimeBorderColor, drivetimeBorderWidth]);

  // Hooks for applying intersect sa1 style settings in real time
  useEffect(() => {
    if (map.current.isStyleLoaded()) {
      if ('drivetime' in map.current.getStyle().sources) {
        map.current.setPaintProperty('drivetime_sa1s', 'line-color', newIntersectSa1Color);
        map.current.setPaintProperty('drivetime_sa1s', 'line-width', parseFloat(intersectSa1Width));
      }
      if ('radius' in map.current.getStyle().sources) {
        map.current.setPaintProperty('radius_sa1s', 'line-color', newIntersectSa1Color);
        map.current.setPaintProperty('radius_sa1s', 'line-width', parseFloat(intersectSa1Width));
      }
      tradeAreas.map(ta => {
        map.current.setPaintProperty(`${ta}_outline`, 'line-color', newIntersectSa1Color);
        map.current.setPaintProperty(`${ta}_outline`, 'line-width', parseFloat(intersectSa1Width));
      });
    }
  }, [newIntersectSa1Color, intersectSa1Width])

  return (
    <div id={mapID} style={mapDivStyle} />
  );
}

export default forwardRef(Map);