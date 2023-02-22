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
import React, { useEffect, createRef, useRef, useState } from 'react';
import { styled } from '@superset-ui/core';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { getSequentialSchemeRegistry } from '@superset-ui/core';

const defaults = require('./defaultLayerStyles.js')

const liqSecrets = require('../../liq_secrets.js').liqSecrets;
const layerStyles = defaults.defaultLayerStyles;
const iconExprs = defaults.iconExprs;
const intranetImgs = defaults.intranetImgs;
const iconSizeExprs = defaults.iconSizeExprs;

mapboxgl.accessToken = liqSecrets.mapbox.accessToken;

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

const Styles = styled.div<LiqThematicMapsStylesProps>`
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

function getCurrBdryIds(map, boundary, groupCol) {
  const bdry_features = map.current.querySourceFeatures('boundary_tileset', {
    sourceLayer: boundary
   });

  let bdryIds = [];
   for (const d in bdry_features) {
    bdryIds.push({
      id: bdry_features[d].id,
      val: bdry_features[d].properties[groupCol]
    });
  }

  return bdryIds;
}

export default function LiqThematicMaps(props) {
  const { 
    data,
    groupCol,
    metricCol,
    height, 
    width, 
    mapStyle,
    boundary, 
    intranetLayers,
    linearColorScheme,
    breaksMode,
    customMode,
    numClasses
  } = props;

  const rootElem = createRef();

  const mapContainer = useRef(null);
  const map = useRef(null);

  const [currBdryIDs, setCurrBdryIDs] = useState([]);
  const [colorMap, setColorMap] = useState({});
  const [mapPos, setMapPos] = useState({lng: 151.2, lat: -33.8, zoom: 9});
  const [renderedIntranetLayers, setRenderedIntranetLayers] = useState([]);

  const loadIntranetLayers = (layers) => {
    layers.forEach(layer => {
      map.current.addLayer({
        'id': layer,
        'type': 'symbol',
        'source': 'intranet_tileset',
        'source-layer': layer,
        'layout': {
          'icon-image': iconExprs[layer],
          'icon-allow-overlap': true,
          'icon-size': layer in iconSizeExprs ? iconSizeExprs[layer] : 0.46 
        }
      });
    });
  };

  const initMap = () => {
    // Load map with light style and center on Sydney
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle ? mapStyle : 'mapbox://styles/mapbox/streets-v12',
      center: [mapPos.lng, mapPos.lat],
      zoom: mapPos.zoom    
    });
    
    map.current.setProjection('mercator');

    // Disable rotating
    map.current.dragRotate.disable();
    map.current.touchZoomRotate.disable();

    // Add geocoder
    map.current.addControl(
      new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        countries: 'au',
        marker: {
          color: '#BB1431'
        }
      })
    );

    Object.keys(intranetImgs).forEach(k => {
      map.current.loadImage(intranetImgs[k], (error, img) => {
        if (error) throw error;
        map.current.addImage(k, img);
      });
    });

    // Load map tiles and their default styles
    map.current.on('load', () => {

      map.current.addSource('boundary_tileset', {
        'type': 'vector',
        'url': liqSecrets.mapbox.tilesets.boundary
      });

      map.current.addSource('intranet_tileset', {
        'type': 'vector',
        'url': liqSecrets.mapbox.tilesets.intranet
      });

      map.current.addLayer({
        'id': 'boundary_tileset',
        'type': 'fill',
        'source': 'boundary_tileset',
        'source-layer': boundary,
        'layout': {},
        'paint': layerStyles.boundaryStyle
      });

      loadIntranetLayers(intranetLayers);
      setRenderedIntranetLayers([...intranetLayers]);

    });

    // When the map is moved around, get rendered tile features and store them in state for styling
    map.current.on('data', () => {
      const bdryIds = getCurrBdryIds(map, boundary, groupCol);
      setCurrBdryIDs([...bdryIds]);
    });

    map.current.on('move', () => {
      const {lng, lat} = map.current.getCenter();
      const zoom = map.current.getZoom().toFixed(2);
      const newMapPos = {
        lng: lng.toFixed(4),
        lat: lat.toFixed(4),
        zoom: zoom
      }
      setMapPos({...newMapPos});
    });
  }

  const instigateReload = () => {
    map.current.remove();
    map.current = null;
  }

  // When color map settings change, update state and map
  useEffect(() => {

    setColorMap({});

    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');

    var raw = (!breaksMode || breaksMode === 'Custom') ? JSON.stringify({
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

    fetch(
      liqSecrets.lambdaFunctions.cMap.url,
      requestOptions
    )
      .then(response => response.json())
      .then(result => {
        var cMap = {};
        data.forEach((d, i) => {
          cMap[d[groupCol]] = result.colors[i]
        });
        setColorMap({...cMap});
      })
      .then(error => console.log('error', error));
  }, [linearColorScheme, breaksMode, customMode, numClasses, data])

  // Make sure map is always resized relative to parent container
  useEffect(() => {
    if (!map.current) return;
    map.current.resize();
  }, [width, height])

  // Refresh map from scratch everytime there is new data
  useEffect(() => {
    if (map.current) instigateReload();
  }, [data, mapStyle])

  // Add or remove intranet layers in real time
  useEffect(() => {
    if (!map.current) return;
    renderedIntranetLayers.forEach(l => {
      map.current.removeLayer(l);
    });
    loadIntranetLayers(intranetLayers);
    setRenderedIntranetLayers([...intranetLayers]);
  }, [intranetLayers])

  // Main map initialization hook
  useEffect(() => {

    if (map.current) return;
    initMap();

  });

  // Hook for styling rendered tiles via feature state
  useEffect(() => {
    if (currBdryIDs.length === 0 || Object.keys(colorMap).length === 0) return;
    for (const i in currBdryIDs) {
      map.current.setFeatureState(
        {
          source: 'boundary_tileset', 
          sourceLayer: boundary, 
          id: currBdryIDs[i].id
        },
        {
          color: colorMap[currBdryIDs[i].val]
        }
      );
    }
    map.current.setPaintProperty('boundary_tileset', 'fill-color', ['feature-state', 'color']);
  }, [currBdryIDs]);

  return (
    <Styles
      ref={rootElem}
      height={height}
      width={width}
    >
      <div 
        ref={mapContainer} 
        className="map-container" 
        style={{height: height, width: width}}
      />
    </Styles>
  );  
}
