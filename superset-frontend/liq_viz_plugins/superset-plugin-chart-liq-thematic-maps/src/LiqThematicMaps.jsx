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

import entity from '../../liq_data/entity.json';

// UI imports
import {
  BarsOutlined,
  RadiusSettingOutlined,
  CarOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Menu, Layout } from 'antd';

// Component imports
import SideDrawer from './components/SideDrawer.js';
import Legend from './components/Legend.js';
import Radius from './components/Radius.js';
import DataDisplay from './components/DataDisplay.js';
import Drivetime from './components/Drivetime.js';

const { Content } = Layout;
const { SubMenu } = Menu;

const defaults = require('./defaultLayerStyles.js');

const iconsSVG = require('./iconSVG.js');

const liqSecrets = require('../../liq_secrets.js').liqSecrets;
const layerStyles = defaults.defaultLayerStyles;
const iconExprs = defaults.iconExprs;

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

export default function LiqThematicMaps(props) {
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
    features, // list of features to include in map
    linearColorScheme, // color palette for thematic
    breaksMode, // how to break up data
    customMode, // if breaksMode is "custom", user defined breaks 
    numClasses, // number of classes for breaks, i.e. number of ranges
    opacity, // opacity value for thematic
    tradeAreas, // trade area data if any
    tradeAreaSA1s, // trade area SA1 data
    taSectorSA1Map, // for each centre trade area sector, list of constituent SA1s
    taSectorColorMap, // for each centre trade area, map from sector to colour
    taSectorCentroids, // geojson file for sector centroid points, used to label them in a symbol layer
    intranetData, // data relating to intranet layers
    latitude, // starting lat
    longitude, // starting lng
    zoom, // starting zoom
    newRadiusColor, // color of radius in rgba
    radiusThreshold, // intersection area threshold for radius
    newRadiusBorderColor, // color of radius border in rgba
    radiusBorderWidth, // stroke width of radius border
    newRadiusLinkedCharts, // chart ids to update in dashboard when radius is updated
    newDrivetimeColor, // color of drivetime in rgba
    drivetimeThreshold, // intersection area threshold for drivetime
    newDrivetimeBorderColor, // color of drivetime border in rgba
    drivetimeBorderWidth, // stroke width of drivetime border
    newDrivetimeLinkedCharts, // chart ids to update in dashboard when drivetime is updated
    customName, // name of custom layer
    customType, // custom layer is either from a tileset or existing table
    customTileset, // url of custom layer tileset
    customDatabase, // database name of custom layer
    customSchema, // database schema of custom layer
    customTable, // database table of custom layer
    customGeom, // type of custom layer geometry, one of: Point, Polygon, Polyline, H3
    customShape, // shape for Point 
    customColorAttributeCheck, // whether to style custom layer colour based off attribute or not
    customColorAttribute, // metric for custom layer color
    newCustomColor, // fixed color, no attribute styling
    customColorScheme, // color scheme to use for attribute driven styling
    customColorBreaksMode, // how to break up data
    customColorMode, // if customColorBreaksMode is "custom", user defined breaks 
    customColorNumClasses, // number of classes for breaks, i.e. number of ranges
    customColorOpacity, // opacity of custom layer color
    customSizeAttributeCheck, // style custom layer Point size based off attribute or not
    customSizeAttribute, // metric for custom layer size
    customSize, // fixed size, no attribute styling
    customSizeMultiplier, // multiplier to increase size as we go up in class
    customSizeBreaksMode, // how to break up data
    customSizeMode, // if customSizeBreaksMode is "custom", user defined breaks
    customSizeNumClasses // number of classes for breaks, i.e. number of ranges
  } = props;

  const rootElem = createRef();

  const mapContainer = useRef(null);
  const map = useRef(null);
  let hovered = useRef({});

  const [currBdryIDs, setCurrBdryIDs] = useState([]); // currently rendered boundary tiles
  const [currTileIDs, setCurrTileIDs] = useState([]); // currently rendered intranet tiles
  const [colorMap, setColorMap] = useState({}); // color map based on data via cmap lambda
  const [mapPos, setMapPos] = useState({lng: longitude, lat: latitude, zoom: zoom});

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState(<></>);
  const [drawerTitle, setDrawerTitle] = useState('');

  const [thematicLegend, setThematicLegend] = useState(null);

  const items = [
    {
      icon: <PlusOutlined />,
      label: 'Menu',
      key: 'menu',
      children: [
        features.includes('legend') && 
        {
          icon: <BarsOutlined />,
          label: <span>Legend</span>,
          key: '1',
          onClick: () => {
            let reverseMap = {};
            Object.keys(colorMap).map(x => {
              if (colorMap[x] in reverseMap) {
                reverseMap[colorMap[x]].push(x);
              } else {
                reverseMap[colorMap[x]] = [x];
              }
            });
            setDrawerTitle('Map Legend');
            setDrawerContent(
              <Legend
                intranetLayers={intranetLayers}
                tradeAreas={tradeAreas} 
                thematicData={thematicLegend}
                taSectorSA1Map={taSectorSA1Map}
                taSectorColorMap={taSectorColorMap}
                colorMap={reverseMap} 
                thematicCol={metricCol}
                groupCol={groupCol}
                map={map}
              />
            );
            setDrawerOpen(true);
          }
        },
        features.includes('radius') && {
          icon: <RadiusSettingOutlined />,
          label: <span>Radius</span>,
          key: '2',
          onClick: () => {
            setDrawerTitle('Radius Settings');
            setDrawerContent(
              <Radius 
                map={map} 
                groupCol={groupCol} 
                boundary={boundary}
                radiusColor={newRadiusColor}
                radiusThreshold={radiusThreshold}
                borderColor={newRadiusBorderColor}
                borderWidth={radiusBorderWidth} 
                radiusLinkedCharts={newRadiusLinkedCharts}
              />
            );
            setDrawerOpen(true);
          }
        },
        features.includes('drivetime') && {
          icon: <CarOutlined />,
          label: <span>Drivetime</span>,
          key: '3',
          onClick: () => {
            setDrawerTitle('Drivetime Settings');
            setDrawerContent(
              <Drivetime 
                map={map}
                groupCol={groupCol}
                boundary={boundary}
                drivetimeColor={newDrivetimeColor}
                drivetimeThreshold={drivetimeThreshold}
                borderColor={newDrivetimeBorderColor}
                borderWidth={drivetimeBorderWidth}
                drivetimeLinkedCharts={newDrivetimeLinkedCharts}
              />
            );
            setDrawerOpen(true);
          }
        }
      ]
    }
  ]

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

  const handleCustomDetails = () => {
    if (customDetails.tileset && !(customDetails.tileset === '')) {
      map.current.addSource('custom_tileset', {
        'type': 'vector',
        'url': customTileset
      });

      map.current.addLayer({
        'id': 'custom_tileset',
        'type': 'symbol',
        'source': 'custom_tileset',
        'source-layer': 'gdf1',
        'layout': {
          'icon-image': 'unknown_ds',
          'icon-allow-overlap': true,
          'icon-size': 1
        }
      });
    }
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
      container: mapContainer.current,
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
        'paint': {...layerStyles.boundaryStyle, 'fill-opacity': opacity}
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
              ],
              'fill-outline-color': [
                'case',
                ['==', ['feature-state', ta], null],
                'transparent',
                '#FFFFFF'
              ],
            }
          });
        })
  
        map.current.addLayer({
          'id': 'trade_area_sector_centroids',
          'type': 'symbol',
          'source': 'trade_area_sector_centroids',
          'layout': {
            'text-field': ['get', 'label'],
            'text-anchor': 'left',
            'text-allow-overlap': true,
            'text-size': 12
          }
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
      const {lng, lat} = map.current.getCenter();
      const zoom = map.current.getZoom().toFixed(2);
      const newMapPos = {
        lng: lng.toFixed(4),
        lat: lat.toFixed(4),
        zoom: zoom
      };
      setMapPos({...newMapPos});
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
        setColorMap({...cMap});
        setThematicLegend({...result.breaks});
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
        {...state}
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
          {...intranetData[l][x.val]}
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

  return (
    <Layout style={{height: height, width: width}} ref={rootElem}>
      <Layout>
        <Content>
          <Menu 
            mode='horizontal' 
            style={{
              position: 'absolute',
              zIndex: 100,
              top: '5px',
              left: '5px',
              opacity: '80%'
            }}
          >
            {items.map(i => (
              i.children && i.children.length > 0 ?
                <SubMenu 
                  title={<span>{i.icon}{i.label}</span>} style={{ opacity: '80%' }}
                  key='subMenu'
                >
                  {i.children.map(c => (
                    c && <Menu.Item
                      key={c.key} 
                      onClick={c.onClick ? c.onClick : () => {}} 
                      disabled={Object.keys(colorMap).length === 0 && mapType.includes('thematic')}
                      style={{ opacity: '80%' }}
                    >
                      {c.icon}
                      {c.label}
                    </Menu.Item>
                  ))}
                </SubMenu>
              :
                i && <Menu.Item 
                  key={i.key} 
                  onClick={i.onClick ? i.onClick : () => {}} 
                  disabled={Object.keys(colorMap).length === 0 && mapType.includes('thematic')}
                  style={{ opacity: '80%' }}
                >
                  {i.icon}
                  {i.label}
                </Menu.Item>
            ))}
          </Menu>
          <div
            ref={mapContainer}
            style={{ height: height, width: '100%' }}
          />
          <SideDrawer 
            drawerTitle={drawerTitle}
            drawerContent={drawerContent}
            open={drawerOpen}
            setDrawerOpen={setDrawerOpen}
            width={width}
          />
        </Content>
      </Layout>
    </Layout>
  ); 
}